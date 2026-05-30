import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDbPool } from "@/lib/db";

export const runtime = "nodejs";

function escapeHtml(v: unknown) {
  const s = String(v ?? "");
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanFilename(s: string) {
  return s
    .replaceAll(/[^\w\-.,() ]+/g, "_")
    .trim()
    .slice(0, 180);
}

function td(v: unknown) {
  return `<td>${escapeHtml(v)}</td>`;
}

function tdText(v: unknown) {
  return `<td style="mso-number-format:'\\@'">${escapeHtml(v)}</td>`;
}

function th(v: unknown) {
  return `<th style="background:#F8FAFC">${escapeHtml(v)}</th>`;
}

function parseYmd(v: unknown) {
  if (v instanceof Date) {
    const iso = v.toISOString().slice(0, 10);
    const m0 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m0) return null;
    const y0 = Number(m0[1]);
    const mo0 = Number(m0[2]);
    const d0 = Number(m0[3]);
    if (!Number.isFinite(y0) || !Number.isFinite(mo0) || !Number.isFinite(d0)) return null;
    const dt0 = new Date(Date.UTC(y0, mo0 - 1, d0));
    if (Number.isNaN(dt0.getTime())) return null;
    return dt0;
  }

  const s = String(v ?? "").trim();
  const s10 = s.length >= 10 ? s.slice(0, 10) : s;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s10);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function parseDmy(v: unknown) {
  const s = String(v ?? "").trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function daysBetweenUTC(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function normalizeDocKey(v: unknown) {
  const raw = String(v ?? "").trim();
  if (!raw) return "SIN DATO";
  const parts = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x === "1" || x === "2" || x === "3" || x === "4");
  if (!parts.length) return "SIN DATO";
  const uniq = Array.from(new Set(parts.map(Number)))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .map(String);
  return uniq.length ? uniq.join(",") : "SIN DATO";
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo === "INVITADO") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const ubigeoCandidate =
    session.tipo === "SUPER ADMIN" || session.tipo === "SUPERVISOR"
      ? Number(url.searchParams.get("ubigeo"))
      : session.ubigeo;
  const ubigeo = Number(ubigeoCandidate);
  if (!Number.isFinite(ubigeo) || ubigeo <= 0) {
    return NextResponse.json({ error: "invalid_ubigeo" }, { status: 400 });
  }

  const docKey = normalizeDocKey(url.searchParams.get("doc_key"));
  if (!docKey || docKey === "SIN DATO") {
    return NextResponse.json({ error: "invalid_doc_key" }, { status: 400 });
  }

  const pool = getDbPool();
  const [jobRows] = await pool.query(
    `SELECT id, fecha_corte, headers_json
     FROM padron_dni_import_jobs
     WHERE ubigeo = ? AND status = 'done'
     ORDER BY fecha_corte DESC, created_at DESC, id DESC
     LIMIT 1`,
    [ubigeo],
  );
  const job = (jobRows as any[])[0] as any | undefined;
  if (!job?.id || !job?.fecha_corte) return NextResponse.json({ error: "no_job" }, { status: 404 });

  const fechaCorte = parseYmd(job.fecha_corte);
  if (!fechaCorte) return NextResponse.json({ error: "invalid_fecha_corte" }, { status: 500 });
  const fechaCorteISO = fechaCorte.toISOString().slice(0, 10);

  let headers: string[] = [];
  try {
    headers = job.headers_json ? (JSON.parse(String(job.headers_json)) as string[]) : [];
  } catch {
    headers = [];
  }

  const [rawRows] = await pool.query(
    `SELECT tipo, row_num, dni, payload
     FROM padron_dni_raw
     WHERE job_id = ? AND JSON_VALID(payload)
     ORDER BY tipo ASC, row_num ASC`,
    [String(job.id)],
  );

  const out: Array<{
    tipo: string;
    row_num: number;
    dni: string;
    edad_dias: number;
    payload: any[];
  }> = [];

  for (const r of rawRows as any[]) {
    let payload: any[] = [];
    try {
      payload = JSON.parse(String(r?.payload ?? "[]"));
      if (!Array.isArray(payload)) payload = [];
    } catch {
      continue;
    }

    const key = normalizeDocKey(payload[1]);
    if (key !== docKey) continue;

    const nacRaw = payload[12];
    const nac = parseYmd(nacRaw) ?? parseDmy(nacRaw);
    if (!nac) continue;

    const ageDays = daysBetweenUTC(fechaCorte, nac);
    if (ageDays < 0 || ageDays > 365) continue;

    out.push({
      tipo: String(r?.tipo ?? ""),
      row_num: Number(r?.row_num ?? 0),
      dni: String(r?.dni ?? ""),
      edad_dias: ageDays,
      payload,
    });
  }

  const css = `
    body{font-family:Calibri,Arial,sans-serif;font-size:11pt}
    table{border-collapse:collapse}
    th,td{border:1px solid #D1D5DB;padding:4px 6px;vertical-align:top}
    th{font-weight:700}
    .h1{font-size:14pt;font-weight:700}
    .meta td{border:none;padding:2px 0}
  `;

  const columns = [
    { label: "N°", kind: "num" as const },
    { label: "Archivo", kind: "text" as const },
    { label: "Key (CNV/DNI/CODPAD)", kind: "text" as const },
    { label: "Edad (días) al corte", kind: "num" as const },
    ...headers.map((h, idx) => ({ label: h || `COL_${idx + 1}`, kind: "auto" as const, idx })),
  ];

  const thead = `<thead><tr>${columns.map((c) => th(c.label)).join("")}</tr></thead>`;

  const body = out
    .map((r, i) => {
      const fixed = [
        td(i + 1),
        tdText(r.tipo),
        tdText(r.dni),
        td(r.edad_dias),
      ];
      const payloadCells = headers.map((_, idx) => {
        const v = r.payload[idx] ?? "";
        const isText =
          idx === 2 || idx === 3 || idx === 4 || idx === 5 || idx === 45 || idx === 46 || idx === 54;
        return isText ? tdText(v) : td(v);
      });
      return `<tr>${[...fixed, ...payloadCells].join("")}</tr>`;
    })
    .join("");

  const summary = `
    <table class="meta">
      <tr><td class="h1">Padrón DNI - Tipo de documento (0-12 meses)</td></tr>
      <tr><td>Ubigeo: <b>${escapeHtml(ubigeo)}</b> · Corte: <b>${escapeHtml(fechaCorteISO)}</b></td></tr>
      <tr><td>Tipo de documento: <b>${escapeHtml(docKey)}</b> · Registros: <b>${escapeHtml(out.length)}</b></td></tr>
      <tr><td>&nbsp;</td></tr>
    </table>
  `;

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>${css}</style>
    </head>
    <body>
      ${summary}
      <table>
        ${thead}
        <tbody>
          ${body}
        </tbody>
      </table>
    </body>
  </html>`;

  const filename = cleanFilename(`padron_dni_${ubigeo}_${fechaCorteISO}_${docKey}.xls`);
  return new NextResponse(html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

