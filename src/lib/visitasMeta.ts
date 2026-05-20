import { getDbPool } from "@/lib/db";
import { ensureVisitasTables } from "@/lib/visitasImport";

function assignedWhere() {
  return "actorsocial IS NOT NULL AND TRIM(actorsocial) <> '' AND TRIM(actorsocial) <> '0'";
}

function ninosWhere() {
  return "TRIM(COALESCE(tipovd,'')) = '1'";
}

function seguroValidoWhere() {
  return "(tiposeguro IS NULL OR TRIM(tiposeguro) = '' OR UPPER(TRIM(tiposeguro)) = 'SIS')";
}

function edadEnRangoWhere() {
  return "(fecha_nac IS NOT NULL AND DATEDIFF(LAST_DAY(etapa), fecha_nac) BETWEEN 30 AND 389)";
}

export type VisitasMetaPoint = {
  etapa: string;
  label: string;
  denom: number;
  numer: number;
};

export async function computeVisitasMetaSeries(params: {
  ubigeo: number;
  etapas: string[];
  actor?: string;
  responsable?: string;
}) {
  await ensureVisitasTables();
  if (!params.etapas.length) return [] as VisitasMetaPoint[];

  const pool = getDbPool();
  const etapas = params.etapas;
  const placeholders = etapas.map(() => "?").join(",");
  const whereExtra: string[] = [];
  const values: any[] = [...etapas, params.ubigeo];
  if (params.actor) {
    whereExtra.push("pn.actorsocial = ?");
    values.push(params.actor);
  }
  if (params.responsable) {
    whereExtra.push("pn.responsable = ?");
    values.push(params.responsable);
  }

  const [rows] = await pool.query(
    `
    SELECT
      DATE_FORMAT(pn.etapa, '%Y-%m-01') AS etapa_mes,
      COUNT(DISTINCT pn.dni) AS denom,
      COUNT(DISTINCT IF(vm.cumple = 1, pn.dni, NULL)) AS numer
    FROM padronnominal pn
    LEFT JOIN visitas_mensual vm
      ON vm.ubigeo = pn.ubigeo
      AND vm.etapa_mes = STR_TO_DATE(DATE_FORMAT(pn.etapa, '%Y-%m-01'), '%Y-%m-%d')
      AND TRIM(vm.dni_nino) = TRIM(pn.dni)
    WHERE
      DATE_FORMAT(pn.etapa, '%Y-%m-01') IN (${placeholders})
      AND pn.ubigeo = ?
      AND ${ninosWhere()}
      AND ${assignedWhere()}
      AND ${edadEnRangoWhere()}
      AND ${seguroValidoWhere()}
      ${whereExtra.length ? `AND ${whereExtra.join(" AND ")}` : ""}
    GROUP BY DATE_FORMAT(pn.etapa, '%Y-%m-01')
    ORDER BY etapa_mes ASC
    `,
    values,
  );

  const map = new Map<string, { denom: number; numer: number }>();
  for (const r of rows as any[]) {
    const etapa = String(r.etapa_mes ?? "").slice(0, 10);
    map.set(etapa, { denom: Number(r.denom ?? 0), numer: Number(r.numer ?? 0) });
  }

  return etapas
    .slice()
    .sort()
    .map((etapa) => {
      const [y, m] = etapa.split("-").map((x) => Number(x));
      const label = Number.isFinite(m) && Number.isFinite(y) ? `${String(m).padStart(2, "0")}/${y}` : etapa;
      const v = map.get(etapa) ?? { denom: 0, numer: 0 };
      return { etapa, label, denom: v.denom, numer: v.numer } as VisitasMetaPoint;
    });
}

export type VisitasMetaDetalle = {
  etapa: string;
  total_asignados: number;
  excl_edad: number;
  excl_seguro: number;
  denom_total: number;
  numer_total: number;
  sin_registro_visita: number;
  no_completa: number;
  no_oportuna: number;
};

export async function computeVisitasMetaDetalleMes(params: {
  ubigeo: number;
  etapa: string;
  actor?: string;
  responsable?: string;
}) {
  await ensureVisitasTables();
  const pool = getDbPool();
  const whereExtra: string[] = [];
  const values: any[] = [params.etapa, params.ubigeo];
  if (params.actor) {
    whereExtra.push("pn.actorsocial = ?");
    values.push(params.actor);
  }
  if (params.responsable) {
    whereExtra.push("pn.responsable = ?");
    values.push(params.responsable);
  }

  const [rows] = await pool.query(
    `
    SELECT
      COUNT(*) AS total_asignados,
      SUM(CASE WHEN NOT ${edadEnRangoWhere()} THEN 1 ELSE 0 END) AS excl_edad,
      SUM(CASE WHEN ${edadEnRangoWhere()} AND NOT ${seguroValidoWhere()} THEN 1 ELSE 0 END) AS excl_seguro,
      SUM(CASE WHEN ${edadEnRangoWhere()} AND ${seguroValidoWhere()} THEN 1 ELSE 0 END) AS denom_total,
      SUM(CASE WHEN ${edadEnRangoWhere()} AND ${seguroValidoWhere()} AND vm.cumple = 1 THEN 1 ELSE 0 END) AS numer_total,
      SUM(CASE WHEN ${edadEnRangoWhere()} AND ${seguroValidoWhere()} AND (vm.visitas_count IS NULL OR vm.visitas_count = 0) THEN 1 ELSE 0 END) AS sin_registro_visita,
      SUM(CASE WHEN ${edadEnRangoWhere()} AND ${seguroValidoWhere()} AND vm.visitas_count > 0 AND vm.completa = 0 THEN 1 ELSE 0 END) AS no_completa,
      SUM(CASE WHEN ${edadEnRangoWhere()} AND ${seguroValidoWhere()} AND vm.completa = 1 AND vm.oportuna = 0 THEN 1 ELSE 0 END) AS no_oportuna
    FROM padronnominal pn
    LEFT JOIN visitas_mensual vm
      ON vm.ubigeo = pn.ubigeo
      AND vm.etapa_mes = STR_TO_DATE(DATE_FORMAT(pn.etapa, '%Y-%m-01'), '%Y-%m-%d')
      AND TRIM(vm.dni_nino) = TRIM(pn.dni)
    WHERE
      DATE_FORMAT(pn.etapa, '%Y-%m-01') = ?
      AND pn.ubigeo = ?
      AND ${ninosWhere()}
      AND ${assignedWhere()}
      ${whereExtra.length ? `AND ${whereExtra.join(" AND ")}` : ""}
    `,
    values,
  );

  const r = (rows as any[])[0] ?? {};
  return {
    etapa: params.etapa,
    total_asignados: Number(r.total_asignados ?? 0),
    excl_edad: Number(r.excl_edad ?? 0),
    excl_seguro: Number(r.excl_seguro ?? 0),
    denom_total: Number(r.denom_total ?? 0),
    numer_total: Number(r.numer_total ?? 0),
    sin_registro_visita: Number(r.sin_registro_visita ?? 0),
    no_completa: Number(r.no_completa ?? 0),
    no_oportuna: Number(r.no_oportuna ?? 0),
  } as VisitasMetaDetalle;
}

export type VisitaDetalleRow = {
  ubigeo: number;
  etapa_mes: string;
  dni: string;
  nombrecompleto: string | null;
  actorsocial: string | null;
  responsable: string | null;
  tiposeguro: string | null;
  fecha_nac: any;
  expected_visits: number | null;
  visitas_count: number;
  fecha_v1: any;
  fecha_v2: any;
  fecha_v3: any;
  completa: number;
  oportuna: number;
  cumple: number;
  georef_visits: number;
  has_georef: number;
};

export async function listVisitasDetallePorMes(params: {
  ubigeo: number;
  etapa: string;
  actor?: string;
  responsable?: string;
}) {
  await ensureVisitasTables();
  const pool = getDbPool();
  const where: string[] = [
    "DATE_FORMAT(pn.etapa, '%Y-%m-01') = ?",
    "pn.ubigeo = ?",
    ninosWhere(),
    assignedWhere(),
  ];
  const values: any[] = [params.etapa, params.ubigeo];
  if (params.actor) {
    where.push("pn.actorsocial = ?");
    values.push(params.actor);
  }
  if (params.responsable) {
    where.push("pn.responsable = ?");
    values.push(params.responsable);
  }
  const [rows] = await pool.query(
    `
    SELECT
      pn.ubigeo,
      DATE_FORMAT(pn.etapa, '%Y-%m-01') AS etapa_mes,
      pn.dni,
      pn.nombrecompleto,
      pn.actorsocial,
      pn.responsable,
      pn.tiposeguro,
      pn.fecha_nac,
      vm.expected_visits,
      COALESCE(vm.visitas_count, 0) AS visitas_count,
      vm.fecha_v1,
      vm.fecha_v2,
      vm.fecha_v3,
      COALESCE(vm.completa, 0) AS completa,
      COALESCE(vm.oportuna, 0) AS oportuna,
      COALESCE(vm.cumple, 0) AS cumple,
      COALESCE(vm.georef_visits, 0) AS georef_visits,
      COALESCE(vm.has_georef, 0) AS has_georef
    FROM padronnominal pn
    LEFT JOIN visitas_mensual vm
      ON vm.ubigeo = pn.ubigeo
      AND vm.etapa_mes = STR_TO_DATE(DATE_FORMAT(pn.etapa, '%Y-%m-01'), '%Y-%m-%d')
      AND TRIM(vm.dni_nino) = TRIM(pn.dni)
    WHERE ${where.join(" AND ")}
    ORDER BY pn.dni ASC
    `,
    values,
  );
  return rows as any as VisitaDetalleRow[];
}

