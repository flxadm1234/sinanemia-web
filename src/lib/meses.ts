import { getDbPool } from "@/lib/db";

export type MesRow = {
  idmeses: number;
  numero_mes: number;
  meses: string;
  year: number;
  seleccion: number | null;
  tramo?: number;
  ubigeo: string;
  valla_min?: number;
};

function normalizeUbigeo(v: number | string) {
  const s = String(v).trim();
  if (!s) return "";
  return s.length >= 6 ? s : s.padStart(6, "0");
}

let ensuredValla = false;
async function ensureVallaMinColumn() {
  if (ensuredValla) return;
  const pool = getDbPool();
  try {
    await pool.query("ALTER TABLE meses ADD COLUMN valla_min INT NOT NULL DEFAULT 60");
  } catch (e: any) {
    const code = String(e?.code ?? "");
    if (code !== "ER_DUP_FIELDNAME") throw e;
  }
  try {
    await pool.query("UPDATE meses SET valla_min = 60 WHERE valla_min IS NULL");
  } catch {}
  ensuredValla = true;
}

export async function ensureMesesVallaMinColumn() {
  await ensureVallaMinColumn();
}

export async function getEtapaSeleccionadaPorUbigeo(ubigeo: number | string) {
  await ensureVallaMinColumn();
  const pool = getDbPool();
  const ubigeoStr = normalizeUbigeo(ubigeo);
  const [rows] = await pool.query(
    "SELECT numero_mes, year FROM meses WHERE ubigeo = ? AND seleccion = 1 ORDER BY year DESC, numero_mes DESC LIMIT 1",
    [ubigeoStr],
  );
  const row = (rows as any[])[0] as { numero_mes: number; year: number } | undefined;
  if (!row) return null;

  const mm = String(row.numero_mes).padStart(2, "0");
  const etapa = `${row.year}-${mm}-01`;
  return { numero_mes: row.numero_mes, year: row.year, etapa };
}

export async function listMesesByUbigeo(ubigeo: number | string): Promise<MesRow[]> {
  await ensureVallaMinColumn();
  const pool = getDbPool();
  const ubigeoStr = normalizeUbigeo(ubigeo);
  const [rows] = await pool.query(
    "SELECT idmeses, numero_mes, meses, year, seleccion, tramo, ubigeo, valla_min FROM meses WHERE ubigeo = ? ORDER BY year DESC, numero_mes DESC, idmeses DESC",
    [ubigeoStr],
  );
  return rows as MesRow[];
}

export async function listMesesAll(): Promise<MesRow[]> {
  await ensureVallaMinColumn();
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT idmeses, numero_mes, meses, year, seleccion, tramo, ubigeo, valla_min FROM meses ORDER BY ubigeo ASC, year DESC, numero_mes DESC, idmeses DESC",
  );
  return rows as MesRow[];
}

export async function findMesById(params: {
  ubigeo: number | string;
  idmeses: number;
}): Promise<MesRow | null> {
  await ensureVallaMinColumn();
  const pool = getDbPool();
  const ubigeoStr = normalizeUbigeo(params.ubigeo);
  const [rows] = await pool.query(
    "SELECT idmeses, numero_mes, meses, year, seleccion, tramo, ubigeo, valla_min FROM meses WHERE ubigeo = ? AND idmeses = ? LIMIT 1",
    [ubigeoStr, params.idmeses],
  );
  return ((rows as any[])[0] as MesRow | undefined) ?? null;
}

export async function findMesByIdAny(idmeses: number): Promise<MesRow | null> {
  await ensureVallaMinColumn();
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT idmeses, numero_mes, meses, year, seleccion, tramo, ubigeo, valla_min FROM meses WHERE idmeses = ? LIMIT 1",
    [idmeses],
  );
  return ((rows as any[])[0] as MesRow | undefined) ?? null;
}

export async function createMes(input: {
  ubigeo: number | string;
  numero_mes: number;
  meses: string;
  year: number;
  seleccion?: number | null;
  valla_min: number;
}): Promise<any> {
  await ensureVallaMinColumn();
  const pool = getDbPool();
  const ubigeoStr = normalizeUbigeo(input.ubigeo);
  const [res] = await pool.query(
    "INSERT INTO meses (numero_mes, meses, year, seleccion, tramo, ubigeo, valla_min) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      input.numero_mes,
      input.meses,
      input.year,
      input.seleccion ?? 0,
      0,
      ubigeoStr,
      input.valla_min,
    ],
  );
  return res as any;
}

export async function updateMesById(input: {
  ubigeo: number | string;
  idmeses: number;
  patch: Partial<{
    numero_mes: number;
    meses: string;
    year: number;
    valla_min: number;
  }>;
}): Promise<any> {
  await ensureVallaMinColumn();
  const keys = Object.keys(input.patch) as (keyof typeof input.patch)[];
  if (!keys.length) return;
  const pool = getDbPool();
  const ubigeoStr = normalizeUbigeo(input.ubigeo);
  const set = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => (input.patch as any)[k]);
  const [res] = await pool.query(
    `UPDATE meses SET ${set} WHERE ubigeo = ? AND idmeses = ?`,
    [...values, ubigeoStr, input.idmeses],
  );
  return res as any;
}

export async function updateMesByIdAny(input: {
  idmeses: number;
  patch: Partial<{
    numero_mes: number;
    meses: string;
    year: number;
    ubigeo: string;
    valla_min: number;
  }>;
}): Promise<any> {
  await ensureVallaMinColumn();
  const keys = Object.keys(input.patch) as (keyof typeof input.patch)[];
  if (!keys.length) return;
  const pool = getDbPool();
  const set = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => (input.patch as any)[k]);
  const [res] = await pool.query(
    `UPDATE meses SET ${set} WHERE idmeses = ?`,
    [...values, input.idmeses],
  );
  return res as any;
}

export async function setMesSeleccionadoById(input: {
  ubigeo: number | string;
  idmeses: number;
}): Promise<void> {
  await ensureVallaMinColumn();
  const pool = getDbPool();
  const ubigeoStr = normalizeUbigeo(input.ubigeo);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE meses SET seleccion = 0 WHERE ubigeo = ?", [ubigeoStr]);
    await conn.query(
      "UPDATE meses SET seleccion = 1 WHERE ubigeo = ? AND idmeses = ?",
      [ubigeoStr, input.idmeses],
    );
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

