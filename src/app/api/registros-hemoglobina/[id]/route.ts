import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dniBelongsToUbigeo, ensureRegistrosHemoglobinaTable } from "@/lib/carnets";
import { deleteRegistroHemoglobina, getRegistroHemoglobinaById, updateRegistroHemoglobina } from "@/lib/registrosHemoglobina";

export const runtime = "nodejs";

function parseId(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "COORDINADOR")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (typeof session.ubigeo !== "number") return NextResponse.json({ error: "missing_ubigeo" }, { status: 400 });

  const { id } = await ctx.params;
  const rid = parseId(id);
  if (!rid) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  await ensureRegistrosHemoglobinaTable();
  const prev = await getRegistroHemoglobinaById(rid);
  if (!prev) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const dni = String(prev.dni_consultado ?? prev.dni_extraido ?? "").trim();
  if (!dni) return NextResponse.json({ error: "missing_dni" }, { status: 400 });
  const ok = await dniBelongsToUbigeo({ ubigeo: session.ubigeo, dni });
  if (!ok) return NextResponse.json({ error: "forbidden_dni" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as any;
  const fecha_examen = body?.fecha_examen == null ? null : String(body?.fecha_examen).slice(0, 10);
  const edad = body?.edad == null ? null : String(body?.edad);
  const resultado = body?.resultado == null ? null : String(body?.resultado);
  const tipoRaw = body?.tipo == null ? prev.tipo : Number(body?.tipo);
  const tipo = Number(tipoRaw) === 2 ? 2 : 1;

  await updateRegistroHemoglobina({ id: rid, fecha_examen, edad, resultado, tipo });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "COORDINADOR")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (typeof session.ubigeo !== "number") return NextResponse.json({ error: "missing_ubigeo" }, { status: 400 });

  const { id } = await ctx.params;
  const rid = parseId(id);
  if (!rid) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  await ensureRegistrosHemoglobinaTable();
  const prev = await getRegistroHemoglobinaById(rid);
  if (!prev) return NextResponse.json({ ok: true });

  const dni = String(prev.dni_consultado ?? prev.dni_extraido ?? "").trim();
  if (!dni) return NextResponse.json({ error: "missing_dni" }, { status: 400 });
  const ok = await dniBelongsToUbigeo({ ubigeo: session.ubigeo, dni });
  if (!ok) return NextResponse.json({ error: "forbidden_dni" }, { status: 403 });

  await deleteRegistroHemoglobina(rid);
  return NextResponse.json({ ok: true });
}

