import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensurePadronDniTables } from "@/lib/padronDniImport";
import { getDbPool } from "@/lib/db";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import { spawn } from "child_process";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

async function writeUploadToDisk(file: File, jobId: string, suffix: string) {
  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(os.tmpdir(), "sinanemia_uploads", "padron_dni");
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(file.name || "").toLowerCase();
  if (ext !== ".xls" && ext !== ".xlsx") throw new Error("invalid_excel_extension");
  const filePath = path.join(dir, `${jobId}-${suffix}.xlsx`);
  if (ext === ".xlsx") {
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
  await fs.writeFile(filePath, out);
  return filePath;
}

function parseISODate(s: string) {
  const v = s.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthStartISO(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

async function startPythonJob(params: {
  jobId: string;
  activoPath: string;
  observadoPath: string;
  transitoPath: string;
  fechaCorteISO: string;
  updatePadron: boolean;
  expectedUbigeo?: number | null;
}) {
  const venvPython = path.join("python", ".venv", "bin", "python3");
  const pythonBin =
    process.env.PADRON_DNI_PYTHON_BIN ||
    (fsSync.existsSync(venvPython) ? venvPython : "python3");
  const script = process.env.PADRON_DNI_IMPORT_SCRIPT
    ? String(process.env.PADRON_DNI_IMPORT_SCRIPT)
    : path.join("python", "padron_dni_importer.py");

  const logDir = path.join(os.tmpdir(), "sinanemia_uploads", "padron_dni_logs");
  await fs.mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, `${params.jobId}.log`);

  const pool = getDbPool();
  await pool.query(
    "UPDATE padron_dni_import_jobs SET status='running', started_at=NOW(), message=? WHERE id=?",
    [
      `Iniciando proceso Python... Bin: ${pythonBin} Script: ${script} Log: ${logPath}`,
      params.jobId,
    ],
  );

  const fd = fsSync.openSync(logPath, "a");
  try {
    fsSync.writeSync(
      fd,
      `[bootstrap] pythonBin=${pythonBin} script=${script} activo=${params.activoPath} observado=${params.observadoPath} transito=${params.transitoPath} fecha_corte=${params.fechaCorteISO} update_padron=${params.updatePadron ? 1 : 0} expected_ubigeo=${params.expectedUbigeo ?? ""}\n`,
    );
  } catch {}

  const expectedUbigeoNum =
    typeof params.expectedUbigeo === "number" && Number.isFinite(params.expectedUbigeo) ? params.expectedUbigeo : null;

  const child = spawn(
    pythonBin,
    [
      script,
      "--job",
      params.jobId,
      "--activo",
      params.activoPath,
      "--observado",
      params.observadoPath,
      "--transito",
      params.transitoPath,
      "--fecha_corte",
      params.fechaCorteISO,
      "--update_padron",
      params.updatePadron ? "1" : "0",
      ...(expectedUbigeoNum ? ["--expected_ubigeo", String(expectedUbigeoNum)] : []),
    ],
    {
      detached: true,
      stdio: ["ignore", fd, fd],
      env: {
        ...process.env,
        PADRON_DNI_LOG_PATH: logPath,
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
        "UPDATE padron_dni_import_jobs SET status='failed', progress=0, finished_at=NOW(), message=? WHERE id=?",
        [
          `No se pudo ejecutar Python (${pythonBin}). Verifica PADRON_DNI_PYTHON_BIN y dependencias. Error: ${String(err?.message ?? err)}`,
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
    if (session.tipo === "COORDINADOR" || session.tipo === "ACTOR SOCIAL") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await ensurePadronDniTables();

    const formData = await request.formData();
    const fechaCorteRaw = String(formData.get("fecha_corte") ?? "").trim();
    const modo = String(formData.get("modo") ?? "").trim().toLowerCase();
    const updatePadron = String(formData.get("update_padron") ?? "0").trim() === "1";
    const fecha = parseISODate(fechaCorteRaw);
    if (!fecha) return NextResponse.json({ error: "Fecha de corte inválida (YYYY-MM-DD)." }, { status: 400 });
    const periodo = monthStartISO(fecha);
    const fechaISO = isoDate(fecha);
    if (modo !== "inicio" && modo !== "avance")
      return NextResponse.json({ error: "Modo inválido." }, { status: 400 });
    if (modo === "inicio" && fechaISO !== periodo)
      return NextResponse.json({ error: "Para inicio de mes, la fecha de corte debe ser el día 01 del mes." }, { status: 400 });
    if (modo === "avance" && fechaISO === periodo)
      return NextResponse.json({ error: "Para avance, la fecha de corte no puede ser el día 01 del mes." }, { status: 400 });
    if (updatePadron && modo !== "inicio")
      return NextResponse.json({ error: "La actualización de padrón nominal solo está disponible para Inicio de mes." }, { status: 400 });

    const expectedUbigeo =
      session.tipo === "SUPER ADMIN"
        ? null
        : typeof session.ubigeo === "number" && Number.isFinite(session.ubigeo)
          ? session.ubigeo
          : null;
    if (session.tipo !== "SUPER ADMIN" && !expectedUbigeo) {
      return NextResponse.json({ error: "No se pudo determinar el ubigeo del usuario." }, { status: 400 });
    }

    const fActivo = formData.get("file_activo");
    const fObs = formData.get("file_activo_observado");
    const fTran = formData.get("file_transito");
    if (!(fActivo instanceof File) || !(fObs instanceof File) || !(fTran instanceof File)) {
      return NextResponse.json({ error: "Debes adjuntar los 3 archivos (Activo, Activo-Observado, Tránsito)." }, { status: 400 });
    }

    const jobId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    let activoPath = "";
    let observadoPath = "";
    let transitoPath = "";
    try {
      activoPath = await writeUploadToDisk(fActivo, jobId, "activo");
      observadoPath = await writeUploadToDisk(fObs, jobId, "observado");
      transitoPath = await writeUploadToDisk(fTran, jobId, "transito");
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
    await pool.query(
      `INSERT INTO padron_dni_import_jobs
        (id, status, progress, total_rows, processed_rows, inserted_rows, update_padron, periodo, fecha_corte, ubigeo, file_activo_name, file_activo_observado_name, file_transito_name, requested_by)
       VALUES (?, 'queued', 0, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jobId,
        updatePadron ? 1 : 0,
        periodo,
        fechaISO,
        expectedUbigeo,
        path.basename(activoPath),
        path.basename(observadoPath),
        path.basename(transitoPath),
        session.dni,
      ],
    );

    await startPythonJob({
      jobId,
      activoPath,
      observadoPath,
      transitoPath,
      fechaCorteISO: fechaISO,
      updatePadron,
      expectedUbigeo,
    });

    return NextResponse.json({ ok: true, jobId });
  } catch (e) {
    console.error("padron_dni_import_failed", e);
    return NextResponse.json({ error: "padron_dni_import_failed" }, { status: 500 });
  }
}
