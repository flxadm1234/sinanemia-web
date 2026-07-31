import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureReportExportJobsTable, getReportExportJobById } from "@/lib/reportExportJobs";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

function cleanFilename(s: string) {
  return s.replaceAll(/[^\w\-.,() ]+/g, "_").trim().slice(0, 180);
}

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

  if (job.status !== "done" || !job.file_path) {
    return NextResponse.json({ error: "Aún no está listo." }, { status: 409 });
  }

  const filePath = String(job.file_path);
  try {
    const stat = fs.statSync(filePath);
    const filename = cleanFilename(path.basename(filePath) || `padron-excel-${jobId}.xlsx`);
    const stream = fs.createReadStream(filePath);
    return new NextResponse(stream as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(stat.size),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
  }
}

