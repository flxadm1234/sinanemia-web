import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
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

function tdFormulaDate(formula: string, style = "") {
  const st = style ? `;${style}` : "";
  return `<td style="mso-number-format:'dd\\/mm\\/yyyy'${st}">${formula}</td>`;
}

function tdFormulaText(formula: string, style = "") {
  const st = style ? ` style="${style}"` : "";
  return `<td${st}>${formula}</td>`;
}

function th(v: unknown, style = "") {
  const st = style ? ` style="${style}"` : "";
  return `<th${st}>${escapeHtml(v)}</th>`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoToFechaFormula(v: unknown) {
  const s = String(v ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return "";
  return `=FECHA(${y};${mo};${d})`;
}

function tdIsoDate(v: unknown, style = "") {
  const f = isoToFechaFormula(v);
  if (!f) return td("", style);
  return tdFormulaDate(f, style);
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (
    session.tipo !== "ADMINISTRADOR" &&
    session.tipo !== "SUPER ADMIN" &&
    session.tipo !== "SUPERVISOR"
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const yearRaw = String(url.searchParams.get("year") ?? "").trim();
  const ubigeoParam = String(url.searchParams.get("ubigeo") ?? "").trim();

  const ubigeo =
    session.tipo === "SUPER ADMIN" || session.tipo === "SUPERVISOR"
      ? Number(ubigeoParam || "")
      : Number(session.ubigeo ?? "");
  const year = Number(yearRaw);

  if (!Number.isFinite(ubigeo) || ubigeo <= 0) {
    return NextResponse.json({ error: "invalid_ubigeo" }, { status: 400 });
  }
  if (!Number.isFinite(year) || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "invalid_year" }, { status: 400 });
  }

  const pool = getDbPool();
  const [mesRows] = await pool.query(
    `SELECT numero_mes
     FROM meses
     WHERE ubigeo = ? AND year = ?
     ORDER BY numero_mes ASC`,
    [String(ubigeo), year],
  );
  const meses = (mesRows as any[])
    .map((r) => Number(r.numero_mes ?? 0))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 12);

  if (!meses.length) {
    return NextResponse.json({ error: "no_months" }, { status: 404 });
  }

  const etapas = Array.from(new Set(meses)).map((m) => `${year}-${pad2(m)}-01`);

  const perMonth = await Promise.all(
    etapas.map(async (etapa) => {
      const [metrics, rows] = await Promise.all([
        computeNcMetricsForEtapa({ ubigeo, etapa, includeDetails: false }),
        listNcMatrixForEtapa({ ubigeo, etapa }),
      ]);
      return { etapa, metrics, rows };
    }),
  );

  const allRows = perMonth.flatMap((m) => m.rows.map((r) => ({ etapa: m.etapa, r })));
  const total = allRows.length;
  const denom = allRows.filter((x) => x.r.en_denominador === "SI").length;
  const numer = allRows.filter((x) => x.r.en_numerador === "SI").length;

  const filename = cleanFilename(`NC_${ubigeo}_${year}.xls`);

  const css = `
    body{font-family:Calibri,Arial,sans-serif;font-size:11pt}
    table{border-collapse:collapse}
    th,td{border:1px solid #D1D5DB;padding:4px 6px;vertical-align:top}
    th{font-weight:700}
    .h1{font-size:14pt;font-weight:700}
    .meta td{border:none;padding:2px 0}
    .row_num{background:#DCFCE7}
    .row_denom{background:#FEF9C3}
    .row_excld{background:#FEE2E2}
  `;

  const columns = [
    "N°",
    "Etapa",
    "Clasificación",
    "En denominador (NC)",
    "Motivo excl. denominador",
    "Grupo",
    "En numerador (N)",
    "Motivo excl. numerador",
    "DNI",
    "Nombre completo",
    "Actor social",
    "Responsable",
    "EESS UA",
    "Fecha cita",
    "EstadosVD",
    "Rango",
    "Departamento",
    "Provincia",
    "Distrito",
    "F. Nac.",
    "Edad (años)",
    "Edad (meses)",
    "Edad (días)",
    "Fecha_maxima_tamizaje",
    "Oportunidad_tamizaje",
    "Tipo seguro",
    "Fecha_Registro",
    "F. atención (HIS)",
    "Hemoglobina",
    "CIE10",
    "Diagnóstico",
    "LAB1",
    "Resultado",
  ] as const;

  const thead = `<thead><tr>${columns
    .map((c) => th(c, "background:#F8FAFC"))
    .join("")}</tr></thead>`;

  const bodyRows = allRows
    .map(({ etapa, r }, i) => {
      const excelRowNum = 8 + i;
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
      const fechaMaxTamizajeFormula = `=SI(MAYUSC(F${excelRowNum})="6M";T${excelRowNum}+209;T${excelRowNum}+394)`;
      const oportunidadFormula = `=SI(ESBLANCO(AB${excelRowNum});"";SI(AB${excelRowNum}>X${excelRowNum};"INOPORTUNO";"OPORTUNO"))`;
      return `<tr class="${rowClass}">
        ${td(i + 1)}
        ${td(etapa)}
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
        ${tdIsoDate(r.fechacita)}
        ${td(r.estadosvd)}
        ${td(r.rango)}
        ${td(r.departamento)}
        ${td(r.provincia)}
        ${td(r.distrito)}
        ${tdIsoDate(r.fecha_nac)}
        ${td(r.edad_anios)}
        ${td(r.edad_meses)}
        ${td(r.edad_dias)}
        ${tdFormulaDate(fechaMaxTamizajeFormula)}
        ${tdFormulaText(oportunidadFormula)}
        ${td(r.tiposeguro)}
        ${tdIsoDate(r.fecha_registro)}
        ${tdIsoDate(r.fecha_atencion)}
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
      <tr><td class="h1">Reporte NC - Consolidado anual</td></tr>
      <tr><td>Ubigeo: <b>${escapeHtml(ubigeo)}</b> · Año: <b>${escapeHtml(year)}</b></td></tr>
      <tr><td>Filas: <b>${escapeHtml(total)}</b> · NC: <b>${escapeHtml(denom)}</b> · N: <b>${escapeHtml(numer)}</b> · %: <b>${escapeHtml(
        denom ? Math.round((numer / denom) * 1000) / 10 : 0,
      )}%</b></td></tr>
      <tr><td>La lógica por fila es la misma que descargar mes por mes, solo consolidada en una sola tabla.</td></tr>
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

