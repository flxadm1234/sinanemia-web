import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getSession } from "@/lib/auth";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";
import { listAsignadosPorActorForPdf } from "@/lib/padronnominal";
import { findActorSocialByDni, findCoordinadorByDni } from "@/lib/persona";

export const runtime = "nodejs";

function fmtDate(v: string | null) {
  if (!v) return "";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function fmtDateDMY(v: string | null) {
  const s = fmtDate(v);
  if (!s || s.length !== 10) return "";
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
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

function asKeyValuePairs(r: any) {
  const madre = `${r.nombresmadre ?? ""} ${r.appatmadre ?? ""} ${r.apmatmadre ?? ""}`.trim();
  return [
    ["IDPN", r.idpn],
    ["DNI", r.dni],
    ["Nombres", r.nombres],
    ["F. nac.", fmtDate(r.fecha_nac)],
    ["Rango", r.rango],
    ["CCPP", r.ccpp],
    ["Zona", r.zona],
    ["Mz", r.mz],
    ["Dirección", r.direccion],
    ["Referencia", r.referencia],
    ["Nueva dirección", r.nuevadireccion],
    ["Nueva referencia", r.nuevareferencia],
    ["Teléfono", r.telefonopn ?? r.telefono],
    ["EESS UA", r.eess_ua],
    ["Cod EESS", r.codeess],
    ["Departamento", r.departamento],
    ["Provincia", r.provincia],
    ["Distrito", r.distrito],
    ["Ubigeo", r.ubigeo],
    ["Actor social", r.actorsocial],
    ["Responsable", r.responsable],
    ["Estado VD", r.estadovd],
    ["Estado SVD", r.estadosvd],
    ["Estado SVD2", r.estadosvd2],
    ["Estado SVD3", r.estadosvd3],
    ["Etapa", fmtDate(r.etapa)],
    ["F. cita", fmtDate(r.fechacita)],
    ["Nro VD", r.nrovd],
    ["F. inicio VD", fmtDate(r.fecha_inicio_vd)],
    ["F. fin VD", fmtDate(r.fecha_fin_vd)],
    ["Primera VD", fmtDate(r.primera_vd)],
    ["Segunda VD", fmtDate(r.segunda_vd)],
    ["Tercera VD", fmtDate(r.tercera_vd)],
    ["F. modif.", fmtDate(r.fechamodificacion)],
    ["F. modif.2", fmtDate(r.fechamodificacion2)],
    ["Madre", madre],
    ["DNI madre", r.dnimadre],
    ["Padre", r.nombre_padre],
    ["DNI padre", r.dni_padre],
    ["Observación", r.observacion],
    ["Obs. padrón", r.obspadron],
    ["Observación 2", r.observacion2],
    ["Tamisaje", r.tamisaje],
    ["F. tamisaje", fmtDate(r.fechatamisaje)],
    ["HB", r.hb],
    ["Anemia", r.anemia],
    ["Hierro", r.hierro],
    ["TSF", r.tsf],
    ["RSF", r.rsf],
    ["Resultado", r.resultado],
    ["Avance", r.avance],
    ["Tiene PS", r.tieneps],
    ["Visita DOPS", r.visitadops],
    ["Sesión DEM", r.sesiondem],
    ["Modo VD", r.modovd],
    ["Tipo VD", r.tipovd],
    ["Cod QR", r.codqr],
    ["Lat", r.lat],
    ["Lon", r.lon],
    ["Lat2", r.lat2],
    ["Long2", r.long2],
    ["Lat3", r.lat3],
    ["Long3", r.long3],
    ["Programación", fmtDate(r.programacion1)],
    ["Asignación", r.asignacion],
    ["Estado intervención", r.estadointervencion],
    ["Padron nominal", r.padronnominal],
    ["Adulto", r.adulto],
    ["Cantidad A", r.cantidada],
    ["Id distrito", r.iddistrito],
    ["Discapacidad", r.discapacidad],
    ["Titular línea", r.titular_linea],
    ["Código V", r.codigov],
    ["Img carnet", r.img_carnet],
    ["Estado verificación", r.estado_verificacion],
    ["Estado", r.estado],
    ["Estado verificado", r.estado_verificado],
    ["Celular app", r.celularseapp],
    ["Tipo dispositivo", r.tipodispositivo],
    ["Tipo seguro", r.tiposeguro],
    ["Estado seguro", r.estadoseguro],
    ["F. act seguro", fmtDate(r.fecha_act_seguro)],
    ["Nombre comercial", r.nombre_comercial],
    ["HB registro", r.hbregistro],
    ["CCRED", r.ccred],
    ["Usuario", r.usuario],
  ] as Array<[string, unknown]>;
}

function drawKeyValueGrid(params: {
  doc: InstanceType<typeof PDFDocument>;
  x: number;
  y: number;
  w: number;
  pairs: Array<[string, unknown]>;
}) {
  const { doc, x, y, w, pairs } = params;
  const colGap = 10;
  const colW = (w - colGap) / 2;
  const labelW = 86;
  const lineH = 9.6;

  let leftY = y;
  let rightY = y;
  for (let i = 0; i < pairs.length; i++) {
    const [k, v] = pairs[i];
    const col = i % 2;
    const baseX = col === 0 ? x : x + colW + colGap;
    const baseY = col === 0 ? leftY : rightY;

    doc.fontSize(7).fillColor("#111827").text(`${k}:`, baseX, baseY, {
      width: labelW,
      continued: false,
    });
    doc.fontSize(7).fillColor("#374151").text(safeText(v, "-"), baseX + labelW, baseY, {
      width: colW - labelW,
      height: lineH,
    });

    doc.fontSize(7);
    const used = Math.max(
      doc.heightOfString(`${k}:`, { width: labelW }),
      doc.heightOfString(safeText(v, "-"), { width: colW - labelW }),
      lineH,
    );

    if (col === 0) leftY = baseY + Math.max(used, lineH);
    else rightY = baseY + Math.max(used, lineH);
  }
  return Math.max(leftY, rightY);
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

    const rowH = 78;
    const minY = top + 74;
    const maxY = pageH - bottom;
    const ensureRow = (y: number) => {
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
      y = ensureRow(y);
      const yTop = y;

      let x = left;
      doc.save();
      doc.rect(left, yTop, usableW, rowH).fill(idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC");
      doc.restore();

      const cell = (w: number, text: string, opts?: { bold?: boolean }) => {
        doc.font(opts?.bold ? "Helvetica-Bold" : "Helvetica").fontSize(7).fillColor("#111827");
        doc.text(text, x + 4, yTop + 4, {
          width: w - 8,
          height: rowH - 8,
        });
        x += w;
      };

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

      cell(cols[0].w, String(idx + 1));
      cell(
        cols[1].w,
        `${rango}\nNRO VD: ${safeText(r.nrovd, "-")}\nF.N: ${safeText(fmtDateDMY(r.fecha_nac), "-")}`,
      );
      cell(cols[2].w, `${safeText(r.dni)}\n(DNI o CUI)`);
      cell(
        cols[3].w,
        `${menor}\n${dir}\nRef: ${ref}\nNueva Dirección: __________________________\nEstado/Resultado: ${resultado}`,
        { bold: true },
      );
      cell(
        cols[4].w,
        `EESS: ${safeText(r.eess_ua)}\nF.A: ${ult}`,
      );
      cell(
        cols[5].w,
        `${madre}\nDNI: ${safeText(r.dnimadre)}\nTel: ${telMadre}`,
      );
      cell(
        cols[6].w,
        `1ra: ${safeText(fmtDateDMY(r.primera_vd), "___/___/____")}\n2da: ${safeText(
          fmtDateDMY(r.segunda_vd),
          "___/___/____",
        )}\n3ra: ${safeText(fmtDateDMY(r.tercera_vd), "___/___/____")}`,
      );

      doc
        .moveTo(left, yTop + rowH)
        .lineTo(pageW - right, yTop + rowH)
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

