import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listActoresSociales } from "@/lib/persona";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "SUPER ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const ubigeoParam = url.searchParams.get("ubigeo");
  const ubigeoRequested =
    ubigeoParam && ubigeoParam.trim() ? Number(ubigeoParam) : undefined;

  const ubigeoFilter =
    session.tipo === "SUPER ADMIN"
      ? ubigeoRequested
      : session.ubigeo ?? undefined;

  const rows = await listActoresSociales({ ubigeo: ubigeoFilter });
  return NextResponse.json(
    rows.map((r) => ({
      idpersona: r.idpersona,
      dni: r.dni,
      nombre: `${r.nombrecompleto ?? ""} ${r.apellidos ?? ""}`.trim() || r.dni,
      ubigeo: r.ubigeo,
    })),
  );
}

