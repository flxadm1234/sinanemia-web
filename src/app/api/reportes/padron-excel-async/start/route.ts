import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  ensureReportExportJobsTable,
  createReportExportJob,
  getReportExportJobById,
  markReportExportJobFailed,
  markReportExportJobRunning,
} from "@/lib/reportExportJobs";
import { getUploadsDir } from "@/lib/uploads";
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

export const runtime = "nodejs";

function parseEtapas(v: unknown) {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? String(v).split(",") : [];
  return raw.map((x) => String(x ?? "").trim()).filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e));
}

function parseUbigeos(v: unknown) {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? String(v).split(",") : [];
  return raw
    .map((x) => Number(String(x ?? "").trim()))
    .filter((n) => Number.isFinite(n));
}

async function startPythonJob(params: { jobId: number; args: string[]; logPath: string }) {
  const pythonBin = process.env.PADRON_REPORTE_PYTHON_BIN
    ? String(process.env.PADRON_REPORTE_PYTHON_BIN)
    : process.env.TAMIZAJE_PYTHON_BIN
      ? String(process.env.TAMIZAJE_PYTHON_BIN)
      : "python3";

  const script = process.env.PADRON_REPORTE_EXPORT_SCRIPT
    ? String(process.env.PADRON_REPORTE_EXPORT_SCRIPT)
    : path.join("python", "padron_reporte_exporter.py");

  const logStream = await fs.open(params.logPath, "a");
  const writeLog = async (line: string) => {
    try {
      await logStream.appendFile(`[${new Date().toISOString()}] ${line}\n`);
    } catch {}
  };

  const child = spawn(pythonBin, [script, ...params.args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PADRON_REPORTE_LOG_PATH: params.logPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.on("error", async (e) => {
    await writeLog(`spawn error: ${String((e as any)?.message ?? e)}`);
    try {
      const job = await getReportExportJobById(params.jobId);
      if (job && job.status !== "done" && job.status !== "failed") {
        await markReportExportJobFailed({
          id: params.jobId,
          message: `No se pudo iniciar el proceso: ${String((e as any)?.message ?? e)}`,
        });
      }
    } catch {}
  });

  child.stdout?.on("data", async (d) => {
    try {
      await logStream.appendFile(d);
    } catch {}
  });
  child.stderr?.on("data", async (d) => {
    try {
      await logStream.appendFile(d);
    } catch {}
  });
  child.on("close", async (code) => {
    try {
      const job = await getReportExportJobById(params.jobId);
      if (job && job.status !== "done" && job.status !== "failed") {
        await markReportExportJobFailed({
          id: params.jobId,
          message: `El proceso terminó inesperadamente (code=${code ?? "null"}). Revisa el log del job.`,
        });
      }
    } catch {}
    try {
      await logStream.close();
    } catch {}
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  if (session.tipo !== "SUPER ADMIN" && session.tipo !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  await ensureReportExportJobsTable();

  try {
    const body = await req.json().catch(() => ({}));
    const tipo = String(body?.tipo ?? "").trim();
    const etapas = parseEtapas(body?.etapas);
    if (tipo !== "1" && tipo !== "2") {
      return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
    }
    if (!etapas.length) {
      return NextResponse.json({ error: "Selecciona al menos un mes." }, { status: 400 });
    }

    let ubigeos: number[] = [];
    if (session.tipo === "SUPER ADMIN") {
      ubigeos = parseUbigeos(body?.ubigeos);
    } else if (session.ubigeo) {
      ubigeos = [session.ubigeo];
    }

    const reportsDir = getUploadsDir("reportes");
    await fs.mkdir(reportsDir, { recursive: true });
    const logsDir = getUploadsDir("reportes_logs");
    await fs.mkdir(logsDir, { recursive: true });

    const job = await createReportExportJob({
      tipo: "padron-excel",
      params: { tipo, etapas, ubigeos },
      createdBy: session.dni,
    });
    if (!job) return NextResponse.json({ error: "No se pudo crear el job." }, { status: 400 });

    const jobId = Number(job.id);
    const logPath = path.join(logsDir, `padron-excel-${jobId}.log`);
    const outPath = path.join(reportsDir, `padron-excel-${jobId}.xlsx`);

    await markReportExportJobRunning({ id: jobId, message: "Iniciando proceso de exportación..." });

    await startPythonJob({
      jobId,
      logPath,
      args: ["--job_id", String(jobId), "--out_path", outPath],
    });

    return NextResponse.json({ jobId });
  } catch {
    return NextResponse.json({ error: "No se pudo iniciar la generación." }, { status: 400 });
  }
}
