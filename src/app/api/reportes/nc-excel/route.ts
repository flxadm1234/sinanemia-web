import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { computeNcMetricsForEtapa, listNcMatrixForEtapa } from "@/lib/ncReporte";

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

function td(v: unknown, style = "") {
  const st = style ? ` style="${style}"` : "";
  return `<td${st}>${escapeHtml(v)}</td>`;
}

function tdText(v: unknown, style = "") {
  const st = style ? `;${style}` : "";
  return `<td style="mso-number-format:'\\@'${st}">${escapeHtml(v)}</td>`;
}

function th(v: unknown, style = "") {
  const st = style ? ` style="${style}"` : "";
  return `<th${st}>${escapeHtml(v)}</th>`;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "SUPER ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const etapa = String(url.searchParams.get("etapa") ?? "").trim();
  const ubigeoParam = String(url.searchParams.get("ubigeo") ?? "").trim();

  const ubigeo =
    session.tipo === "SUPER ADMIN" ? Number(ubigeoParam || "") : Number(session.ubigeo ?? "");

  if (!Number.isFinite(ubigeo) || ubigeo <= 0) {
    return NextResponse.json({ error: "invalid_ubigeo" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(etapa)) {
    return NextResponse.json({ error: "invalid_etapa" }, { status: 400 });
  }

  const [metrics, rows] = await Promise.all([
    computeNcMetricsForEtapa({ ubigeo, etapa, includeDetails: false }),
    listNcMatrixForEtapa({ ubigeo, etapa }),
  ]);

  if (!metrics) return NextResponse.json({ error: "no_data" }, { status: 404 });

  const total = rows.length;
  const denom = rows.filter((r) => r.en_denominador === "SI").length;
  const numer = rows.filter((r) => r.en_numerador === "SI").length;

  const filename = cleanFilename(`NC_${ubigeo}_${etapa}.xls`);

  const css = `
    body{font-family:Calibri,Arial,sans-serif;font-size:11pt}
    table{border-collapse:collapse}
    th,td{border:1px solid #D1D5DB;padding:4px 6px;vertical-align:top}
    th{font-weight:700}
    .h1{font-size:14pt;font-weight:700}
    .meta td{border:none;padding:2px 0}
    .sec1{background:#E0F2FE}
    .sec2{background:#ECFDF5}
    .sec3{background:#FEF3C7}
    .sec4{background:#F3E8FF}
    .row_num{background:#DCFCE7}
    .row_denom{background:#FEF9C3}
    .row_excld{background:#FEE2E2}
    .row_exclnc{background:#E5E7EB}
  `;

  const headerGroups = `
    <tr>
      ${th("Datos del niño", "background:#E0F2FE;text-align:center",)}
      ${th("", "display:none")}
    </tr>
  `;

  const columns = [
    { label: "N°", key: "idx" },
    { label: "Clasificación", key: "clas" },
    { label: "En denominador (NC)", key: "en_den" },
    { label: "Motivo excl. denominador", key: "mot_den" },
    { label: "Grupo", key: "grupo" },
    { label: "En numerador (N)", key: "en_num" },
    { label: "Motivo excl. numerador", key: "mot_num" },
    { label: "DNI", key: "dni" },
    { label: "Nombre completo", key: "nombre" },
    { label: "Actor social", key: "actor" },
    { label: "Responsable", key: "resp" },
    { label: "EESS UA", key: "eess" },
    { label: "Fecha cita", key: "fechacita" },
    { label: "EstadosVD", key: "estadosvd" },
    { label: "Departamento", key: "dep" },
    { label: "Provincia", key: "prov" },
    { label: "Distrito", key: "dist" },
    { label: "F. Nac.", key: "fnac" },
    { label: "Tipo seguro", key: "seg" },
    { label: "F. atención (HIS)", key: "fat" },
    { label: "Hemoglobina", key: "hb" },
    { label: "CIE10", key: "cie" },
    { label: "Diagnóstico", key: "diag" },
    { label: "LAB1", key: "lab1" },
    { label: "Resultado", key: "res" },
  ] as const;

  const thead = `<thead><tr>${columns
    .map((c) => th(c.label, "background:#F8FAFC"))
    .join("")}</tr></thead>`;

  const bodyRows = rows
    .map((r, i) => {
      const clas =
        r.en_denominador === "NO"
          ? "Excluido (Denominador)"
          : r.en_numerador === "SI"
            ? "Numerador (Sin anemia)"
            : "Denominador (Excluido del numerador)";
      const rowClass =
        r.en_denominador === "NO"
          ? "row_excld"
          : r.en_numerador === "SI"
            ? "row_num"
            : "row_denom";
      return `<tr class="${rowClass}">
        ${td(i + 1)}
        ${td(clas)}
        ${td(r.en_denominador)}
        ${td(r.motivo_exclusion_denominador)}
        ${td(r.grupo)}
        ${td(r.en_numerador)}
        ${td(r.motivo_exclusion_numerador)}
        ${tdText(r.dni)}
        ${td(r.nombrecompleto)}
        ${tdText(r.actorsocial)}
        ${tdText(r.responsable)}
        ${td(r.eess_ua)}
        ${td(r.fechacita)}
        ${td(r.estadosvd)}
        ${td(r.departamento)}
        ${td(r.provincia)}
        ${td(r.distrito)}
        ${td(r.fecha_nac)}
        ${td(r.tiposeguro)}
        ${td(r.fecha_atencion)}
        ${td(r.hemoglobina)}
        ${td(r.cie_10)}
        ${td(r.diagnostico)}
        ${td(r.lab1)}
        ${td(r.resultado)}
      </tr>`;
    })
    .join("");

  const summary = `
    <table class="meta">
      <tr><td class="h1">Reporte NC - Matriz de cálculo</td></tr>
      <tr><td>Ubigeo: <b>${escapeHtml(ubigeo)}</b> · Etapa: <b>${escapeHtml(etapa)}</b></td></tr>
      <tr><td>Total cargados: <b>${escapeHtml(total)}</b> · NC: <b>${escapeHtml(denom)}</b> · N: <b>${escapeHtml(numer)}</b> · %: <b>${escapeHtml(
        denom ? Math.round((numer / denom) * 1000) / 10 : 0,
      )}%</b></td></tr>
      <tr><td>Filtros del denominador: edad crítica + permanencia (2 meses) + seguro (SIS o sin seguro)</td></tr>
      <tr><td>Numerador: sin anemia (sin D509/D649) y hemoglobina consistente (6-18) con reglas de consistencia</td></tr>
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
          ${bodyRows}
        </tbody>
      </table>
    </body>
    </html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

