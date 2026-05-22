import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listVisitasDetallePorMes } from "@/lib/visitasMeta";

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

function toDate(v: unknown) {
  if (!v) return null;
  if (v instanceof Date && Number.isFinite(v.getTime())) return v;
  const s = String(v).trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function fmtDateDMY(v: unknown) {
  const d = toDate(v);
  if (!d) return "";
  const s = d.toISOString().slice(0, 10);
  const [y, m, dd] = s.split("-");
  return `${dd}/${m}/${y}`;
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

function tdDate(v: unknown) {
  return `<td>${escapeHtml(fmtDateDMY(v))}</td>`;
}

function tdNum(v: unknown) {
  return `<td style="mso-number-format:'0'">${escapeHtml(v)}</td>`;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (session.tipo === "INVITADO" || session.tipo === "SUPERVISOR")
      return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const url = new URL(request.url);
    const etapa = String(url.searchParams.get("etapa") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(etapa)) {
      return NextResponse.json({ error: "missing_etapa" }, { status: 400 });
    }

    const ubigeoCandidate =
      session.tipo === "SUPER ADMIN" ? Number(url.searchParams.get("ubigeo")) : session.ubigeo;
    const ubigeo = Number(ubigeoCandidate);
    if (!Number.isFinite(ubigeo) || ubigeo <= 0) {
      return NextResponse.json({ error: "missing_ubigeo" }, { status: 400 });
    }

    const actor = session.tipo === "ACTOR SOCIAL" ? session.dni : undefined;
    const responsable = session.tipo === "COORDINADOR" ? session.dni : undefined;

    const rows = await listVisitasDetallePorMes({ ubigeo, etapa, actor, responsable });

    const header = [
      "N°",
      "Ubigeo",
      "Etapa",
      "DNI niño",
      "Nombre",
      "Actor social",
      "Responsable",
      "Tipo seguro",
      "F. Nac",
      "En denominador",
      "Obs. denominador",
      "Visitas esperadas",
      "Visitas registradas",
      "V1",
      "V2",
      "V3",
      "Completa",
      "Oportuna",
      "Cumple",
      "No encontrado",
      "Rechazado",
      "Estado (NVₙ)",
      "Visitas georef",
      "Tiene georef",
    ];

    const exclMap = new Map<string, number>();
    const nvMap = new Map<string, number>();

    for (const r of rows as any[]) {
      const inDen = Number(r.es_denominador ?? 0) === 1;
      if (!inDen) {
        const reason = String(r.obs_denominador ?? "Excluido");
        exclMap.set(reason, (exclMap.get(reason) ?? 0) + 1);
      } else {
        const noEncontrado = Number(r.flag_no_encontrado ?? 0) === 1;
        const rechazado = Number(r.flag_rechazado ?? 0) === 1;
        const visitas = Number(r.visitas_count ?? 0);
        const completa = Number(r.completa ?? 0) === 1;
        const oportuna = Number(r.oportuna ?? 0) === 1;

        let estado = "Cumple";
        if (noEncontrado) estado = "No encontrado";
        else if (rechazado) estado = "Rechazado";
        else if (!visitas) estado = "Sin registro de visita (Excel)";
        else if (!completa) estado = "Con visitas pero no completas";
        else if (!oportuna) estado = "Completas pero no oportunas (7–10d)";

        if (estado !== "Cumple") nvMap.set(estado, (nvMap.get(estado) ?? 0) + 1);
      }
    }

    const body = rows
      .map((r, idx) => {
        const cumple = Number(r.cumple ?? 0) === 1;
        const visitas = Number(r.visitas_count ?? 0);
        const inDen = Number(r.es_denominador ?? 0) === 1;
        const noEncontrado = Number(r.flag_no_encontrado ?? 0) === 1;
        const rechazado = Number(r.flag_rechazado ?? 0) === 1;

        let estado = "Cumple";
        if (noEncontrado) estado = "No encontrado";
        else if (rechazado) estado = "Rechazado";
        else if (!visitas) estado = "Sin registro de visita (Excel)";
        else if (Number(r.completa ?? 0) !== 1) estado = "Con visitas pero no completas";
        else if (Number(r.oportuna ?? 0) !== 1) estado = "Completas pero no oportunas (7–10d)";

        const bg = !inDen ? "#E5E7EB" : estado === "Cumple" ? "#ECFDF5" : "#FEF9C3";
        return `<tr style="background:${bg}">
          ${td(idx + 1)}
          ${tdText(r.ubigeo)}
          ${tdDate(r.etapa_mes)}
          ${tdText(r.dni)}
          ${td(r.nombrecompleto ?? "")}
          ${tdText(r.actorsocial ?? "")}
          ${tdText(r.responsable ?? "")}
          ${td(r.tiposeguro ?? "")}
          ${tdDate(r.fecha_nac)}
          ${td(inDen ? "Sí" : "No")}
          ${td(r.obs_denominador ?? "")}
          ${td(r.expected_visits ?? "")}
          ${tdNum(r.visitas_count ?? 0)}
          ${tdDate(r.fecha_v1)}
          ${tdDate(r.fecha_v2)}
          ${tdDate(r.fecha_v3)}
          ${td(cumple ? "Sí" : Number(r.completa ?? 0) === 1 ? "Sí" : "No")}
          ${td(Number(r.oportuna ?? 0) === 1 ? "Sí" : "No")}
          ${td(cumple ? "Sí" : "No")}
          ${td(noEncontrado ? "Sí" : "No")}
          ${td(rechazado ? "Sí" : "No")}
          ${td(estado === "Cumple" ? "Cumple" : estado)}
          ${td(r.georef_visits ?? 0)}
          ${td(Number(r.has_georef ?? 0) === 1 ? "Sí" : "No")}
        </tr>`;
      })
      .join("");

    const exclRows = Array.from(exclMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `<tr>${td(k)}${tdNum(v)}</tr>`)
      .join("");

    const nvRows = Array.from(nvMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `<tr>${td(k)}${tdNum(v)}</tr>`)
      .join("");

    const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <table border="1" cellpadding="4" cellspacing="0">
          <thead>
            <tr style="background:#111827;color:#fff;font-weight:700">
              ${header.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${body}
          </tbody>
        </table>
        <br />
        <table border="1" cellpadding="4" cellspacing="0">
          <thead>
            <tr style="background:#111827;color:#fff;font-weight:700">
              <th>Exclusiones del denominador (Nₙ)</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            ${exclRows || `<tr><td colspan="2">Sin exclusiones.</td></tr>`}
          </tbody>
        </table>
        <br />
        <table border="1" cellpadding="4" cellspacing="0">
          <thead>
            <tr style="background:#111827;color:#fff;font-weight:700">
              <th>No suman al numerador (NVₙ) (solo dentro del denominador)</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            ${nvRows || `<tr><td colspan="2">Sin observaciones.</td></tr>`}
          </tbody>
        </table>
      </body>
    </html>`;

    const filename = cleanFilename(`visitas_oportunas_${ubigeo}_${etapa}.xls`);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("visitas_excel_failed", e);
    return NextResponse.json({ error: "visitas_excel_failed" }, { status: 500 });
  }
}

