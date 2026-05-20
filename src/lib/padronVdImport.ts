import { getDbPool } from "@/lib/db";

export type PadronVdJobStatus = "queued" | "running" | "done" | "failed";

export type PadronVdImportJob = {
  id: string;
  status: PadronVdJobStatus;
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

export type PadronVdImportConfig = {
  id: number;
  sheet_index: number;
  start_row: number;
  col_ubigeo: number;
  col_departamento: number | null;
  col_provincia: number | null;
  col_distrito: number | null;
  col_actorsocial: number | null;
  col_responsable: number | null;
  col_dnimadre: number | null;
  col_telefono: number | null;
  col_rango: number | null;
  col_dni: number;
  col_fecha_nac: number;
  col_direccion: number | null;
  col_ccpp: number | null;
  col_eess_ua: number | null;
  col_fecha_inicio_vd: number | null;
  col_fecha_fin_vd: number | null;
  col_etapa: number | null;
  col_nrovd: number | null;
};

const defaultConfig: Omit<PadronVdImportConfig, "id"> = {
  sheet_index: 0,
  start_row: 9,
  col_ubigeo: 0,
  col_departamento: 1,
  col_provincia: 2,
  col_distrito: 3,
  col_actorsocial: 4,
  col_responsable: null,
  col_dnimadre: 6,
  col_telefono: 8,
  col_rango: 9,
  col_dni: 11,
  col_fecha_nac: 12,
  col_direccion: 13,
  col_ccpp: 15,
  col_eess_ua: 19,
  col_fecha_inicio_vd: 20,
  col_fecha_fin_vd: 21,
  col_etapa: null,
  col_nrovd: null,
};

export async function ensurePadronVdTables() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS padron_vd_import_config (
      id INT NOT NULL PRIMARY KEY,
      sheet_index INT NOT NULL DEFAULT 0,
      start_row INT NOT NULL DEFAULT 9,
      col_ubigeo INT NOT NULL DEFAULT 0,
      col_departamento INT NULL,
      col_provincia INT NULL,
      col_distrito INT NULL,
      col_actorsocial INT NULL,
      col_responsable INT NULL,
      col_dnimadre INT NULL,
      col_telefono INT NULL,
      col_rango INT NULL,
      col_dni INT NOT NULL DEFAULT 0,
      col_fecha_nac INT NOT NULL DEFAULT 0,
      col_direccion INT NULL,
      col_ccpp INT NULL,
      col_eess_ua INT NULL,
      col_fecha_inicio_vd INT NULL,
      col_fecha_fin_vd INT NULL,
      col_etapa INT NULL,
      col_nrovd INT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS padron_vd_import_jobs (
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

  const [rows] = await pool.query("SELECT id FROM padron_vd_import_config WHERE id = 1 LIMIT 1");
  if (!(rows as any[]).length) {
    await pool.query(
      `INSERT INTO padron_vd_import_config
        (id, sheet_index, start_row, col_ubigeo, col_departamento, col_provincia, col_distrito, col_actorsocial, col_responsable, col_dnimadre, col_telefono, col_rango, col_dni, col_fecha_nac, col_direccion, col_ccpp, col_eess_ua, col_fecha_inicio_vd, col_fecha_fin_vd, col_etapa, col_nrovd)
       VALUES
        (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        defaultConfig.sheet_index,
        defaultConfig.start_row,
        defaultConfig.col_ubigeo,
        defaultConfig.col_departamento,
        defaultConfig.col_provincia,
        defaultConfig.col_distrito,
        defaultConfig.col_actorsocial,
        defaultConfig.col_responsable,
        defaultConfig.col_dnimadre,
        defaultConfig.col_telefono,
        defaultConfig.col_rango,
        defaultConfig.col_dni,
        defaultConfig.col_fecha_nac,
        defaultConfig.col_direccion,
        defaultConfig.col_ccpp,
        defaultConfig.col_eess_ua,
        defaultConfig.col_fecha_inicio_vd,
        defaultConfig.col_fecha_fin_vd,
        defaultConfig.col_etapa,
        defaultConfig.col_nrovd,
      ],
    );
  }
}

export async function getPadronVdConfig(): Promise<PadronVdImportConfig> {
  const pool = getDbPool();
  const [rows] = await pool.query("SELECT * FROM padron_vd_import_config WHERE id = 1 LIMIT 1");
  return (rows as any[])[0] as PadronVdImportConfig;
}

export async function updatePadronVdConfig(patch: Partial<Omit<PadronVdImportConfig, "id">>) {
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
  await pool.query(`UPDATE padron_vd_import_config SET ${set.join(", ")} WHERE id = ?`, values);
}

export async function getPadronVdJobById(id: string) {
  const pool = getDbPool();
  const [rows] = await pool.query("SELECT * FROM padron_vd_import_jobs WHERE id = ? LIMIT 1", [
    id,
  ]);
  return ((rows as any[])[0] as PadronVdImportJob | undefined) ?? null;
}

