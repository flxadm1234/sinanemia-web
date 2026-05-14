import { getDbPool } from "@/lib/db";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export type DashboardMonth = {
  ubigeo: string;
  year: number;
  numero_mes: number;
  meses: string;
  etapa: string;
};

export function mesToEtapa(year: number, numero_mes: number) {
  return `${year}-${pad2(numero_mes)}-01`;
}

export async function listDistinctUbigeosFromMeses() {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT DISTINCT ubigeo FROM meses WHERE ubigeo IS NOT NULL AND ubigeo <> '' ORDER BY ubigeo ASC",
  );
  return (rows as any[]).map((r) => String(r.ubigeo ?? "").trim()).filter(Boolean);
}

export async function listDashboardMonthsByUbigeo(ubigeo: string, limit = 24) {
  const pool = getDbPool();
  const lim = Math.min(Math.max(limit, 1), 48);
  const [rows] = await pool.query(
    `SELECT ubigeo, year, numero_mes, meses
     FROM meses
     WHERE ubigeo = ?
     ORDER BY year DESC, numero_mes DESC
     LIMIT ${lim}`,
    [ubigeo],
  );
  return (rows as any[]).map((r) => {
    const year = Number(r.year ?? 0);
    const numero_mes = Number(r.numero_mes ?? 0);
    const meses = String(r.meses ?? "").trim();
    const u = String(r.ubigeo ?? "").trim();
    return { ubigeo: u, year, numero_mes, meses, etapa: mesToEtapa(year, numero_mes) };
  }) as DashboardMonth[];
}

export async function getLatestDashboardMonthAny() {
  const pool = getDbPool();
  const [rows] = await pool.query(
    "SELECT ubigeo, year, numero_mes, meses FROM meses ORDER BY year DESC, numero_mes DESC LIMIT 1",
  );
  const r = (rows as any[])[0] as any | undefined;
  if (!r) return null;
  const year = Number(r.year ?? 0);
  const numero_mes = Number(r.numero_mes ?? 0);
  const meses = String(r.meses ?? "").trim();
  const ubigeo = String(r.ubigeo ?? "").trim();
  if (!ubigeo || !Number.isFinite(year) || !Number.isFinite(numero_mes)) return null;
  return { ubigeo, year, numero_mes, meses, etapa: mesToEtapa(year, numero_mes) } as DashboardMonth;
}

function assignedWhere() {
  return "actorsocial IS NOT NULL AND TRIM(actorsocial) <> '' AND TRIM(actorsocial) <> '0'";
}

export async function countAsignados(params: {
  etapa: string;
  ubigeo?: string;
  actor?: string;
  responsable?: string;
}) {
  const pool = getDbPool();
  const where: string[] = ["etapa = ?", assignedWhere()];
  const values: any[] = [params.etapa];
  if (params.ubigeo) {
    where.push("ubigeo = ?");
    values.push(Number(params.ubigeo));
  }
  if (params.actor) {
    where.push("actorsocial = ?");
    values.push(params.actor);
  }
  if (params.responsable) {
    where.push("responsable = ?");
    values.push(params.responsable);
  }
  const [rows] = await pool.query(
    `SELECT COUNT(*) as c FROM padronnominal WHERE ${where.join(" AND ")}`,
    values,
  );
  return Number((rows as any[])[0]?.c ?? 0);
}

export type TimelinePoint = { etapa: string; label: string; assigned: number };

export async function timelineAsignados(params: {
  months: DashboardMonth[];
  ubigeo?: string;
  actor?: string;
  responsable?: string;
}) {
  if (!params.months.length) return [] as TimelinePoint[];
  const pool = getDbPool();
  const etapas = params.months.map((m) => m.etapa);
  const placeholders = etapas.map(() => "?").join(",");
  const where: string[] = [`etapa IN (${placeholders})`, assignedWhere()];
  const values: any[] = [...etapas];
  if (params.ubigeo) {
    where.push("ubigeo = ?");
    values.push(Number(params.ubigeo));
  }
  if (params.actor) {
    where.push("actorsocial = ?");
    values.push(params.actor);
  }
  if (params.responsable) {
    where.push("responsable = ?");
    values.push(params.responsable);
  }
  const [rows] = await pool.query(
    `SELECT etapa, COUNT(*) as c
     FROM padronnominal
     WHERE ${where.join(" AND ")}
     GROUP BY etapa`,
    values,
  );
  const map = new Map<string, number>();
  for (const r of rows as any[]) {
    const etapa = String(r.etapa ?? "").slice(0, 10);
    map.set(etapa, Number(r.c ?? 0));
  }
  return params.months
    .slice()
    .reverse()
    .map((m) => ({
      etapa: m.etapa,
      label: `${pad2(m.numero_mes)}/${m.year}`,
      assigned: map.get(m.etapa) ?? 0,
    }));
}

export type EstadosvdItem = { estado: string; count: number };

export async function estadosvdDistribucion(params: {
  etapa: string;
  ubigeo?: string;
  actor?: string;
  responsable?: string;
  limit?: number;
}) {
  const pool = getDbPool();
  const where: string[] = ["etapa = ?"];
  const values: any[] = [params.etapa];
  if (params.ubigeo) {
    where.push("ubigeo = ?");
    values.push(Number(params.ubigeo));
  }
  if (params.actor) {
    where.push("actorsocial = ?");
    values.push(params.actor);
  }
  if (params.responsable) {
    where.push("responsable = ?");
    values.push(params.responsable);
  }
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
  const [rows] = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(estadosvd), ''), 'SIN ESTADO') as estado, COUNT(*) as c
     FROM padronnominal
     WHERE ${where.join(" AND ")}
     GROUP BY COALESCE(NULLIF(TRIM(estadosvd), ''), 'SIN ESTADO')
     ORDER BY c DESC
     LIMIT ${limit}`,
    values,
  );
  return (rows as any[]).map((r) => ({
    estado: String(r.estado ?? "SIN ESTADO"),
    count: Number(r.c ?? 0),
  })) as EstadosvdItem[];
}

export type UbigeoAgg = { code: string; count: number };

async function ubigeoAggByPrefix(params: { etapa: string; prefixLen: 2 | 4 | 6; limit?: number }) {
  const pool = getDbPool();
  const limit = Math.min(Math.max(params.limit ?? 80, 1), 500);
  const [rows] = await pool.query(
    `SELECT LEFT(LPAD(CAST(ubigeo AS CHAR), 6, '0'), ${params.prefixLen}) as code, COUNT(*) as c
     FROM padronnominal
     WHERE etapa = ? AND ${assignedWhere()}
     GROUP BY LEFT(LPAD(CAST(ubigeo AS CHAR), 6, '0'), ${params.prefixLen})
     ORDER BY c DESC
     LIMIT ${limit}`,
    [params.etapa],
  );
  return (rows as any[]).map((r) => ({
    code: String(r.code ?? "").trim(),
    count: Number(r.c ?? 0),
  })) as UbigeoAgg[];
}

export async function resumenPorDepartamento(params: { etapa: string; limit?: number }) {
  return ubigeoAggByPrefix({ etapa: params.etapa, prefixLen: 2, limit: params.limit });
}

export async function resumenPorProvincia(params: { etapa: string; limit?: number }) {
  return ubigeoAggByPrefix({ etapa: params.etapa, prefixLen: 4, limit: params.limit });
}

export async function resumenPorDistrito(params: { etapa: string; limit?: number }) {
  return ubigeoAggByPrefix({ etapa: params.etapa, prefixLen: 6, limit: params.limit });
}

