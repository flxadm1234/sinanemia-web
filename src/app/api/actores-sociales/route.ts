import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listActoresSociales } from "@/lib/persona";
import { findCoordinadorByDni } from "@/lib/persona";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (
    session.tipo !== "ADMINISTRADOR" &&
    session.tipo !== "SUPER ADMIN" &&
    session.tipo !== "COORDINADOR"
  ) {
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

  const cdrFilter = session.tipo === "COORDINADOR" ? session.dni : undefined;

  const rows = await listActoresSociales({ ubigeo: ubigeoFilter, cdr: cdrFilter });
  const coordCache = new Map<string, string>();
  return NextResponse.json(
    await Promise.all(
      rows.map(async (r) => {
        const nombre = `${r.nombrecompleto ?? ""} ${r.apellidos ?? ""}`.trim() || r.dni;
        const cdr = (r as any).cdr ?? null;
        let coordinadorNombre: string | null = null;
        if (cdr && typeof cdr === "string") {
          if (coordCache.has(cdr)) {
            coordinadorNombre = coordCache.get(cdr) ?? null;
          } else {
            const c = await findCoordinadorByDni(cdr);
            const cn = c
              ? `${c.nombrecompleto ?? ""} ${c.apellidos ?? ""}`.trim() || c.dni
              : cdr;
            coordCache.set(cdr, cn);
            coordinadorNombre = cn;
          }
        }
        return {
          idpersona: r.idpersona,
          dni: r.dni,
          nombre,
          ubigeo: r.ubigeo,
          cdr,
          coordinadorNombre,
        };
      }),
    ),
  );
}

