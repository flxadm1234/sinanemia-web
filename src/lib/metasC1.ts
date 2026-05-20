import { getDbPool } from "@/lib/db";

export type MetaC1Tipo = 1 | 2 | 3 | 4 | 5;

export type MetaC1Row = {
  ubigeo: string;
  tipo: MetaC1Tipo;
  descripcion_meta: string;
  valla_min: number;
  updated_at: string;
};

const defaults: Record<MetaC1Tipo, { descripcion_meta: string; valla_min: number }> = {
  1: {
    descripcion_meta: "META DEL INDICADOR 1.1 NIÑOS DE 6 Y/O 12 MESES DE EDAD SIN ANEMIA",
    valla_min: 60,
  },
  2: {
    descripcion_meta: "META DE VISITAS COMPLETAS Y OPORTUNAS",
    valla_min: 60,
  },
  3: {
    descripcion_meta: "META GEORREFERENCIA",
    valla_min: 60,
  },
  4: {
    descripcion_meta: "META ACTUALIZACIÓN TELEFÓNICA",
    valla_min: 60,
  },
  5: {
    descripcion_meta: "META ACTUALIZACIÓN DEL PADRÓN NOMINAL (0-12 MESES)",
    valla_min: 60,
  },
};

function normalizeUbigeo(v: number | string) {
  const s = String(v).trim();
  if (!s) return "";
  return s.length >= 6 ? s : s.padStart(6, "0");
}

export async function ensureMetasC1Table() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS metas_c1 (
      ubigeo VARCHAR(6) NOT NULL,
      tipo TINYINT NOT NULL,
      descripcion_meta VARCHAR(255) NOT NULL,
      valla_min INT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (ubigeo, tipo)
    ) ENGINE=InnoDB
  `);
}

export async function ensureMetasC1DefaultsForUbigeo(ubigeo: number | string) {
  await ensureMetasC1Table();
  const pool = getDbPool();
  const u = normalizeUbigeo(ubigeo);
  if (!u) return;
  for (const tipo of [1, 2, 3, 4, 5] as MetaC1Tipo[]) {
    const d = defaults[tipo];
    await pool.query(
      `INSERT INTO metas_c1 (ubigeo, tipo, descripcion_meta, valla_min)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE ubigeo = ubigeo`,
      [u, tipo, d.descripcion_meta, d.valla_min],
    );
  }
}

export async function listMetasC1ByUbigeo(ubigeo: number | string) {
  await ensureMetasC1Table();
  const pool = getDbPool();
  const u = normalizeUbigeo(ubigeo);
  const [rows] = await pool.query(
    "SELECT ubigeo, tipo, descripcion_meta, valla_min, updated_at FROM metas_c1 WHERE ubigeo = ? ORDER BY tipo ASC",
    [u],
  );
  return rows as MetaC1Row[];
}

export async function getMetaC1ByUbigeoTipo(params: { ubigeo: number | string; tipo: MetaC1Tipo }) {
  await ensureMetasC1Table();
  const pool = getDbPool();
  const u = normalizeUbigeo(params.ubigeo);
  const [rows] = await pool.query(
    "SELECT ubigeo, tipo, descripcion_meta, valla_min, updated_at FROM metas_c1 WHERE ubigeo = ? AND tipo = ? LIMIT 1",
    [u, params.tipo],
  );
  return ((rows as any[])[0] as MetaC1Row | undefined) ?? null;
}

export async function upsertMetaC1(params: {
  ubigeo: number | string;
  tipo: MetaC1Tipo;
  descripcion_meta: string;
  valla_min: number;
}) {
  await ensureMetasC1Table();
  const pool = getDbPool();
  const u = normalizeUbigeo(params.ubigeo);
  await pool.query(
    `INSERT INTO metas_c1 (ubigeo, tipo, descripcion_meta, valla_min)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE descripcion_meta = VALUES(descripcion_meta), valla_min = VALUES(valla_min)`,
    [u, params.tipo, params.descripcion_meta, params.valla_min],
  );
}

