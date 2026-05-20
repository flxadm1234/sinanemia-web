import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureVisitasTables, getVisitasJobById } from "@/lib/visitasImport";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureVisitasTables();
  const { id } = await ctx.params;
  const job = await getVisitasJobById(String(id ?? ""));
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, job });
}

