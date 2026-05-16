import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listPadronReporte, type PadronReporteRow } from "@/lib/reportesPadron";

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

function fmtDateISO(v: unknown) {
  const d = toDate(v);
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function fmtDateDMY(v: unknown) {
  const s = fmtDateISO(v);
  if (!s) return "";
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function fmtDateTimeDMY(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s);
  if (!m) return fmtDateDMY(v);
  const dmy = `${m[3]}/${m[2]}/${m[1]}`;
  if (!m[4] || !m[5]) return dmy;
  return `${dmy} ${m[4]}:${m[5]}`;
}

function diffAgeParts(birth: Date, asOf: Date) {
  const b = new Date(
    Date.UTC(birth.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()),
  );
  const a = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  if (a.getTime() < b.getTime()) return null;

  let years = a.getUTCFullYear() - b.getUTCFullYear();
  let months = a.getUTCMonth() - b.getUTCMonth();
  let days = a.getUTCDate() - b.getUTCDate();

  if (days < 0) {
    const prevMonth = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 0));
    days += prevMonth.getUTCDate();
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  const totalDays = Math.floor((a.getTime() - b.getTime()) / 86400000);
  return { years, months, days, totalDays };
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

function tdDateTime(v: unknown) {
  return `<td>${escapeHtml(fmtDateTimeDMY(v))}</td>`;
}

type Col = {
  label: string;
  cell: (r: PadronReporteRow, idx: number) => string;
};

type Section = { label: string; color: string; cols: Col[] };

function buildSections() {
  const sections: Section[] = [
    {
      label: "Menor",
      color: "#E0F2FE",
      cols: [
        { label: "N°", cell: (_r, idx) => td(idx + 1) },
        { label: "ID PN", cell: (r) => td(r.idpn) },
        { label: "Ubigeo", cell: (r) => tdText(r.ubigeo ?? "") },
        { label: "Etapa", cell: (r) => tdDate(r.etapa) },
        { label: "Tipo", cell: (r) => td(r.tipo ?? "") },
        { label: "Rango", cell: (r) => td(r.rango ?? "") },
        { label: "Tipodoc", cell: (r) => td(r.tipodoc ?? "") },
        { label: "Tipodocum", cell: (r) => td(r.tipodocum ?? "") },
        { label: "DNI", cell: (r) => tdText(r.dni ?? "") },
        { label: "Nombres", cell: (r) => td(r.nombres ?? "") },
        { label: "F. Nac.", cell: (r) => tdDate(r.fecha_nac) },
        {
          label: "Edad (a/m/d)",
          cell: (r) => {
            const b = toDate(r.fecha_nac);
            const asOf = toDate(r.etapa) ?? new Date();
            const age = b ? diffAgeParts(b, asOf) : null;
            return td(age ? `${age.years}a ${age.months}m ${age.days}d` : "");
          },
        },
        {
          label: "Edad (días)",
          cell: (r) => {
            const b = toDate(r.fecha_nac);
            const asOf = toDate(r.etapa) ?? new Date();
            const age = b ? diffAgeParts(b, asOf) : null;
            return td(age ? age.totalDays : "");
          },
        },
      ],
    },
    {
      label: "Madre",
      color: "#ECFDF5",
      cols: [
        { label: "DNI Madre", cell: (r) => tdText(r.dnimadre ?? "") },
        { label: "Ap. Pat Madre", cell: (r) => td(r.appatmadre ?? "") },
        { label: "Ap. Mat Madre", cell: (r) => td(r.apmatmadre ?? "") },
        { label: "Nombres Madre", cell: (r) => td(r.nombresmadre ?? "") },
        { label: "Teléfono", cell: (r) => tdText(r.telefonopn ?? r.telefono ?? "") },
        { label: "Titular línea", cell: (r) => td(r.titular_linea ?? "") },
        { label: "Celular SEAPP", cell: (r) => tdText(r.celularseapp ?? "") },
        { label: "Tipo seguro", cell: (r) => td(r.tiposeguro ?? "") },
        { label: "Estado seguro", cell: (r) => td(r.estadoseguro ?? "") },
        { label: "Fecha act. seguro", cell: (r) => tdDateTime(r.fecha_act_seguro) },
      ],
    },
    {
      label: "Padre",
      color: "#FEF3C7",
      cols: [
        { label: "DNI Padre", cell: (r) => tdText(r.dni_padre ?? "") },
        { label: "Nombre Padre", cell: (r) => td(r.nombre_padre ?? "") },
      ],
    },
    {
      label: "Ubicación",
      color: "#F3E8FF",
      cols: [
        { label: "Departamento", cell: (r) => td(r.departamento ?? "") },
        { label: "Provincia", cell: (r) => td(r.provincia ?? "") },
        { label: "Distrito", cell: (r) => td(r.distrito ?? "") },
        { label: "ID Distrito", cell: (r) => td(r.iddistrito ?? "") },
        { label: "CCPP", cell: (r) => td(r.ccpp ?? "") },
        { label: "Zona", cell: (r) => td(r.zona ?? "") },
        { label: "MZ", cell: (r) => td(r.mz ?? "") },
        { label: "Dirección", cell: (r) => td(r.direccion ?? "") },
        { label: "Referencia", cell: (r) => td(r.referencia ?? "") },
        { label: "Nueva dirección", cell: (r) => td(r.nuevadireccion ?? "") },
        { label: "Nueva referencia", cell: (r) => td(r.nuevareferencia ?? "") },
        { label: "Lat", cell: (r) => td(r.lat ?? "") },
        { label: "Lon", cell: (r) => td(r.lon ?? "") },
        { label: "Lat2", cell: (r) => td(r.lat2 ?? "") },
        { label: "Long2", cell: (r) => td(r.long2 ?? "") },
        { label: "Lat3", cell: (r) => td(r.lat3 ?? "") },
        { label: "Long3", cell: (r) => td(r.long3 ?? "") },
        { label: "EESS UA", cell: (r) => td(r.eess_ua ?? "") },
        { label: "CodEESS", cell: (r) => td(r.codeess ?? "") },
        { label: "Nombre comercial", cell: (r) => td(r.nombre_comercial ?? "") },
        { label: "CodQR", cell: (r) => td(r.codqr ?? "") },
        { label: "Código V", cell: (r) => td(r.codigov ?? "") },
      ],
    },
    {
      label: "Asignación",
      color: "#FFE4E6",
      cols: [
        { label: "Actor social (DNI)", cell: (r) => tdText(r.actorsocial ?? "") },
        { label: "Actor social (Nombre)", cell: (r) => td(r.actor_nombre ?? "") },
        { label: "Responsable (DNI)", cell: (r) => tdText(r.responsable ?? "") },
        { label: "Responsable (Nombre)", cell: (r) => td(r.responsable_nombre ?? "") },
        { label: "Usuario", cell: (r) => tdText(r.usuario ?? "") },
        { label: "Asignación", cell: (r) => td(r.asignacion ?? "") },
      ],
    },
    {
      label: "Ocurrencias",
      color: "#E5E7EB",
      cols: [
        { label: "ID Ocurrencia", cell: (r) => td(r.idocurrencia ?? "") },
        { label: "Ocurrencia", cell: (r) => td(r.ocurrencia_desc ?? "") },
        { label: "ID Ocurrencia 2", cell: (r) => td(r.idocurrencia2 ?? "") },
        { label: "Ocurrencia 2", cell: (r) => td(r.ocurrencia2_desc ?? "") },
      ],
    },
    {
      label: "VD / Estados",
      color: "#DBEAFE",
      cols: [
        { label: "Estado VD", cell: (r) => td(r.estadovd ?? "") },
        { label: "EstadosVD", cell: (r) => td(r.estadosvd ?? "") },
        { label: "EstadosVD2", cell: (r) => td(r.estadosvd2 ?? "") },
        { label: "EstadosVD3", cell: (r) => td(r.estadosvd3 ?? "") },
        { label: "Nro VD", cell: (r) => td(r.nrovd ?? "") },
        { label: "Modo VD", cell: (r) => td(r.modovd ?? "") },
        { label: "Fecha cita", cell: (r) => tdDate(r.fechacita) },
        { label: "F. inicio VD", cell: (r) => tdDate(r.fecha_inicio_vd) },
        { label: "F. fin VD", cell: (r) => tdDate(r.fecha_fin_vd) },
        { label: "1ra VD", cell: (r) => tdDate(r.primera_vd) },
        { label: "2da VD", cell: (r) => tdDate(r.segunda_vd) },
        { label: "3ra VD", cell: (r) => tdDate(r.tercera_vd) },
        { label: "Programación 1", cell: (r) => tdDate(r.programacion1) },
        { label: "F. modif.", cell: (r) => tdDateTime(r.fechamodificacion) },
        { label: "F. modif. 2", cell: (r) => tdDateTime(r.fechamodificacion2) },
        { label: "Estado intervención", cell: (r) => td(r.estadointervencion ?? "") },
      ],
    },
    {
      label: "Tamizaje / Otros",
      color: "#FEE2E2",
      cols: [
        { label: "Tipovd", cell: (r) => td(r.tipovd ?? "") },
        { label: "Tamisaje", cell: (r) => td(r.tamisaje ?? "") },
        { label: "Fecha tamisaje", cell: (r) => tdDate(r.fechatamisaje) },
        { label: "HB", cell: (r) => td(r.hb ?? "") },
        { label: "Anemia", cell: (r) => td(r.anemia ?? "") },
        { label: "Hierro", cell: (r) => td(r.hierro ?? "") },
        { label: "TSF", cell: (r) => td(r.tsf ?? "") },
        { label: "RSF", cell: (r) => td(r.rsf ?? "") },
        { label: "Resultado", cell: (r) => td(r.resultado ?? "") },
        { label: "Avance", cell: (r) => td(r.avance ?? "") },
        { label: "HB registro", cell: (r) => td(r.hbregistro ?? "") },
        { label: "CCRED", cell: (r) => td(r.ccred ?? "") },
        { label: "Adulto", cell: (r) => td(r.adulto ?? "") },
        { label: "Cantidad A", cell: (r) => td(r.cantidada ?? "") },
        { label: "Discapacidad", cell: (r) => td(r.discapacidad ?? "") },
        { label: "Visita DOPS", cell: (r) => td(r.visitadops ?? "") },
        { label: "Sesión DEM", cell: (r) => td(r.sesiondem ?? "") },
        { label: "Tiene PS", cell: (r) => td(r.tieneps ?? "") },
        { label: "Observación", cell: (r) => td(r.observacion ?? "") },
        { label: "Observación 2", cell: (r) => td(r.observacion2 ?? "") },
        { label: "Obs padrón", cell: (r) => td(r.obspadron ?? "") },
        { label: "Estado verificación", cell: (r) => td(r.estado_verificacion ?? "") },
        { label: "Estado", cell: (r) => td(r.estado ?? "") },
        { label: "Estado verificado", cell: (r) => td(r.estado_verificado ?? "") },
        { label: "Tipo dispositivo", cell: (r) => td(r.tipodispositivo ?? "") },
        { label: "Fotos", cell: (r) => td(r.fotos ?? "") },
        { label: "Img carnet", cell: (r) => td(r.img_carnet ?? "") },
        { label: "Padrón nominal", cell: (r) => td(r.padronnominal ?? "") },
      ],
    },
  ];
  return sections;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "SUPER ADMIN") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const tipoRaw = String(url.searchParams.get("tipo") ?? "").trim();
    const tipo = tipoRaw === "2" ? 2 : tipoRaw === "1" ? 1 : null;
    if (!tipo) {
      return NextResponse.json({ error: "invalid_tipo" }, { status: 400 });
    }

    const etapasRaw = String(url.searchParams.get("etapas") ?? "").trim();
    const etapas = Array.from(
      new Set(
        etapasRaw
          .split(",")
          .map((e) => e.trim())
          .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e)),
      ),
    );
    if (!etapas.length) {
      return NextResponse.json({ error: "missing_etapas" }, { status: 400 });
    }

    const ubigeoCandidate =
      session.tipo === "SUPER ADMIN" ? undefined : session.ubigeo;
    const ubigeo = typeof ubigeoCandidate === "number" ? ubigeoCandidate : undefined;
    if (session.tipo !== "SUPER ADMIN" && typeof ubigeo !== "number") {
      return NextResponse.json({ error: "missing_ubigeo" }, { status: 400 });
    }

    const rows = await listPadronReporte({ ubigeo, tipo, etapas });

    const sections = buildSections();
    const allCols = sections.flatMap((s) => s.cols);

    const now = new Date();
    const generatedAt = now.toISOString().slice(0, 19).replace("T", " ");
    const tipoLabel = tipo === 1 ? "Niños" : "Gestantes";

    const etapasLabel = etapas
      .slice()
      .sort()
      .map((e) => e.slice(0, 7))
      .join("_");

    const filename = cleanFilename(
      `reporte_padron_${tipoLabel}_${session.tipo === "SUPER ADMIN" ? "todos_ubigeos" : `ubigeo_${ubigeo}`}_${etapasLabel}.xls`,
    );

    const sectionHeaderRow = `<tr>${sections
      .map(
        (s) =>
          `<th colspan="${s.cols.length}" style="background:${s.color};border:1px solid #d4d4d8;font-weight:700;text-align:center;padding:6px 8px">${escapeHtml(s.label)}</th>`,
      )
      .join("")}</tr>`;

    const colHeaderRow = `<tr>${allCols
      .map(
        (c) =>
          `<th style="background:#111827;color:#ffffff;border:1px solid #0b1220;font-weight:700;text-align:left;padding:6px 8px;white-space:nowrap">${escapeHtml(c.label)}</th>`,
      )
      .join("")}</tr>`;

    const dataRows = rows
      .map((r, idx) => {
        const cells = allCols.map((c) => c.cell(r, idx)).join("");
        const bg = idx % 2 === 0 ? "#ffffff" : "#fafafa";
        return `<tr style="background:${bg}">${cells}</tr>`;
      })
      .join("");

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(filename)}</title>
    <style>
      body { font-family: Arial, sans-serif; }
      table { border-collapse: collapse; }
      td { border: 1px solid #e5e7eb; padding: 4px 6px; font-size: 10pt; vertical-align: top; }
      th { font-size: 10pt; }
      .meta td { border: 0; padding: 2px 0; font-size: 10pt; }
    </style>
  </head>
  <body>
    <table class="meta">
      <tr><td><b>Reporte:</b> Padrón nominal</td></tr>
      <tr><td><b>Generado:</b> ${escapeHtml(generatedAt)}</td></tr>
      <tr><td><b>Rol:</b> ${escapeHtml(session.tipo)}</td></tr>
      <tr><td><b>Ubigeo:</b> ${escapeHtml(session.tipo === "SUPER ADMIN" ? "TODOS" : String(ubigeo))}</td></tr>
      <tr><td><b>Tipo:</b> ${escapeHtml(`${tipoLabel} (tipo=${tipo})`)}</td></tr>
      <tr><td><b>Etapas:</b> ${escapeHtml(etapas.slice().sort().join(", "))}</td></tr>
      <tr><td><b>Total filas:</b> ${escapeHtml(rows.length)}</td></tr>
    </table>
    <br />
    <table>
      <thead>
        ${sectionHeaderRow}
        ${colHeaderRow}
      </thead>
      <tbody>
        ${dataRows}
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
  } catch (e) {
    console.error("padron_excel_failed", e);
    return NextResponse.json({ error: "padron_excel_failed" }, { status: 500 });
  }
}

