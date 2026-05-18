import { getDbPool } from "@/lib/db";

export type TamizajeJobStatus = "queued" | "running" | "done" | "failed";

export type TamizajeImportJob = {
  id: string;
  status: TamizajeJobStatus;
  progress: number;
  total_rows: number;
  processed_rows: number;
  inserted_rows: number;
  file_name: string | null;
  source: string;
  requested_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
};

export async function ensureTamizajeTables() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tamizaje_import_jobs (
      id CHAR(36) PRIMARY KEY,
      status ENUM('queued','running','done','failed') NOT NULL,
      progress INT NOT NULL DEFAULT 0,
      total_rows INT NOT NULL DEFAULT 0,
      processed_rows INT NOT NULL DEFAULT 0,
      inserted_rows INT NOT NULL DEFAULT 0,
      file_name VARCHAR(255) NULL,
      source VARCHAR(30) NOT NULL DEFAULT 'web',
      requested_by VARCHAR(15) NULL,
      started_at DATETIME NULL,
      finished_at DATETIME NULL,
      message TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS registro_tamizaje (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      id_cita BIGINT NULL,
      lote VARCHAR(20) NULL,
      ups VARCHAR(200) NULL,
      nombre_personal VARCHAR(200) NULL,
      nombre_registrador VARCHAR(200) NULL,
      periodo INT NULL,
      renaes VARCHAR(20) NULL,
      red VARCHAR(200) NULL,
      microred VARCHAR(200) NULL,
      provincia VARCHAR(200) NULL,
      distrito VARCHAR(200) NULL,
      tipo_documento VARCHAR(40) NULL,
      dni VARCHAR(20) NULL,
      sexo VARCHAR(5) NULL,
      fecha_nacimiento DATE NULL,
      fecha_atencion DATE NULL,
      peso DECIMAL(8,2) NULL,
      talla DECIMAL(8,2) NULL,
      hemoglobina DECIMAL(8,2) NULL,
      grupo_riesgo_desc VARCHAR(250) NULL,
      condicion_gestante VARCHAR(250) NULL,
      tipo_edad_pac VARCHAR(10) NULL,
      anio_actual_pac INT NULL,
      mes_actual_pac INT NULL,
      dia_actual_pac INT NULL,
      nombre_establecimiento VARCHAR(250) NULL,
      cie_10 VARCHAR(40) NULL,
      diagnostico VARCHAR(300) NULL,
      lab1 VARCHAR(40) NULL,
      lab2 VARCHAR(40) NULL,
      lab3 VARCHAR(40) NULL,
      resultado VARCHAR(200) NULL,
      total INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dni (dni),
      INDEX idx_fecha_atencion (fecha_atencion),
      INDEX idx_periodo (periodo),
      INDEX idx_renaes (renaes),
      INDEX idx_id_cita (id_cita),
      INDEX idx_dni_fecha (dni, fecha_atencion)
    ) ENGINE=InnoDB
  `);
}

export async function getTamizajeJobById(id: string) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT * FROM tamizaje_import_jobs WHERE id = ? LIMIT 1",
    [id],
  );
  return ((rows as any[])[0] as TamizajeImportJob | undefined) ?? null;
}

