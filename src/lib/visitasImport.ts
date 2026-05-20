import { getDbPool } from "@/lib/db";

export type VisitasImportJobStatus = "queued" | "running" | "done" | "failed";

export type VisitasImportJob = {
  id: string;
  status: VisitasImportJobStatus;
  progress: number;
  total_rows: number;
  processed_rows: number;
  inserted_rows: number;
  file_name: string | null;
  requested_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
};

export type VisitasImportConfig = {
  id: number;
  sheet_index: number;
  start_row: number;
  col_ubigeo: number;
  col_dni_nino: number;
  col_etapa_text: number | null;
  col_visitas_completas: number | null;
  col_fecha_intervencion: number;
  col_dispositivo: number | null;
  col_estado_intervencion: number | null;
  col_latitud: number | null;
  col_longitud: number | null;
};

const defaultConfig: Omit<VisitasImportConfig, "id"> = {
  sheet_index: 0,
  start_row: 9,
  col_ubigeo: 0,
  col_dni_nino: 12,
  col_etapa_text: 24,
  col_visitas_completas: 26,
  col_fecha_intervencion: 28,
  col_dispositivo: 29,
  col_estado_intervencion: 32,
  col_latitud: 33,
  col_longitud: 34,
};

export async function ensureVisitasTables() {
  const pool = getDbPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitas_import_config (
      id INT NOT NULL PRIMARY KEY,
      sheet_index INT NOT NULL DEFAULT 0,
      start_row INT NOT NULL DEFAULT 9,
      col_ubigeo INT NOT NULL DEFAULT 0,
      col_dni_nino INT NOT NULL DEFAULT 0,
      col_etapa_text INT NULL,
      col_visitas_completas INT NULL,
      col_fecha_intervencion INT NOT NULL DEFAULT 0,
      col_dispositivo INT NULL,
      col_estado_intervencion INT NULL,
      col_latitud INT NULL,
      col_longitud INT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitas_import_jobs (
      id CHAR(36) PRIMARY KEY,
      status ENUM('queued','running','done','failed') NOT NULL,
      progress INT NOT NULL DEFAULT 0,
      total_rows INT NOT NULL DEFAULT 0,
      processed_rows INT NOT NULL DEFAULT 0,
      inserted_rows INT NOT NULL DEFAULT 0,
      file_name VARCHAR(255) NULL,
      requested_by VARCHAR(15) NULL,
      started_at DATETIME NULL,
      finished_at DATETIME NULL,
      message TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitas_raw (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      job_id CHAR(36) NOT NULL,
      ubigeo INT NOT NULL,
      etapa_mes DATE NOT NULL,
      dni_nino VARCHAR(15) NOT NULL,
      etapa_text VARCHAR(120) NULL,
      visitas_completas_edad INT NULL,
      fecha_intervencion DATE NULL,
      dispositivo VARCHAR(30) NULL,
      estado_intervencion VARCHAR(50) NULL,
      latitud DECIMAL(10,7) NULL,
      longitud DECIMAL(10,7) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_job (job_id),
      KEY idx_ubigeo_mes_dni (ubigeo, etapa_mes, dni_nino),
      KEY idx_ubigeo_mes_fecha (ubigeo, etapa_mes, fecha_intervencion)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitas_mensual (
      ubigeo INT NOT NULL,
      etapa_mes DATE NOT NULL,
      dni_nino VARCHAR(15) NOT NULL,
      expected_visits INT NULL,
      visitas_count INT NOT NULL DEFAULT 0,
      fecha_v1 DATE NULL,
      fecha_v2 DATE NULL,
      fecha_v3 DATE NULL,
      completa TINYINT(1) NOT NULL DEFAULT 0,
      oportuna TINYINT(1) NOT NULL DEFAULT 0,
      cumple TINYINT(1) NOT NULL DEFAULT 0,
      georef_visits INT NOT NULL DEFAULT 0,
      has_georef TINYINT(1) NOT NULL DEFAULT 0,
      flag_no_encontrado TINYINT(1) NOT NULL DEFAULT 0,
      flag_rechazado TINYINT(1) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (ubigeo, etapa_mes, dni_nino),
      KEY idx_mes (etapa_mes),
      KEY idx_cumple (ubigeo, etapa_mes, cumple)
    ) ENGINE=InnoDB
  `);

  const [rows] = await pool.query("SELECT id FROM visitas_import_config WHERE id=1 LIMIT 1");
  if (!(rows as any[]).length) {
    await pool.query(
      `INSERT INTO visitas_import_config
        (id, sheet_index, start_row, col_ubigeo, col_dni_nino, col_etapa_text, col_visitas_completas, col_fecha_intervencion, col_dispositivo, col_estado_intervencion, col_latitud, col_longitud)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        defaultConfig.sheet_index,
        defaultConfig.start_row,
        defaultConfig.col_ubigeo,
        defaultConfig.col_dni_nino,
        defaultConfig.col_etapa_text,
        defaultConfig.col_visitas_completas,
        defaultConfig.col_fecha_intervencion,
        defaultConfig.col_dispositivo,
        defaultConfig.col_estado_intervencion,
        defaultConfig.col_latitud,
        defaultConfig.col_longitud,
      ],
    );
  }
}

export async function getVisitasConfig(): Promise<VisitasImportConfig> {
  const pool = getDbPool();
  const [rows] = await pool.query("SELECT * FROM visitas_import_config WHERE id=1 LIMIT 1");
  return (rows as any[])[0] as VisitasImportConfig;
}

export async function updateVisitasConfig(patch: Partial<Omit<VisitasImportConfig, "id">>) {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (!keys.length) return;
  const set: string[] = [];
  const values: any[] = [];
  for (const k of keys) {
    set.push(`${String(k)} = ?`);
    values.push((patch as any)[k]);
  }
  values.push(1);
  const pool = getDbPool();
  await pool.query(`UPDATE visitas_import_config SET ${set.join(", ")} WHERE id = ?`, values);
}

export async function getVisitasJobById(id: string) {
  const pool = getDbPool();
  const [rows] = await pool.query("SELECT * FROM visitas_import_jobs WHERE id = ? LIMIT 1", [
    id,
  ]);
  return ((rows as any[])[0] as VisitasImportJob | undefined) ?? null;
}

