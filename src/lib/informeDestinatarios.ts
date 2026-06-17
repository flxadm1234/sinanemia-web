import { getDbPool } from "@/lib/db";

export type InformeDestinatarioRow = {
  id: number;
  ubigeo: string;
  nombre: string | null;
  cargo: string | null;
  activo: number;
  orden: number;
  created_at: string;
  updated_at: string;
};

function normalizeUbigeo(v: number | string) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length >= 6 ? s : s.padStart(6, "0");
}

export async function ensureInformeDestinatariosTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS informe_destinatarios (
      id INT NOT NULL AUTO_INCREMENT,
      ubigeo VARCHAR(6) NOT NULL,
      nombre VARCHAR(255) NULL,
      cargo VARCHAR(255) NULL,
      activo TINYINT NOT NULL DEFAULT 1,
      orden INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_informe_destinatarios_ubigeo (ubigeo),
      KEY idx_informe_destinatarios_activo (activo),
      KEY idx_informe_destinatarios_orden (orden)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  try {
    await pool.query("ALTER TABLE informe_destinatarios ADD COLUMN ubigeo VARCHAR(6) NOT NULL DEFAULT '000000'");
  } catch {}
}

export async function listInformeDestinatarios(params: {
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
    if (!u) return { total: 0, rows: [] as InformeDestinatarioRow[] };
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
    where.push("(UPPER(nombre) LIKE UPPER(?) OR UPPER(cargo) LIKE UPPER(?) OR ubigeo LIKE ?)");
    values.push(q, q, q);
    countValues.push(q, q, q);
  }

  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM informe_destinatarios${whereSql}`,
    countValues,
  );
  const total = Number((countRows as any[])[0]?.total ?? 0);

  const [rows] = await pool.query(
    `SELECT id, ubigeo, nombre, cargo, activo, orden, created_at, updated_at
     FROM informe_destinatarios${whereSql}
     ORDER BY ubigeo ASC, orden ASC, id ASC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset],
  );
  return { total, rows: rows as InformeDestinatarioRow[] };
}

export async function getInformeDestinatarioById(params: {
  id: number;
  role: "SUPER ADMIN" | "ADMINISTRADOR";
  sessionUbigeo: number | null;
}) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT id, ubigeo, nombre, cargo, activo, orden, created_at, updated_at FROM informe_destinatarios WHERE id = ? LIMIT 1",
    [params.id],
  );
  const row = (rows as any[])[0] as InformeDestinatarioRow | undefined;
  if (!row) return null;
  if (params.role !== "SUPER ADMIN") {
    const u = params.sessionUbigeo ? normalizeUbigeo(params.sessionUbigeo) : "";
    if (!u || String(row.ubigeo) !== u) return null;
  }
  return row;
}

export async function createInformeDestinatario(input: {
  role: "SUPER ADMIN" | "ADMINISTRADOR";
  sessionUbigeo: number | null;
  ubigeo: number | string;
  nombre?: string | null;
  cargo?: string | null;
  activo?: number | boolean | null;
  orden?: number | null;
}) {
  const pool = getDbPool();
  const ubigeo =
    input.role === "SUPER ADMIN"
      ? normalizeUbigeo(input.ubigeo)
      : input.sessionUbigeo
        ? normalizeUbigeo(input.sessionUbigeo)
        : "";
  if (!ubigeo) throw new Error("invalid_ubigeo");

  const nombre = String(input.nombre ?? "").trim() || null;
  const cargo = String(input.cargo ?? "").trim() || null;
  if (!nombre) throw new Error("invalid_nombre");

  const activo = input.activo === false || input.activo === 0 ? 0 : 1;
  const orden = Number.isFinite(Number(input.orden)) ? Math.max(1, Math.floor(Number(input.orden))) : 1;

  const [r] = await pool.query(
    `INSERT INTO informe_destinatarios (ubigeo, nombre, cargo, activo, orden) VALUES (?, ?, ?, ?, ?)`,
    [ubigeo, nombre, cargo, activo, orden],
  );
  const id = Number((r as any).insertId ?? 0);
  return await getInformeDestinatarioById({ id, role: input.role, sessionUbigeo: input.sessionUbigeo });
}

export async function updateInformeDestinatario(input: {
  id: number;
  role: "SUPER ADMIN" | "ADMINISTRADOR";
  sessionUbigeo: number | null;
  ubigeo?: number | string;
  nombre?: string | null;
  cargo?: string | null;
  activo?: number | boolean | null;
  orden?: number | null;
}) {
  const existing = await getInformeDestinatarioById({
    id: input.id,
    role: input.role,
    sessionUbigeo: input.sessionUbigeo,
  });
  if (!existing) return null;

  const ubigeo =
    input.role === "SUPER ADMIN" && input.ubigeo ? normalizeUbigeo(input.ubigeo) : existing.ubigeo;
  const nombre =
    typeof input.nombre === "undefined" ? existing.nombre : String(input.nombre ?? "").trim() || null;
  const cargo =
    typeof input.cargo === "undefined" ? existing.cargo : String(input.cargo ?? "").trim() || null;
  if (!nombre) throw new Error("invalid_nombre");
  const activo =
    typeof input.activo === "undefined" ? existing.activo : input.activo === false || input.activo === 0 ? 0 : 1;
  const orden =
    typeof input.orden === "undefined"
      ? existing.orden
      : Number.isFinite(Number(input.orden))
        ? Math.max(1, Math.floor(Number(input.orden)))
        : existing.orden;

  const pool = getDbPool();
  await pool.query(
    `UPDATE informe_destinatarios
     SET ubigeo = ?, nombre = ?, cargo = ?, activo = ?, orden = ?
     WHERE id = ?`,
    [ubigeo, nombre, cargo, activo, orden, input.id],
  );
  return await getInformeDestinatarioById({ id: input.id, role: input.role, sessionUbigeo: input.sessionUbigeo });
}

export async function deleteInformeDestinatario(input: {
  id: number;
  role: "SUPER ADMIN" | "ADMINISTRADOR";
  sessionUbigeo: number | null;
}) {
  const existing = await getInformeDestinatarioById({
    id: input.id,
    role: input.role,
    sessionUbigeo: input.sessionUbigeo,
  });
  if (!existing) return null;
  const pool = getDbPool();
  await pool.query("DELETE FROM informe_destinatarios WHERE id = ?", [input.id]);
  return existing;
}

