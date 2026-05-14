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

