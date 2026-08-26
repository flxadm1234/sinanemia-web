import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensurePadronHasCarnetFields, getCarnetCounters, listCarnets } from "@/lib/carnets";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "COORDINADOR")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (typeof session.ubigeo !== "number") return NextResponse.json({ error: "missing_ubigeo" }, { status: 400 });

  await ensurePadronHasCarnetFields();

  const url = new URL(request.url);
  const search = String(url.searchParams.get("search") ?? "").trim();
  const status = String(url.searchParams.get("status") ?? "pendiente").trim().toLowerCase();
  const pageRaw = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const pageSize = 30;
  const offset = (page - 1) * pageSize;

  const counters = await getCarnetCounters({
    ubigeo: session.ubigeo,
    search,
    status: status === "confirmado" ? "confirmado" : status === "all" ? "all" : "pendiente",
  });
  const rows = await listCarnets({
    ubigeo: session.ubigeo,
    search,
    status: status === "confirmado" ? "confirmado" : status === "all" ? "all" : "pendiente",
    limit: pageSize,
    offset,
  });

  return NextResponse.json({ ok: true, counters, rows, page, pageSize });
}

