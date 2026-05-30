import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensurePadronDniTables, getPadronDniJob } from "@/lib/padronDniImport";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.tipo === "COORDINADOR" || session.tipo === "ACTOR SOCIAL")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await ensurePadronDniTables();
  const { id } = await ctx.params;
  const job = await getPadronDniJob(String(id || "").trim());
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, job });
}

