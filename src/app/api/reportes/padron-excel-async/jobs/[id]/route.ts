import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureReportExportJobsTable, getReportExportJobById } from "@/lib/reportExportJobs";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  if (session.tipo !== "SUPER ADMIN" && session.tipo !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  await ensureReportExportJobsTable();

  const { id } = await ctx.params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId) || jobId <= 0) return NextResponse.json({ error: "Id inválido." }, { status: 400 });

  const job = await getReportExportJobById(jobId);
  if (!job || job.tipo !== "padron-excel") return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  if (session.tipo !== "SUPER ADMIN" && job.created_by && job.created_by !== session.dni) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
    ready: job.status === "done" && !!job.file_path,
    failed: job.status === "failed",
  });
}

