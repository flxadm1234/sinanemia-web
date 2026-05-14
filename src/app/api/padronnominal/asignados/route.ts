import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";
import { listAsignadosPorActor } from "@/lib/padronnominal";
import { findActorSocialByDni } from "@/lib/persona";

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

  const rows = await listAsignadosPorActor({
    ubigeo,
    etapa,
    actor: actor.dni,
    limit: 1000,
  });

  return NextResponse.json({
    ubigeo,
    etapa,
    actor: {
      dni: actor.dni,
      nombre:
        `${actor.nombrecompleto ?? ""} ${actor.apellidos ?? ""}`.trim() || actor.dni,
      cdr: cdr || null,
    },
    rows,
  });
}

