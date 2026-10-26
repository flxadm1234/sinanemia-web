import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { consultaTamizajePorDni } from "@/lib/consultaTamizaje";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (
    session.tipo !== "ADMINISTRADOR" &&
    session.tipo !== "COORDINADOR" &&
    session.tipo !== "SUPER ADMIN" &&
    session.tipo !== "SUPERVISOR"
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const dni = String(url.searchParams.get("dni") ?? "").trim();
  if (!dni) return NextResponse.json({ error: "missing_dni" }, { status: 400 });

  const ubigeo =
    session.tipo === "SUPER ADMIN" || session.tipo === "SUPERVISOR"
      ? null
      : typeof session.ubigeo === "number"
        ? session.ubigeo
        : null;

  const data = await consultaTamizajePorDni({ dni, ubigeo });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ data });
}

