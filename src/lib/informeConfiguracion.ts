import { getDbPool } from "@/lib/db";

export type InformeConfiguracionRow = {
  id: number;
  ubigeo: string;
  entidad_nombre: string | null;
  gerencia_nombre: string | null;
  lema_anual: string | null;
  logo_path: string | null;
  pie_cargo: string | null;
  ciudad: string | null;
  activo: number;
  created_at: string;
  updated_at: string;
};

function normalizeUbigeo(v: number | string) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length >= 6 ? s : s.padStart(6, "0");
}

export async function ensureInformeConfiguracionTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS informe_configuracion (
      id INT NOT NULL AUTO_INCREMENT,
      ubigeo VARCHAR(6) NOT NULL,
      entidad_nombre VARCHAR(255) NULL,
      gerencia_nombre VARCHAR(255) NULL,
      lema_anual VARCHAR(255) NULL,
      logo_path VARCHAR(600) NULL,
      pie_cargo VARCHAR(255) NULL,
      ciudad VARCHAR(120) NULL,
      activo TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_informe_configuracion_ubigeo (ubigeo),
      KEY idx_informe_configuracion_activo (activo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  try {
    await pool.query("ALTER TABLE informe_configuracion ADD COLUMN ubigeo VARCHAR(6) NOT NULL DEFAULT '000000'");
  } catch {}
}

export async function listInformeConfiguracion(params: {
  role: "SUPER ADMIN" | "ADMINISTRADOR";
  sessionUbigeo: number | null;
  ubigeo?: number | string;
  q?: string;
  limit: number;
  offset: number;
}) {
  const pool = getDbPool();
  const where: string[] = [];
  const values: any[] = [];
  const countValues: any[] = [];

  const limit = Math.max(1, Math.min(200, Math.floor(params.limit)));
  const offset = Math.max(0, Math.floor(params.offset));

  if (params.role !== "SUPER ADMIN") {
    const u = params.sessionUbigeo ? normalizeUbigeo(params.sessionUbigeo) : "";
    if (!u) return { total: 0, rows: [] as InformeConfiguracionRow[] };
    where.push("ubigeo = ?");
    values.push(u);
    countValues.push(u);
  } else if (params.ubigeo) {
    const u = normalizeUbigeo(params.ubigeo);
    if (u) {
      where.push("ubigeo = ?");
      values.push(u);
      countValues.push(u);
    }
  }

  if (params.q && params.q.trim()) {
    const q = `%${params.q.trim()}%`;
    where.push(
      "(UPPER(entidad_nombre) LIKE UPPER(?) OR UPPER(gerencia_nombre) LIKE UPPER(?) OR UPPER(ciudad) LIKE UPPER(?) OR ubigeo LIKE ?)",
    );
    values.push(q, q, q, q);
    countValues.push(q, q, q, q);
  }

  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM informe_configuracion${whereSql}`,
    countValues,
  );
  const total = Number((countRows as any[])[0]?.total ?? 0);

  const [rows] = await pool.query(
    `SELECT id, ubigeo, entidad_nombre, gerencia_nombre, lema_anual, logo_path, pie_cargo, ciudad, activo, created_at, updated_at
     FROM informe_configuracion${whereSql}
     ORDER BY ubigeo ASC, updated_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset],
  );
  return { total, rows: rows as InformeConfiguracionRow[] };
}

export async function getInformeConfiguracionById(params: {
  id: number;
  role: "SUPER ADMIN" | "ADMINISTRADOR";
  sessionUbigeo: number | null;
}) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT id, ubigeo, entidad_nombre, gerencia_nombre, lema_anual, logo_path, pie_cargo, ciudad, activo, created_at, updated_at FROM informe_configuracion WHERE id = ? LIMIT 1",
    [params.id],
  );
  const row = (rows as any[])[0] as InformeConfiguracionRow | undefined;
  if (!row) return null;
  if (params.role !== "SUPER ADMIN") {
    const u = params.sessionUbigeo ? normalizeUbigeo(params.sessionUbigeo) : "";
    if (!u || String(row.ubigeo) !== u) return null;
  }
  return row;
}

export async function createInformeConfiguracion(input: {
  role: "SUPER ADMIN" | "ADMINISTRADOR";
  sessionUbigeo: number | null;
  ubigeo: number | string;
  entidad_nombre?: string | null;
  gerencia_nombre?: string | null;
  lema_anual?: string | null;
  logo_path?: string | null;
  pie_cargo?: string | null;
  ciudad?: string | null;
  activo?: number | boolean | null;
}) {
  const pool = getDbPool();
  const ubigeo =
    input.role === "SUPER ADMIN"
      ? normalizeUbigeo(input.ubigeo)
      : input.sessionUbigeo
        ? normalizeUbigeo(input.sessionUbigeo)
        : "";
  if (!ubigeo) throw new Error("invalid_ubigeo");

  const activo = input.activo === false || input.activo === 0 ? 0 : 1;

  const [r] = await pool.query(
    `INSERT INTO informe_configuracion
      (ubigeo, entidad_nombre, gerencia_nombre, lema_anual, logo_path, pie_cargo, ciudad, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ubigeo,
      input.entidad_nombre ?? null,
      input.gerencia_nombre ?? null,
      input.lema_anual ?? null,
      input.logo_path ?? null,
      input.pie_cargo ?? null,
      input.ciudad ?? null,
      activo,
    ],
  );
  const id = Number((r as any).insertId ?? 0);
  return await getInformeConfiguracionById({ id, role: input.role, sessionUbigeo: input.sessionUbigeo });
}

export async function updateInformeConfiguracion(input: {
  id: number;
  role: "SUPER ADMIN" | "ADMINISTRADOR";
  sessionUbigeo: number | null;
  ubigeo?: number | string;
  entidad_nombre?: string | null;
  gerencia_nombre?: string | null;
  lema_anual?: string | null;
  logo_path?: string | null;
  pie_cargo?: string | null;
  ciudad?: string | null;
  activo?: number | boolean | null;
}) {
  const existing = await getInformeConfiguracionById({
    id: input.id,
    role: input.role,
    sessionUbigeo: input.sessionUbigeo,
  });
  if (!existing) return null;

  const ubigeo =
    input.role === "SUPER ADMIN" && input.ubigeo ? normalizeUbigeo(input.ubigeo) : existing.ubigeo;
  const activo =
    typeof input.activo === "undefined" ? existing.activo : input.activo === false || input.activo === 0 ? 0 : 1;

  const pool = getDbPool();
  await pool.query(
    `UPDATE informe_configuracion
     SET ubigeo = ?,
         entidad_nombre = ?,
         gerencia_nombre = ?,
         lema_anual = ?,
         logo_path = ?,
         pie_cargo = ?,
         ciudad = ?,
         activo = ?
     WHERE id = ?`,
    [
      ubigeo,
      typeof input.entidad_nombre === "undefined" ? existing.entidad_nombre : input.entidad_nombre,
      typeof input.gerencia_nombre === "undefined" ? existing.gerencia_nombre : input.gerencia_nombre,
      typeof input.lema_anual === "undefined" ? existing.lema_anual : input.lema_anual,
      typeof input.logo_path === "undefined" ? existing.logo_path : input.logo_path,
      typeof input.pie_cargo === "undefined" ? existing.pie_cargo : input.pie_cargo,
      typeof input.ciudad === "undefined" ? existing.ciudad : input.ciudad,
      activo,
      input.id,
    ],
  );
  return await getInformeConfiguracionById({ id: input.id, role: input.role, sessionUbigeo: input.sessionUbigeo });
}

export async function deleteInformeConfiguracion(input: {
  id: number;
  role: "SUPER ADMIN" | "ADMINISTRADOR";
  sessionUbigeo: number | null;
}) {
  const existing = await getInformeConfiguracionById({
    id: input.id,
    role: input.role,
    sessionUbigeo: input.sessionUbigeo,
  });
  if (!existing) return null;
  const pool = getDbPool();
  await pool.query("DELETE FROM informe_configuracion WHERE id = ?", [input.id]);
  return existing;
}

