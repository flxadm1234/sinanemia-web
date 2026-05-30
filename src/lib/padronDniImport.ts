import { getDbPool } from "@/lib/db";

export type PadronDniTipo = "ACTIVO" | "ACTIVO_OBSERVADO" | "TRANSITO";
export type PadronDniJobStatus = "queued" | "running" | "done" | "failed";

export type PadronDniImportJob = {
  id: string;
  status: PadronDniJobStatus;
  progress: number;
  total_rows: number;
  processed_rows: number;
  inserted_rows: number;
  update_padron?: number | null;
  periodo: string | null;
  fecha_corte: string | null;
  ubigeo: number | null;
  file_activo_name: string | null;
  file_activo_observado_name: string | null;
  file_transito_name: string | null;
  headers_json: string | null;
  requested_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
};

export async function ensurePadronDniTables() {
  const pool = getDbPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS padron_dni_import_jobs (
      id CHAR(36) PRIMARY KEY,
      status ENUM('queued','running','done','failed') NOT NULL,
      progress INT NOT NULL DEFAULT 0,
      total_rows INT NOT NULL DEFAULT 0,
      processed_rows INT NOT NULL DEFAULT 0,
      inserted_rows INT NOT NULL DEFAULT 0,
      update_padron TINYINT NOT NULL DEFAULT 0,
      periodo DATE NULL,
      fecha_corte DATE NULL,
      ubigeo INT NULL,
      file_activo_name VARCHAR(255) NULL,
      file_activo_observado_name VARCHAR(255) NULL,
      file_transito_name VARCHAR(255) NULL,
      headers_json LONGTEXT NULL,
      requested_by VARCHAR(15) NULL,
      started_at DATETIME NULL,
      finished_at DATETIME NULL,
      message TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_ubigeo_periodo (ubigeo, periodo),
      KEY idx_fecha (fecha_corte)
    ) ENGINE=InnoDB
  `);
  try {
    await pool.query(`ALTER TABLE padron_dni_import_jobs ADD COLUMN update_padron TINYINT NOT NULL DEFAULT 0`);
  } catch {}

  await pool.query(`
    CREATE TABLE IF NOT EXISTS padron_dni_raw (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      job_id CHAR(36) NOT NULL,
      tipo ENUM('ACTIVO','ACTIVO_OBSERVADO','TRANSITO') NOT NULL,
      row_num INT NOT NULL,
      ubigeo INT NULL,
      dni VARCHAR(15) NULL,
      payload LONGTEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_job (job_id),
      KEY idx_job_tipo (job_id, tipo),
      KEY idx_job_dni (job_id, dni),
      KEY idx_ubigeo (ubigeo)
    ) ENGINE=InnoDB
  `);
}

export async function getPadronDniJob(id: string): Promise<PadronDniImportJob | null> {
  const pool = getDbPool();
  const [rows] = await pool.query("SELECT * FROM padron_dni_import_jobs WHERE id = ? LIMIT 1", [id]);
  return ((rows as any[])[0] as PadronDniImportJob | undefined) ?? null;
}

export async function listPadronDniJobs(params: { limit: number; offset: number }) {
  const pool = getDbPool();
  const [countRows] = await pool.query("SELECT COUNT(*) AS total FROM padron_dni_import_jobs");
  const total = Number((countRows as any[])[0]?.total ?? 0);

  const [rows] = await pool.query(
    `SELECT * FROM padron_dni_import_jobs
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [params.limit, params.offset],
  );
  return { total, rows: rows as PadronDniImportJob[] };
}

export async function deletePadronDniJob(jobId: string) {
  const pool = getDbPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM padron_dni_raw WHERE job_id = ?", [jobId]);
    await conn.query("DELETE FROM padron_dni_import_jobs WHERE id = ?", [jobId]);
    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

export async function getPadronDniJobCounts(jobId: string) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    `SELECT tipo, COUNT(*) AS c
     FROM padron_dni_raw
     WHERE job_id = ?
     GROUP BY tipo`,
    [jobId],
  );
  const out: Record<string, number> = {};
  for (const r of rows as any[]) out[String(r.tipo)] = Number(r.c ?? 0);
  return out as Partial<Record<PadronDniTipo, number>>;
}
