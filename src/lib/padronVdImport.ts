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
  name: string;
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PadronVdImportConfigSummary = { id: number; name: string };

const defaultConfig: Omit<
  PadronVdImportConfig,
  "id" | "name" | "created_by" | "created_at" | "updated_at"
> = {
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
    CREATE TABLE IF NOT EXISTS padron_vd_import_configs (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
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
      created_by VARCHAR(15) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_name (name)
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
      config_id INT NULL,
      started_at DATETIME NULL,
      finished_at DATETIME NULL,
      message TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  try {
    await pool.query("ALTER TABLE padron_vd_import_jobs ADD COLUMN config_id INT NULL");
  } catch {}

  try {
    await pool.query("ALTER TABLE padron_vd_import_jobs ADD KEY idx_config (config_id)");
  } catch {}

  const [cfgRows] = await pool.query(
    "SELECT id FROM padron_vd_import_configs ORDER BY id ASC LIMIT 1",
  );
  if ((cfgRows as any[]).length) return;

  let migrated: any = null;
  try {
    const [rows] = await pool.query("SELECT * FROM padron_vd_import_config WHERE id = 1 LIMIT 1");
    migrated = (rows as any[])[0] ?? null;
  } catch {}

  const d = migrated
    ? {
        sheet_index: Number(migrated.sheet_index ?? defaultConfig.sheet_index),
        start_row: Number(migrated.start_row ?? defaultConfig.start_row),
        col_ubigeo: Number(migrated.col_ubigeo ?? defaultConfig.col_ubigeo),
        col_departamento:
          migrated.col_departamento == null ? null : Number(migrated.col_departamento),
        col_provincia: migrated.col_provincia == null ? null : Number(migrated.col_provincia),
        col_distrito: migrated.col_distrito == null ? null : Number(migrated.col_distrito),
        col_actorsocial: migrated.col_actorsocial == null ? null : Number(migrated.col_actorsocial),
        col_responsable:
          migrated.col_responsable == null ? null : Number(migrated.col_responsable),
        col_dnimadre: migrated.col_dnimadre == null ? null : Number(migrated.col_dnimadre),
        col_telefono: migrated.col_telefono == null ? null : Number(migrated.col_telefono),
        col_rango: migrated.col_rango == null ? null : Number(migrated.col_rango),
        col_dni: Number(migrated.col_dni ?? defaultConfig.col_dni),
        col_fecha_nac: Number(migrated.col_fecha_nac ?? defaultConfig.col_fecha_nac),
        col_direccion: migrated.col_direccion == null ? null : Number(migrated.col_direccion),
        col_ccpp: migrated.col_ccpp == null ? null : Number(migrated.col_ccpp),
        col_eess_ua: migrated.col_eess_ua == null ? null : Number(migrated.col_eess_ua),
        col_fecha_inicio_vd:
          migrated.col_fecha_inicio_vd == null ? null : Number(migrated.col_fecha_inicio_vd),
        col_fecha_fin_vd:
          migrated.col_fecha_fin_vd == null ? null : Number(migrated.col_fecha_fin_vd),
        col_etapa: migrated.col_etapa == null ? null : Number(migrated.col_etapa),
        col_nrovd: migrated.col_nrovd == null ? null : Number(migrated.col_nrovd),
      }
    : defaultConfig;

  await pool.query(
    `INSERT INTO padron_vd_import_configs
      (name, sheet_index, start_row, col_ubigeo, col_departamento, col_provincia, col_distrito, col_actorsocial, col_responsable, col_dnimadre, col_telefono, col_rango, col_dni, col_fecha_nac, col_direccion, col_ccpp, col_eess_ua, col_fecha_inicio_vd, col_fecha_fin_vd, col_etapa, col_nrovd)
     VALUES
      ('Default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.sheet_index,
      d.start_row,
      d.col_ubigeo,
      d.col_departamento,
      d.col_provincia,
      d.col_distrito,
      d.col_actorsocial,
      d.col_responsable,
      d.col_dnimadre,
      d.col_telefono,
      d.col_rango,
      d.col_dni,
      d.col_fecha_nac,
      d.col_direccion,
      d.col_ccpp,
      d.col_eess_ua,
      d.col_fecha_inicio_vd,
      d.col_fecha_fin_vd,
      d.col_etapa,
      d.col_nrovd,
    ],
  );
}

export async function listPadronVdConfigs(): Promise<PadronVdImportConfigSummary[]> {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT id, name FROM padron_vd_import_configs ORDER BY name ASC",
  );
  return (rows as any[]).map((r) => ({ id: Number(r.id), name: String(r.name || "") }));
}

export async function getPadronVdConfig(configId: number): Promise<PadronVdImportConfig | null> {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT * FROM padron_vd_import_configs WHERE id = ? LIMIT 1",
    [configId],
  );
  return ((rows as any[])[0] as PadronVdImportConfig | undefined) ?? null;
}

export async function getDefaultPadronVdConfigId(): Promise<number> {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT id FROM padron_vd_import_configs ORDER BY id ASC LIMIT 1",
  );
  const id = Number((rows as any[])?.[0]?.id ?? 0);
  return Number.isFinite(id) && id > 0 ? id : 1;
}

export async function createPadronVdConfig(params: {
  name: string;
  createdBy?: string | null;
  config: Omit<
    PadronVdImportConfig,
    "id" | "name" | "created_by" | "created_at" | "updated_at"
  >;
}) {
  const pool = getDbPool();
  const d = params.config;
  const [res] = await pool.query(
    `INSERT INTO padron_vd_import_configs
      (name, sheet_index, start_row, col_ubigeo, col_departamento, col_provincia, col_distrito, col_actorsocial, col_responsable, col_dnimadre, col_telefono, col_rango, col_dni, col_fecha_nac, col_direccion, col_ccpp, col_eess_ua, col_fecha_inicio_vd, col_fecha_fin_vd, col_etapa, col_nrovd, created_by)
     VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.name,
      d.sheet_index,
      d.start_row,
      d.col_ubigeo,
      d.col_departamento,
      d.col_provincia,
      d.col_distrito,
      d.col_actorsocial,
      d.col_responsable,
      d.col_dnimadre,
      d.col_telefono,
      d.col_rango,
      d.col_dni,
      d.col_fecha_nac,
      d.col_direccion,
      d.col_ccpp,
      d.col_eess_ua,
      d.col_fecha_inicio_vd,
      d.col_fecha_fin_vd,
      d.col_etapa,
      d.col_nrovd,
      params.createdBy ?? null,
    ],
  );
  return Number((res as any)?.insertId ?? 0);
}

export async function updatePadronVdConfig(params: {
  id: number;
  patch: Partial<
    Omit<PadronVdImportConfig, "id" | "created_by" | "created_at" | "updated_at">
  >;
}) {
  const patch = params.patch;
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (!keys.length) return;
  const set: string[] = [];
  const values: any[] = [];
  for (const k of keys) {
    set.push(`${String(k)} = ?`);
    values.push((patch as any)[k]);
  }
  values.push(params.id);
  const pool = getDbPool();
  await pool.query(`UPDATE padron_vd_import_configs SET ${set.join(", ")} WHERE id = ?`, values);
}

export async function getPadronVdJobById(id: string) {
  const pool = getDbPool();
  const [rows] = await pool.query("SELECT * FROM padron_vd_import_jobs WHERE id = ? LIMIT 1", [
    id,
  ]);
  return ((rows as any[])[0] as PadronVdImportJob | undefined) ?? null;
}

