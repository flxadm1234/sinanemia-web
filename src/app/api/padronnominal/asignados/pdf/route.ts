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

    const doc = new PDFDocument({ size: "A4", margin: 38 });
    const chunks: Buffer[] = [];
    const bufferPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (e) => reject(e));
    });

    const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    const title = "Hoja de Ruta de Intervención - Niños asignados (SinAnemia)";
    doc.fontSize(14).fillColor("#111827").text(title, { align: "left" });
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor("#374151").text(`Generado: ${generatedAt}`);
    doc.text(`Ubigeo: ${ubigeo}   Etapa: ${etapa}`);
    doc.text(`Actor social: ${actorNombre} (${safeText(actor.dni, "")})`);
    doc.text(
      `Responsable (coordinador): ${coordinadorNombre}${cdr ? ` (${safeText(cdr, "")})` : ""}`,
    );
    doc.moveDown(0.8);

    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor("#E5E7EB")
      .stroke();
    doc.moveDown(0.8);

    doc.fontSize(10).fillColor("#111827").text(`Total: ${rows.length} registros`);
    doc.moveDown(0.6);

    const boxPadding = 10;
    const pageBottom = () => doc.page.height - doc.page.margins.bottom;

    const ensureSpace = (needed: number) => {
      if (doc.y + needed <= pageBottom()) return;
      doc.addPage();
    };

    rows.forEach((r: any, idx: number) => {
      const pairs = asKeyValuePairs(r);
      const headerH = 22;
      const blockHeight = 312;
      ensureSpace(blockHeight + 10);

      const x = doc.page.margins.left;
      const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const y = doc.y;

      doc
        .roundedRect(x, y, w, blockHeight, 10)
        .fillOpacity(1)
        .fillAndStroke("#F9FAFB", "#E5E7EB");

      doc.fillOpacity(1);
      doc.fontSize(9).fillColor("#111827").text(
        `${idx + 1}. ${safeText(r.nombres)} (${safeText(r.dni)})`,
        x + boxPadding,
        y + 10,
        { width: w - boxPadding * 2 },
      );

      doc
        .moveTo(x + boxPadding, y + headerH)
        .lineTo(x + w - boxPadding, y + headerH)
        .strokeColor("#E5E7EB")
        .stroke();

      drawKeyValueGrid({
        doc,
        x: x + boxPadding,
        y: y + headerH + 8,
        w: w - boxPadding * 2,
        pairs,
      });

      doc.y = y + blockHeight + 12;
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

