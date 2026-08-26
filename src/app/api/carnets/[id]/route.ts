import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureRegistrosHemoglobinaTable, getCarnetByIdpn, setCarnetEstado } from "@/lib/carnets";
import { listRegistrosHemoglobinaByDni } from "@/lib/registrosHemoglobina";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";

export const runtime = "nodejs";

function parseIdpn(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "COORDINADOR")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (typeof session.ubigeo !== "number") return NextResponse.json({ error: "missing_ubigeo" }, { status: 400 });

  const { id } = await ctx.params;
  const idpn = parseIdpn(id);
  if (!idpn) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  await ensureRegistrosHemoglobinaTable();
  const sel = await getEtapaSeleccionadaPorUbigeo(session.ubigeo);
  if (!sel?.etapa) return NextResponse.json({ error: "missing_etapa" }, { status: 400 });

  const padron = await getCarnetByIdpn({ ubigeo: session.ubigeo, idpn, etapa: sel.etapa });
  if (!padron) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const registros = padron.dni ? await listRegistrosHemoglobinaByDni(padron.dni) : [];
  return NextResponse.json({ ok: true, padron, registros, etapa: sel.etapa });
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "COORDINADOR")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (typeof session.ubigeo !== "number") return NextResponse.json({ error: "missing_ubigeo" }, { status: 400 });

  const { id } = await ctx.params;
  const idpn = parseIdpn(id);
  if (!idpn) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as any;
  const estado = String(body?.estado_verificacion ?? "").trim().toLowerCase();
  const nextEstado = estado === "confirmado" ? "confirmado" : "pendiente";

  const sel = await getEtapaSeleccionadaPorUbigeo(session.ubigeo);
  if (!sel?.etapa) return NextResponse.json({ error: "missing_etapa" }, { status: 400 });

  await setCarnetEstado({ ubigeo: session.ubigeo, idpn, estado: nextEstado as any, etapa: sel.etapa });
  return NextResponse.json({ ok: true });
}
