import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listMesNumeroByUbigeoYear } from "@/lib/meses";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (
    session.tipo !== "SUPER ADMIN" &&
    session.tipo !== "ADMINISTRADOR" &&
    session.tipo !== "SUPERVISOR" &&
    session.tipo !== "INVITADO"
  )
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const ubigeoParam = String(url.searchParams.get("ubigeo") ?? "").trim();
  const yearParam = String(url.searchParams.get("year") ?? "").trim();

  const ubigeo =
    session.tipo === "SUPER ADMIN" || session.tipo === "SUPERVISOR"
      ? ubigeoParam
      : String(session.ubigeo ?? "").trim();
  const year = Number(yearParam);

  if (!/^\d{6}$/.test(ubigeo) || !Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ existing: [] });
  }

  const existing = await listMesNumeroByUbigeoYear({ ubigeo, year });
  return NextResponse.json({ existing });
}

