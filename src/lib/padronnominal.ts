import { getDbPool } from "@/lib/db";

export async function updatePadronActorSocial(params: {
  ubigeo: number;
  etapa: string;
  actorAnterior: string;
  actorNuevo: string;
}) {
  const pool = getDbPool();
  const [res] = await pool.query(
    "UPDATE padronnominal SET actorsocial = ? WHERE etapa = ? AND ubigeo = ? AND actorsocial = ?",
    [params.actorNuevo, params.etapa, params.ubigeo, params.actorAnterior],
  );
  return res as any;
}

export async function updatePadronResponsable(params: {
  ubigeo: number;
  etapa: string;
  responsableAnterior: string;
  responsableNuevo: string;
}) {
  const pool = getDbPool();
  const [res] = await pool.query(
    "UPDATE padronnominal SET responsable = ? WHERE etapa = ? AND ubigeo = ? AND responsable = ?",
    [
      params.responsableNuevo,
      params.etapa,
      params.ubigeo,
      params.responsableAnterior,
    ],
  );
  return res as any;
}

export type PadronRow = {
  idpn: number;
  dni: string | null;
  nombres: string | null;
  direccion: string | null;
  referencia: string | null;
  eess_ua: string | null;
  actorsocial: string | null;
  responsable: string | null;
};

export async function searchPadronNominal(params: {
  ubigeo: number;
  etapa: string;
  q?: string;
  limit?: number;
}) {
  const pool = getDbPool();
  const where: string[] = ["ubigeo = ?", "etapa = ?"];
  const values: any[] = [params.ubigeo, params.etapa];

  if (params.q && params.q.trim()) {
    const like = `%${params.q.trim()}%`;
    where.push(
      "(dni LIKE ? OR direccion LIKE ? OR referencia LIKE ? OR eess_ua LIKE ?)",
    );
    values.push(like, like, like, like);
  }

  const limit = Math.min(Math.max(params.limit ?? 200, 1), 500);
  const [rows] = await pool.query(
    `SELECT idpn, dni, nombres, direccion, referencia, eess_ua, actorsocial, responsable
     FROM padronnominal
     WHERE ${where.join(" AND ")}
     ORDER BY idpn DESC
     LIMIT ${limit}`,
    values,
  );
  return rows as PadronRow[];
}

export async function countAsignadosActor(params: {
  ubigeo: number;
  etapa: string;
  actor: string;
}) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT COUNT(*) as c FROM padronnominal WHERE ubigeo = ? AND etapa = ? AND actorsocial = ?",
    [params.ubigeo, params.etapa, params.actor],
  );
  return Number((rows as any[])[0]?.c ?? 0);
}

export async function countSeleccionYaAsignado(params: {
  ubigeo: number;
  etapa: string;
  actor: string;
  ids: number[];
}) {
  if (!params.ids.length) return 0;
  const pool = getDbPool();
  const placeholders = params.ids.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT COUNT(*) as c FROM padronnominal WHERE ubigeo = ? AND etapa = ? AND actorsocial = ? AND idpn IN (${placeholders})`,
    [params.ubigeo, params.etapa, params.actor, ...params.ids],
  );
  return Number((rows as any[])[0]?.c ?? 0);
}

export async function countIdsEnEtapaUbigeo(params: {
  ubigeo: number;
  etapa: string;
  ids: number[];
}) {
  if (!params.ids.length) return 0;
  const pool = getDbPool();
  const placeholders = params.ids.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT COUNT(*) as c FROM padronnominal WHERE ubigeo = ? AND etapa = ? AND idpn IN (${placeholders})`,
    [params.ubigeo, params.etapa, ...params.ids],
  );
  return Number((rows as any[])[0]?.c ?? 0);
}

export async function asignarPadron(params: {
  ubigeo: number;
  etapa: string;
  ids: number[];
  actor: string;
  responsable: string;
}) {
  if (!params.ids.length) return { affectedRows: 0 };
  const pool = getDbPool();
  const placeholders = params.ids.map(() => "?").join(",");
  const [res] = await pool.query(
    `UPDATE padronnominal SET actorsocial = ?, responsable = ? WHERE ubigeo = ? AND etapa = ? AND idpn IN (${placeholders})`,
    [params.actor, params.responsable, params.ubigeo, params.etapa, ...params.ids],
  );
  return res as any;
}
