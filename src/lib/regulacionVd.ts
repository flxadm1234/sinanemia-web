import { getDbPool } from "@/lib/db";

export type ActorVdCargaRow = {
  actorsocial: string;
  nombre: string | null;
  total_nrovd: number;
  ninos: number;
};

export async function listActorVdCarga(params: {
  ubigeo: number;
  etapa: string;
}): Promise<ActorVdCargaRow[]> {
  const pool = getDbPool();
  const [rows] = await pool.query(
    `
    WITH p0 AS (
      SELECT
        dni,
        nombrecompleto,
        ROW_NUMBER() OVER (PARTITION BY dni ORDER BY idpersona DESC) AS rn
      FROM persona
      WHERE UPPER(tipo) LIKE 'ACTOR SOCIAL%'
    )
    SELECT
      TRIM(pn.actorsocial) AS actorsocial,
      MAX(CASE WHEN p0.rn = 1 THEN p0.nombrecompleto ELSE NULL END) AS nombre,
      SUM(COALESCE(pn.nrovd, 0)) AS total_nrovd,
      COUNT(*) AS ninos
    FROM padronnominal pn
    LEFT JOIN p0 ON p0.dni = TRIM(pn.actorsocial)
    WHERE pn.ubigeo = ?
      AND DATE_FORMAT(pn.etapa, '%Y-%m-01') = ?
      AND TRIM(COALESCE(pn.tipovd,'')) = '1'
      AND TRIM(COALESCE(pn.actorsocial,'')) <> ''
      AND COALESCE(pn.nrovd, 0) > 0
    GROUP BY TRIM(pn.actorsocial)
    ORDER BY total_nrovd DESC, ninos DESC, actorsocial ASC
    `,
    [params.ubigeo, params.etapa],
  );
  return rows as ActorVdCargaRow[];
}

