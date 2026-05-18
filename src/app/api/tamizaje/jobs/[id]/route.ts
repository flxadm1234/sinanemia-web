import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureTamizajeTables, getTamizajeJobById } from "@/lib/tamizaje";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (session.tipo !== "ADMINISTRADOR" && session.tipo !== "SUPER ADMIN") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await ensureTamizajeTables();
    const { id } = await context.params;
    const jobId = String(id ?? "").trim();
    if (!jobId) return NextResponse.json({ error: "invalid_job" }, { status: 400 });

    const job = await getTamizajeJobById(jobId);
    if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    console.error("tamizaje_job_failed", e);
    return NextResponse.json({ error: "tamizaje_job_failed" }, { status: 500 });
  }
}

