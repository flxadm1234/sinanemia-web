import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listDashboardMonthsByUbigeo } from "@/lib/dashboard";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const ubigeoParam = String(url.searchParams.get("ubigeo") ?? "").trim();

  const ubigeo =
    session.tipo === "SUPER ADMIN" || session.tipo === "SUPERVISOR"
      ? ubigeoParam
      : String(session.ubigeo ?? "").trim();

  if (!ubigeo) return NextResponse.json({ months: [] });

  const months = await listDashboardMonthsByUbigeo(ubigeo, 24);
  return NextResponse.json({ months });
}

