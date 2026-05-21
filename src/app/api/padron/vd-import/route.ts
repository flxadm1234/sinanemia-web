import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensurePadronVdTables, getDefaultPadronVdConfigId, getPadronVdConfig } from "@/lib/padronVdImport";
import { getDbPool } from "@/lib/db";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import { spawn } from "child_process";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

async function writeUploadToDisk(file: File, jobId: string) {
  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(os.tmpdir(), "sinanemia_uploads", "padron_vd");
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(file.name || "").toLowerCase();
  if (ext !== ".xls" && ext !== ".xlsx") {
    throw new Error("invalid_excel_extension");
  }
  if (ext === ".xlsx") {
    const filePath = path.join(dir, `${jobId}.xlsx`);
    await fs.writeFile(filePath, buf);
    return filePath;
  }
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer" });
  } catch {
    throw new Error("invalid_xls");
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  const filePath = path.join(dir, `${jobId}.xlsx`);
  await fs.writeFile(filePath, out);
  return filePath;
}

async function startPythonJob(params: { jobId: string; filePath: string; configId: number }) {
  const venvPython = path.join("python", ".venv", "bin", "python3");
  const pythonBin =
    process.env.PADRON_VD_PYTHON_BIN ||
    (fsSync.existsSync(venvPython) ? venvPython : "python3");
  const script = process.env.PADRON_VD_IMPORT_SCRIPT
    ? String(process.env.PADRON_VD_IMPORT_SCRIPT)
    : path.join("python", "padron_vd_importer.py");

  const logDir = path.join(os.tmpdir(), "sinanemia_uploads", "padron_vd_logs");
  await fs.mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, `${params.jobId}.log`);

  const pool = getDbPool();
  await pool.query(
    "UPDATE padron_vd_import_jobs SET status='running', started_at=NOW(), message=? WHERE id=?",
    [
      `Iniciando proceso Python... Bin: ${pythonBin} Script: ${script} Log: ${logPath} ConfigId: ${params.configId}`,
      params.jobId,
    ],
  );

  const fd = fsSync.openSync(logPath, "a");
  try {
    fsSync.writeSync(
      fd,
      `[bootstrap] pythonBin=${pythonBin} script=${script} file=${params.filePath} configId=${params.configId}\n`,
    );
  } catch {}

  const child = spawn(
    pythonBin,
    [script, "--job", params.jobId, "--file", params.filePath, "--config", String(params.configId)],
    {
      detached: true,
      stdio: ["ignore", fd, fd],
      env: {
        ...process.env,
        PADRON_VD_LOG_PATH: logPath,
        PYTHONUNBUFFERED: "1",
      },
    },
  );
  try {
    fsSync.closeSync(fd);
  } catch {}



  child.on("error", async (err) => {
    try {
      await pool.query(
        "UPDATE padron_vd_import_jobs SET status='failed', progress=0, finished_at=NOW(), message=? WHERE id=?",
        [
          `No se pudo ejecutar Python (${pythonBin}). Verifica PADRON_VD_PYTHON_BIN y dependencias. Error: ${String(err?.message ?? err)}`,
          params.jobId,
        ],
      );
    } catch {}
  });

  child.unref();
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (
      session.tipo !== "ADMINISTRADOR" &&
      session.tipo !== "SUPER ADMIN" &&
      session.tipo !== "INVITADO" &&
      session.tipo !== "SUPERVISOR"
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await ensurePadronVdTables();

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }
    const name = String(file.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "invalid_file" }, { status: 400 });

    const jobId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    let filePath = "";
    try {
      filePath = await writeUploadToDisk(file, jobId);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg === "invalid_excel_extension") {
        return NextResponse.json({ error: "Solo se permiten archivos .xlsx o .xls." }, { status: 400 });
      }
      if (msg === "invalid_xls") {
        return NextResponse.json({ error: "No se pudo leer el archivo .xls. Intenta guardarlo como .xlsx e inténtalo nuevamente." }, { status: 400 });
      }
      return NextResponse.json({ error: "No se pudo procesar el Excel. Intenta guardarlo como .xlsx." }, { status: 400 });
    }

    const pool = getDbPool();
    const configIdRaw = String(formData.get("config_id") ?? "").trim();
    const configIdParsed = configIdRaw ? Number(configIdRaw) : NaN;
    const configId =
      Number.isFinite(configIdParsed) && configIdParsed > 0
        ? Math.trunc(configIdParsed)
        : await getDefaultPadronVdConfigId();
    const cfg = await getPadronVdConfig(configId);
    if (!cfg) {
      return NextResponse.json({ error: "Configuración inválida." }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO padron_vd_import_jobs
        (id, status, progress, total_rows, processed_rows, inserted_rows, file_name, requested_by, config_id)
       VALUES (?, 'queued', 0, 0, 0, 0, ?, ?, ?)`,
      [jobId, path.basename(filePath), session.dni, cfg.id],
    );

    await startPythonJob({ jobId, filePath, configId: cfg.id });

    return NextResponse.json({ ok: true, jobId });
  } catch (e) {
    console.error("padron_vd_import_failed", e);
    return NextResponse.json({ error: "padron_vd_import_failed" }, { status: 500 });
  }
}

