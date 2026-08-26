import { getDbPool } from "@/lib/db";

export type CarnetEstado = "pendiente" | "confirmado";

export type CarnetListadoRow = {
  idpn: number;
  dni: string | null;
  nombres: string | null;
  img_carnet: string | null;
  estado_verificacion: string | null;
};

export type CarnetCounters = {
  total: number;
  confirmados: number;
  pendientes: number;
};

export async function ensureRegistrosHemoglobinaTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registros_hemoglobina (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      dni_extraido VARCHAR(15) NULL,
      dni_consultado VARCHAR(15) NULL,
      fecha_examen DATE NULL,
      edad VARCHAR(15) NULL,
      resultado VARCHAR(30) NULL,
      tipo TINYINT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_dni (dni_consultado),
      KEY idx_tipo (tipo)
    ) ENGINE=InnoDB
  `);
  try {
    await pool.query(`ALTER TABLE registros_hemoglobina ADD COLUMN tipo TINYINT NULL`);
  } catch {}
  try {
    await pool.query(`ALTER TABLE registros_hemoglobina ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
  } catch {}
}

function normEstado(v: unknown) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "pendiente";
  return s;
}

export async function getCarnetCounters(params: { ubigeo: number; search?: string; status?: "pendiente" | "confirmado" | "all" }) {
  const pool = getDbPool();
  const search = String(params.search ?? "").trim();
  const status = String(params.status ?? "pendiente").trim().toLowerCase();

  const where: string[] = ["pn.ubigeo = ?", "TRIM(COALESCE(pn.img_carnet,'')) <> ''"];
  const args: any[] = [params.ubigeo];

  if (search) {
    where.push("TRIM(COALESCE(pn.dni,'')) LIKE ?");
    args.push(`%${search}%`);
  }

  if (status === "confirmado") {
    where.push("LOWER(TRIM(COALESCE(pn.estado_verificacion,''))) = 'confirmado'");
  } else if (status === "pendiente") {
    where.push("LOWER(TRIM(COALESCE(pn.estado_verificacion,''))) <> 'confirmado'");
  }

  const [rows] = await pool.query(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN LOWER(TRIM(COALESCE(pn.estado_verificacion,''))) = 'confirmado' THEN 1 ELSE 0 END) AS confirmados
     FROM padronnominal pn
     WHERE ${where.join(" AND ")}`,
    args,
  );

  const total = Number((rows as any[])?.[0]?.total ?? 0);
  const confirmados = Number((rows as any[])?.[0]?.confirmados ?? 0);
  const pendientes = Math.max(0, total - confirmados);
  return { total, confirmados, pendientes } satisfies CarnetCounters;
}

export async function listCarnets(params: {
  ubigeo: number;
  search?: string;
  status?: "pendiente" | "confirmado" | "all";
  limit: number;
  offset: number;
}) {
  const pool = getDbPool();
  const search = String(params.search ?? "").trim();
  const status = String(params.status ?? "pendiente").trim().toLowerCase();
  const limit = Math.min(Math.max(params.limit, 1), 200);
  const offset = Math.max(params.offset, 0);

  const where: string[] = ["pn.ubigeo = ?", "TRIM(COALESCE(pn.img_carnet,'')) <> ''"];
  const args: any[] = [params.ubigeo];

  if (search) {
    where.push("TRIM(COALESCE(pn.dni,'')) LIKE ?");
    args.push(`%${search}%`);
  }

  if (status === "confirmado") {
    where.push("LOWER(TRIM(COALESCE(pn.estado_verificacion,''))) = 'confirmado'");
  } else if (status === "pendiente") {
    where.push("LOWER(TRIM(COALESCE(pn.estado_verificacion,''))) <> 'confirmado'");
  }

  const [rows] = await pool.query(
    `SELECT pn.idpn, pn.dni, pn.nombres, pn.img_carnet, pn.estado_verificacion
     FROM padronnominal pn
     WHERE ${where.join(" AND ")}
     ORDER BY pn.idpn DESC
     LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );
  return (rows as any[]).map(
    (r) =>
      ({
        idpn: Number(r.idpn),
        dni: r.dni == null ? null : String(r.dni),
        nombres: r.nombres == null ? null : String(r.nombres),
        img_carnet: r.img_carnet == null ? null : String(r.img_carnet),
        estado_verificacion: r.estado_verificacion == null ? null : String(r.estado_verificacion),
      }) satisfies CarnetListadoRow,
  );
}

export async function getCarnetByIdpn(params: { ubigeo: number; idpn: number }) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    `SELECT idpn, dni, nombres, etapa, fecha_nac, img_carnet, estado_verificacion
     FROM padronnominal
     WHERE idpn = ? AND ubigeo = ?
     LIMIT 1`,
    [params.idpn, params.ubigeo],
  );
  const r = (rows as any[])?.[0];
  if (!r) return null;
  return {
    idpn: Number(r.idpn),
    dni: r.dni == null ? null : String(r.dni),
    nombres: r.nombres == null ? null : String(r.nombres),
    etapa: r.etapa == null ? null : String(r.etapa).slice(0, 10),
    fecha_nac: r.fecha_nac == null ? null : String(r.fecha_nac).slice(0, 10),
    img_carnet: r.img_carnet == null ? null : String(r.img_carnet),
    estado_verificacion: normEstado(r.estado_verificacion),
  };
}

export async function setCarnetEstado(params: { ubigeo: number; idpn: number; estado: CarnetEstado }) {
  const pool = getDbPool();
  const estado = params.estado === "confirmado" ? "confirmado" : "pendiente";
  const [res] = await pool.query(
    `UPDATE padronnominal
     SET estado_verificacion = ?
     WHERE idpn = ? AND ubigeo = ? AND TRIM(COALESCE(img_carnet,'')) <> ''`,
    [estado, params.idpn, params.ubigeo],
  );
  return res as any;
}

export async function ensurePadronHasCarnetFields() {
  const pool = getDbPool();
  try {
    await pool.query(`ALTER TABLE padronnominal ADD COLUMN img_carnet VARCHAR(255) NULL`);
  } catch {}
  try {
    await pool.query(`ALTER TABLE padronnominal ADD COLUMN estado_verificacion VARCHAR(30) NULL`);
  } catch {}
}

export async function dniBelongsToUbigeo(params: { ubigeo: number; dni: string }) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    `SELECT 1
     FROM padronnominal
     WHERE ubigeo = ? AND TRIM(COALESCE(dni,'')) = TRIM(?) LIMIT 1`,
    [params.ubigeo, params.dni],
  );
  return (rows as any[]).length > 0;
}

