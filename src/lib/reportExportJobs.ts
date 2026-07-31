import { getDbPool } from "@/lib/db";

export type ReportExportJobRow = {
  id: number;
  tipo: string;
  params_json: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  message: string | null;
  file_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function ensureReportExportJobsTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS report_export_jobs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      tipo VARCHAR(40) NOT NULL,
      params_json LONGTEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'queued',
      progress INT NOT NULL DEFAULT 0,
      message VARCHAR(500) NULL,
      file_path VARCHAR(800) NULL,
      created_by VARCHAR(15) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_tipo_status (tipo, status),
      KEY idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export async function createReportExportJob(input: {
  tipo: string;
  params: any;
  createdBy: string | null;
}) {
  const pool = getDbPool();
  const params_json = JSON.stringify(input.params ?? {});
  const [res] = await pool.query(
    `INSERT INTO report_export_jobs (tipo, params_json, status, progress, message, created_by)
     VALUES (?, ?, 'queued', 0, 'En cola', ?)`,
    [input.tipo, params_json, input.createdBy],
  );
  const id = Number((res as any)?.insertId ?? 0);
  return await getReportExportJobById(id);
}

export async function getReportExportJobById(id: number): Promise<ReportExportJobRow | null> {
  const pool = getDbPool();
  const [rows] = await pool.query("SELECT * FROM report_export_jobs WHERE id = ? LIMIT 1", [id]);
  return ((rows as any[])[0] as ReportExportJobRow | undefined) ?? null;
}

export async function markReportExportJobRunning(input: { id: number; message?: string | null }) {
  const pool = getDbPool();
  await pool.query(
    "UPDATE report_export_jobs SET status='running', progress=1, message=? WHERE id=?",
    [input.message ?? "Procesando", input.id],
  );
}

export async function markReportExportJobDone(input: { id: number; filePath: string; message?: string | null }) {
  const pool = getDbPool();
  await pool.query(
    "UPDATE report_export_jobs SET status='done', progress=100, message=?, file_path=? WHERE id=?",
    [input.message ?? "Listo", input.filePath, input.id],
  );
}

export async function markReportExportJobFailed(input: { id: number; message: string }) {
  const pool = getDbPool();
  await pool.query(
    "UPDATE report_export_jobs SET status='failed', progress=100, message=? WHERE id=?",
    [String(input.message).slice(0, 500), input.id],
  );
}

