import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensurePadronDniTables, getPadronDniJob } from "@/lib/padronDniImport";
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

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo === "COORDINADOR" || session.tipo === "ACTOR SOCIAL")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await ensurePadronDniTables();
  const { id } = await ctx.params;
  const jobId = String(id ?? "").trim();
  const job = await getPadronDniJob(jobId);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (job.status !== "done") return NextResponse.json({ error: "not_ready" }, { status: 400 });

  let headers: string[] = [];
  try {
    headers = JSON.parse(String(job.headers_json ?? "[]"));
  } catch {
    headers = [];
  }
  if (!Array.isArray(headers)) headers = [];
  const safeHeaders = headers.map((h, i) => (String(h ?? "").trim() ? String(h ?? "").trim() : `COL${i + 1}`));

  const pool = getDbPool();
  const [rows] = await pool.query(
    `SELECT tipo, row_num, payload
     FROM padron_dni_raw
     WHERE job_id = ?
     ORDER BY tipo ASC, row_num ASC, id ASC`,
    [jobId],
  );

  const out: string[] = [];
  out.push("<html><head><meta charset=\"utf-8\"/></head><body>");
  out.push("<table border=\"1\">");
  out.push("<thead><tr>");
  out.push("<th>Tipo</th>");
  out.push("<th>Fila</th>");
  for (const h of safeHeaders) out.push(`<th>${escapeHtml(h)}</th>`);
  out.push("</tr></thead>");
  out.push("<tbody>");

  for (const r of rows as any[]) {
    const tipo = String(r.tipo ?? "");
    const rowNum = Number(r.row_num ?? 0);
    let payload: any[] = [];
    try {
      payload = JSON.parse(String(r.payload ?? "[]"));
    } catch {
      payload = [];
    }
    if (!Array.isArray(payload)) payload = [];
    out.push("<tr>");
    out.push(td(tipo));
    out.push(td(rowNum ? String(rowNum) : ""));
    for (let i = 0; i < safeHeaders.length; i++) {
      const v = payload[i] ?? "";
      if (i === 0 || i === 1 || i === 2) out.push(tdText(v));
      else out.push(td(v));
    }
    out.push("</tr>");
  }
  out.push("</tbody></table></body></html>");

  const ubigeo = job.ubigeo ? String(job.ubigeo) : "ubigeo";
  const fecha = String(job.fecha_corte ?? "").slice(0, 10) || "fecha";
  const filename = cleanFilename(`padron_dni_${ubigeo}_${fecha}.xls`);

  return new NextResponse(out.join(""), {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

