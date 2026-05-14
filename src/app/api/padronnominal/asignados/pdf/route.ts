import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getSession } from "@/lib/auth";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";
import { listAsignadosPorActor } from "@/lib/padronnominal";
import { findActorSocialByDni, findCoordinadorByDni } from "@/lib/persona";

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

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "COORDINADOR") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const actorDni = String(url.searchParams.get("actor") ?? "").trim();
  if (!actorDni) {
    return NextResponse.json({ error: "invalid_actor" }, { status: 400 });
  }

  const ubigeo = session.ubigeo;
  if (!ubigeo) {
    return NextResponse.json({ error: "missing_ubigeo" }, { status: 400 });
  }

  const sel = await getEtapaSeleccionadaPorUbigeo(ubigeo);
  const etapa = sel?.etapa ?? "";
  if (!etapa) {
    return NextResponse.json({ error: "missing_etapa" }, { status: 400 });
  }

  const actor = await findActorSocialByDni(actorDni);
  if (!actor) {
    return NextResponse.json({ error: "actor_not_found" }, { status: 404 });
  }
  const actorUbigeo =
    actor.ubigeo == null ? null : Number(String(actor.ubigeo).trim());
  if (!Number.isFinite(actorUbigeo) || actorUbigeo !== ubigeo) {
    return NextResponse.json({ error: "actor_outside_ubigeo" }, { status: 403 });
  }
  const cdr = String(actor.cdr ?? "").trim();
  if (session.tipo === "COORDINADOR" && cdr !== session.dni) {
    return NextResponse.json({ error: "actor_not_owned" }, { status: 403 });
  }

  const coordinador = cdr ? await findCoordinadorByDni(cdr) : null;
  const coordinadorNombre = coordinador
    ? `${coordinador.nombrecompleto ?? ""} ${coordinador.apellidos ?? ""}`.trim() ||
      coordinador.dni
    : cdr || "";

  const rows = await listAsignadosPorActor({
    ubigeo,
    etapa,
    actor: actor.dni,
    limit: 2000,
  });

  const actorNombre =
    `${actor.nombrecompleto ?? ""} ${actor.apellidos ?? ""}`.trim() || actor.dni;

  const doc = new PDFDocument({ size: "A4", margin: 42 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));

  const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  const title = "SinAnemia - Listado de niños asignados";
  doc.fontSize(16).fillColor("#111827").text(title, { align: "left" });
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor("#374151").text(`Generado: ${generatedAt}`);
  doc.text(`Ubigeo: ${ubigeo}   Etapa: ${etapa}`);
  doc.text(`Actor social: ${actorNombre} (${actor.dni})`);
  doc.text(`Responsable (coordinador): ${coordinadorNombre}${cdr ? ` (${cdr})` : ""}`);
  doc.moveDown(0.8);

  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor("#E5E7EB")
    .stroke();
  doc.moveDown(0.8);

  doc.fontSize(11).fillColor("#111827").text(`Total: ${rows.length} registros`);
  doc.moveDown(0.6);

  const boxPadding = 10;
  const pageBottom = () => doc.page.height - doc.page.margins.bottom;

  const ensureSpace = (needed: number) => {
    if (doc.y + needed <= pageBottom()) return;
    doc.addPage();
  };

  rows.forEach((r: any, idx: number) => {
    const madre = `${r.nombresmadre ?? ""} ${r.appatmadre ?? ""} ${r.apmatmadre ?? ""}`.trim();
    const padre = `${r.nombre_padre ?? ""}`.trim();
    const ult = fmtDate(ultimaAtencion(r));

    const blockHeight = 128;
    ensureSpace(blockHeight + 6);

    const x = doc.page.margins.left;
    const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const y = doc.y;

    doc
      .roundedRect(x, y, w, blockHeight, 10)
      .fillOpacity(1)
      .fillAndStroke("#F9FAFB", "#E5E7EB");

    doc.fillOpacity(1);
    doc.fontSize(11).fillColor("#111827");
    doc.text(`${idx + 1}. ${r.nombres ?? "-"}`, x + boxPadding, y + 10, {
      width: w - boxPadding * 2,
    });

    doc.fontSize(9).fillColor("#374151");
    doc.text(
      `DNI: ${r.dni ?? "-"}   F. nac: ${fmtDate(r.fecha_nac) || "-"}   Últ. atención: ${ult || "-"}`,
      x + boxPadding,
      y + 28,
      { width: w - boxPadding * 2 },
    );

    doc.text(
      `Madre: ${madre || "-"}   DNI madre: ${r.dnimadre ?? "-"}`,
      x + boxPadding,
      y + 44,
      { width: w - boxPadding * 2 },
    );
    doc.text(
      `Padre: ${padre || "-"}   DNI padre: ${r.dni_padre ?? "-"}`,
      x + boxPadding,
      y + 58,
      { width: w - boxPadding * 2 },
    );
    doc.text(
      `EESS: ${r.eess_ua ?? "-"}   Teléfono: ${r.telefonopn ?? r.telefono ?? "-"}`,
      x + boxPadding,
      y + 72,
      { width: w - boxPadding * 2 },
    );

    const dir = `${r.direccion ?? ""}`.trim() || "-";
    const ref = `${r.referencia ?? ""}`.trim() || "-";
    doc.text(`Dirección: ${dir}`, x + boxPadding, y + 86, {
      width: w - boxPadding * 2,
    });
    doc.text(`Referencia: ${ref}`, x + boxPadding, y + 100, {
      width: w - boxPadding * 2,
    });

    doc.y = y + blockHeight + 10;
  });

  doc.end();
  const buffer = await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const filename = `asignacion_${actor.dni}_${etapa}.pdf`.replaceAll(":", "-");
  const body = new Uint8Array(buffer);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

