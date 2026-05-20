import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensurePadronVdTables, getPadronVdJobById } from "@/lib/padronVdImport";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (
    session.tipo !== "ADMINISTRADOR" &&
    session.tipo !== "SUPER ADMIN" &&
    session.tipo !== "INVITADO"
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await ensurePadronVdTables();
  const { id } = await ctx.params;
  const job = await getPadronVdJobById(String(id ?? ""));
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, job });
}

