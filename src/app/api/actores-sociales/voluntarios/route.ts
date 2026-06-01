import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { findCoordinadorByDni } from "@/lib/persona";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "SUPER ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const ubigeoParam = String(url.searchParams.get("ubigeo") ?? "").trim();
  const ubigeoRequested = ubigeoParam ? Number(ubigeoParam) : undefined;

  const ubigeoFilter = session.tipo === "SUPER ADMIN" ? ubigeoRequested : (session.ubigeo ?? undefined);
  const ubigeo = Number(ubigeoFilter);
  if (!Number.isFinite(ubigeo) || ubigeo <= 0) {
    return NextResponse.json({ error: "invalid_ubigeo" }, { status: 400 });
  }

  const pool = getDbPool();
  const [rows] = await pool.query(
    `SELECT dni, nombrecompleto, apellidos, cdr, ubigeo
     FROM persona
     WHERE ubigeo = ?
       AND UPPER(tipo) LIKE 'ACTOR SOCIAL%'
       AND estado = 1
       AND voluntario = 1
     ORDER BY apellidos ASC, nombrecompleto ASC`,
    [ubigeo],
  );

  const coordCache = new Map<string, string>();
  return NextResponse.json(
    await Promise.all(
      (rows as any[]).map(async (r) => {
        const nombre = `${r.nombrecompleto ?? ""} ${r.apellidos ?? ""}`.trim() || r.dni;
        const cdr = r.cdr ? String(r.cdr) : null;
        let coordinadorNombre: string | null = null;
        if (cdr) {
          if (coordCache.has(cdr)) {
            coordinadorNombre = coordCache.get(cdr) ?? null;
          } else {
            const c = await findCoordinadorByDni(cdr);
            const cn = c ? `${c.nombrecompleto ?? ""} ${c.apellidos ?? ""}`.trim() || c.dni : cdr;
            coordCache.set(cdr, cn);
            coordinadorNombre = cn;
          }
        }
        return { dni: String(r.dni ?? ""), nombre, cdr, coordinadorNombre, ubigeo: Number(r.ubigeo ?? 0) || null };
      }),
    ),
  );
}

