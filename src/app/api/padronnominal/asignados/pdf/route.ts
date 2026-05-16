import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getSession } from "@/lib/auth";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";
import { listAsignadosPorActorForPdf } from "@/lib/padronnominal";
import { findActorSocialByDni, findCoordinadorByDni } from "@/lib/persona";

export const runtime = "nodejs";

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

function diffAgeParts(birth: Date, asOf: Date) {
  const b = new Date(Date.UTC(birth.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()));
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

function ultimaAtencion(r: any) {
  return (
    r.fechamodificacion2 ||
    r.fechamodificacion ||
    r.fecha_fin_vd ||
    r.tercera_vd ||
    r.segunda_vd ||
    r.primera_vd ||
    null
  );
}

function safeText(v: unknown, fallback = "-") {
  const s = String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if (!s) return fallback;
  return s.length > 420 ? `${s.slice(0, 417)}...` : s;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (
      session.tipo !== "ADMINISTRADOR" &&
      session.tipo !== "COORDINADOR" &&
      session.tipo !== "SUPER ADMIN"
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const actorDni = String(url.searchParams.get("actor") ?? "").trim();
    if (!actorDni) {
      return NextResponse.json({ error: "invalid_actor" }, { status: 400 });
    }

    const actor = await findActorSocialByDni(actorDni);
    if (!actor) {
      return NextResponse.json({ error: "actor_not_found" }, { status: 404 });
    }
    const actorUbigeo =
      actor.ubigeo == null ? null : Number(String(actor.ubigeo).trim());
    if (!Number.isFinite(actorUbigeo)) {
      return NextResponse.json({ error: "actor_missing_ubigeo" }, { status: 400 });
    }

    const ubigeo = session.tipo === "SUPER ADMIN" ? actorUbigeo : session.ubigeo;
    if (!ubigeo) {
      return NextResponse.json({ error: "missing_ubigeo" }, { status: 400 });
    }
    if (session.tipo !== "SUPER ADMIN" && actorUbigeo !== ubigeo) {
      return NextResponse.json({ error: "actor_outside_ubigeo" }, { status: 403 });
    }

    const sel = await getEtapaSeleccionadaPorUbigeo(ubigeo);
    const etapa = sel?.etapa ?? "";
    if (!etapa) {
      return NextResponse.json({ error: "missing_etapa" }, { status: 400 });
    }

    const cdr = String(actor.cdr ?? "").trim();
    if (session.tipo === "COORDINADOR" && cdr !== session.dni) {
      return NextResponse.json({ error: "actor_not_owned" }, { status: 403 });
    }

    const coordinador = cdr ? await findCoordinadorByDni(cdr) : null;
    const coordinadorNombre = coordinador
      ? safeText(
          `${coordinador.nombrecompleto ?? ""} ${coordinador.apellidos ?? ""}`.trim() ||
            coordinador.dni,
          "",
        )
      : safeText(cdr || "", "");

    const rows = await listAsignadosPorActorForPdf({
      ubigeo,
      etapa,
      actor: actor.dni,
      limit: 2000,
    });

    const actorNombre = safeText(
      `${actor.nombrecompleto ?? ""} ${actor.apellidos ?? ""}`.trim() || actor.dni,
    );

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 18,
    });
    const chunks: Buffer[] = [];
    const bufferPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (e) => reject(e));
    });

    const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    const asOfDate = toDate(etapa) ?? new Date();

    const title = "Hoja de Ruta - Asignación de Visita Domiciliaria (SinAnemia)";

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const left = doc.page.margins.left;
    const right = doc.page.margins.right;
    const top = doc.page.margins.top;
    const bottom = doc.page.margins.bottom;
    const usableW = pageW - left - right;

    const headerBlock = () => {
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text(title, left, top, {
        width: usableW,
      });
      doc.font("Helvetica").fontSize(8).fillColor("#374151");
      doc.text(`Generado: ${generatedAt}`, left, top + 16);
      doc.text(`Ubigeo: ${ubigeo}   Etapa: ${etapa}`, left, top + 28);
      doc.text(`Actor social: ${actorNombre} (${safeText(actor.dni, "")})`, left, top + 40);
      doc.text(
        `Responsable (coordinador): ${coordinadorNombre}${cdr ? ` (${safeText(cdr, "")})` : ""}`,
        left,
        top + 52,
      );
      doc
        .moveTo(left, top + 66)
        .lineTo(pageW - right, top + 66)
        .strokeColor("#CBD5E1")
        .stroke();
    };

    const cols = [
      { key: "n", label: "N°", w: 20 },
      { key: "form", label: "Form.", w: 70 },
      { key: "dni", label: "DNI", w: 70 },
      { key: "menor", label: "NOMBRE Y DIRECCIÓN DEL MENOR", w: 280 },
      { key: "eess", label: "EESS", w: 120 },
      { key: "madre", label: "DATOS (MADRE)", w: 150 },
      { key: "vd", label: "Fechas VD", w: usableW - (20 + 70 + 70 + 280 + 120 + 150) },
    ];

    const drawTableHeader = (y: number) => {
      let x = left;
      doc.save();
      doc.rect(left, y, usableW, 16).fill("#1D4ED8");
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8);
      for (const c of cols) {
        doc.text(c.label, x + 4, y + 4, { width: c.w - 8, lineBreak: false });
        x += c.w;
      }
      doc.restore();
      doc
        .moveTo(left, y + 16)
        .lineTo(pageW - right, y + 16)
        .strokeColor("#93C5FD")
        .stroke();
    };

    const minY = top + 74;
    const maxY = pageH - bottom;
    const ensureRow = (y: number, rowH: number) => {
      if (y + rowH <= maxY) return y;
      doc.addPage();
      headerBlock();
      const newY = minY;
      drawTableHeader(newY);
      return newY + 18;
    };

    headerBlock();
    let y = minY;
    drawTableHeader(y);
    y += 18;

    doc.font("Helvetica").fontSize(7).fillColor("#111827");

    rows.forEach((r: any, idx: number) => {
      const birth = toDate(r.fecha_nac);
      const age = birth ? diffAgeParts(birth, asOfDate) : null;
      const ageLine = age
        ? `Edad: ${age.years}a ${age.months}m ${age.days}d`
        : "Edad: -";
      const ageDays = age ? `Días: ${age.totalDays}` : "Días: -";

      const yTop = y;

      let x = left;

      const rango = safeText(r.rango, "-");
      const menor = safeText(r.nombres, "-");
      const dir = safeText(r.direccion, "-");
      const ref = safeText(r.referencia, "-");
      const telMadre = safeText(r.telefonopn ?? r.telefono, "-");
      const madre = safeText(
        `${r.nombresmadre ?? ""} ${r.appatmadre ?? ""} ${r.apmatmadre ?? ""}`.trim(),
        "-",
      );
      const ult = safeText(fmtDateDMY(ultimaAtencion(r)), "-");
      const resultado = safeText(r.estadosvd ?? r.estadovd, "-");

      const dmyNac = fmtDateDMY(r.fecha_nac) || "-";
      const dmy1 = fmtDateDMY(r.primera_vd) || "___/___/____";
      const dmy2 = fmtDateDMY(r.segunda_vd) || "___/___/____";
      const dmy3 = fmtDateDMY(r.tercera_vd) || "___/___/____";

      const rowCells: Array<{ text: string; bold?: boolean; w: number }> = [
        { w: cols[0].w, text: String(idx + 1) },
        {
          w: cols[1].w,
          text: `${rango}\nNRO VD: ${safeText(r.nrovd, "-")}\nF.N: ${dmyNac}\n${ageLine}\n${ageDays}`,
        },
        { w: cols[2].w, text: `${safeText(r.dni)}\n(DNI o CUI)` },
        {
          w: cols[3].w,
          bold: true,
          text: `${menor}\n${dir}\nRef: ${ref}\nNueva Dirección: __________________________\nEstado/Resultado: ${resultado}`,
        },
        { w: cols[4].w, text: `EESS: ${safeText(r.eess_ua)}\nF.A: ${ult}` },
        { w: cols[5].w, text: `${madre}\nDNI: ${safeText(r.dnimadre)}\nTel: ${telMadre}` },
        { w: cols[6].w, text: `1ra: ${dmy1}\n2da: ${dmy2}\n3ra: ${dmy3}` },
      ];

      const paddingY = 2;
      const paddingX = 3;
      const lineGap = 0;

      const heights = rowCells.map((c) => {
        doc.font(c.bold ? "Helvetica-Bold" : "Helvetica").fontSize(7);
        return doc.heightOfString(c.text, { width: c.w - paddingX * 2, lineGap });
      });
      const contentH = Math.max(...heights, 18);
      const rowH = Math.max(44, Math.ceil(contentH + paddingY * 2));

      y = ensureRow(y, rowH);

      doc.save();
      doc.rect(left, y, usableW, rowH).fill(idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC");
      doc.restore();

      let cx = left;
      for (const c of rowCells) {
        doc.font(c.bold ? "Helvetica-Bold" : "Helvetica").fontSize(7).fillColor("#111827");
        doc.text(c.text, cx + paddingX, y + paddingY, {
          width: c.w - paddingX * 2,
          lineGap,
        });
        cx += c.w;
      }

      doc
        .moveTo(left, y + rowH)
        .lineTo(pageW - right, y + rowH)
        .strokeColor("#93C5FD")
        .stroke();

      y += rowH;
    });

    doc.end();
    const buffer = await bufferPromise;

    const filename = `hoja_de_ruta_${safeText(actor.dni, "actor")}_${etapa}.pdf`
      .replaceAll(":", "-")
      .replaceAll(" ", "_");
    const body = new Uint8Array(buffer);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("pdf_failed", e);
    return NextResponse.json({ error: "pdf_failed" }, { status: 500 });
  }
}

