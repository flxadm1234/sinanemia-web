import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dniBelongsToUbigeo, ensureRegistrosHemoglobinaTable } from "@/lib/carnets";
import { createRegistroHemoglobina, listRegistrosHemoglobinaByDni } from "@/lib/registrosHemoglobina";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "COORDINADOR")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (typeof session.ubigeo !== "number") return NextResponse.json({ error: "missing_ubigeo" }, { status: 400 });

  const url = new URL(request.url);
  const dni = String(url.searchParams.get("dni") ?? "").trim();
  if (!dni) return NextResponse.json({ error: "missing_dni" }, { status: 400 });

  const ok = await dniBelongsToUbigeo({ ubigeo: session.ubigeo, dni });
  if (!ok) return NextResponse.json({ error: "forbidden_dni" }, { status: 403 });

  await ensureRegistrosHemoglobinaTable();
  const rows = await listRegistrosHemoglobinaByDni(dni);
  return NextResponse.json({ ok: true, rows });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "COORDINADOR")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (typeof session.ubigeo !== "number") return NextResponse.json({ error: "missing_ubigeo" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as any;
  const dni = String(body?.dni ?? "").trim();
  const fecha_examen = body?.fecha_examen == null ? null : String(body?.fecha_examen).slice(0, 10);
  const edad = body?.edad == null ? null : String(body?.edad);
  const resultado = body?.resultado == null ? null : String(body?.resultado);
  const tipoRaw = Number(body?.tipo ?? 1);
  const tipo = tipoRaw === 2 ? 2 : 1;

  if (!dni) return NextResponse.json({ error: "missing_dni" }, { status: 400 });

  const ok = await dniBelongsToUbigeo({ ubigeo: session.ubigeo, dni });
  if (!ok) return NextResponse.json({ error: "forbidden_dni" }, { status: 403 });

  await ensureRegistrosHemoglobinaTable();
  await createRegistroHemoglobina({ dni, fecha_examen, edad, resultado, tipo });
  return NextResponse.json({ ok: true });
}

