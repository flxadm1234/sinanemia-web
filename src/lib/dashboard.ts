import { getDbPool } from "@/lib/db";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseYmd(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function parseDmy(s: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || "").trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function daysBetweenUTC(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function normalizeDocKey(v: unknown) {
  const raw = String(v ?? "").trim();
  if (!raw) return "SIN DATO";
  const parts = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x === "1" || x === "2" || x === "3" || x === "4");
  if (!parts.length) return "SIN DATO";
  const uniq = Array.from(new Set(parts.map(Number)))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .map(String);
  return uniq.length ? uniq.join(",") : "SIN DATO";
}

function docKeyLabel(docKey: string) {
  const map: Record<string, string> = { "1": "DNI", "2": "CUI", "3": "CNV", "4": "COD.PAD" };
  if (!docKey || docKey === "SIN DATO") return "SIN DATO";
  const parts = docKey.split(",").map((x) => x.trim()).filter(Boolean);
  const labels = parts.map((p) => map[p] || p);
  return `${docKey} (${labels.join(" + ")})`;
}

export type DashboardMonth = {
  ubigeo: string;
  year: number;
  numero_mes: number;
  meses: string;
  seleccion?: number | null;
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
    `SELECT ubigeo, year, numero_mes, meses, seleccion
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
    const seleccion = r.seleccion == null ? null : Number(r.seleccion);
    return {
      ubigeo: u,
      year,
      numero_mes,
      meses,
      seleccion,
      etapa: mesToEtapa(year, numero_mes),
    };
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
  return {
    ubigeo,
    year,
    numero_mes,
    meses,
    etapa: mesToEtapa(year, numero_mes),
  } as DashboardMonth;
}

function assignedWhere() {
  return "actorsocial IS NOT NULL AND TRIM(actorsocial) <> '' AND TRIM(actorsocial) <> '0'";
}

function ninosWhere() {
  return "TRIM(COALESCE(tipovd,'')) = '1'";
}

export type PadronDniDocTypeStat = {
  job_id: string;
  fecha_corte: string;
  total_0_12m: number;
  invalid_birthdate: number;
  breakdown: { doc_key: string; label: string; count: number; pct: number }[];
};

export async function computePadronDniDocTypeStats(params: { ubigeo: number }) {
  const ubigeo = Number(params.ubigeo);
  if (!Number.isFinite(ubigeo) || ubigeo <= 0) return null;

  const pool = getDbPool();
  const [jobRows] = await pool.query(
    `SELECT id, fecha_corte
     FROM padron_dni_import_jobs
     WHERE ubigeo = ? AND status = 'done'
     ORDER BY fecha_corte DESC, created_at DESC, id DESC
     LIMIT 1`,
    [ubigeo],
  );
  const job = (jobRows as any[])[0] as any | undefined;
  if (!job?.id || !job?.fecha_corte) return null;
  const fechaCorte = parseYmd(String(job.fecha_corte ?? ""));
  if (!fechaCorte) return null;

  const [rows] = await pool.query(
    `SELECT
       JSON_UNQUOTE(JSON_EXTRACT(payload, '$[1]')) AS doc_raw,
       JSON_UNQUOTE(JSON_EXTRACT(payload, '$[12]')) AS nac_raw
     FROM padron_dni_raw
     WHERE job_id = ? AND JSON_VALID(payload)`,
    [String(job.id)],
  );

  const counts = new Map<string, number>();
  let total = 0;
  let invalidBirthdate = 0;

  for (const r of rows as any[]) {
    const docKey = normalizeDocKey(r?.doc_raw);
    const nacRaw = String(r?.nac_raw ?? "").trim();
    const nac = parseYmd(nacRaw) ?? parseDmy(nacRaw);
    if (!nac) {
      invalidBirthdate += 1;
      continue;
    }
    const ageDays = daysBetweenUTC(fechaCorte, nac);
    if (ageDays < 0 || ageDays > 365) continue;
    total += 1;
    counts.set(docKey, (counts.get(docKey) ?? 0) + 1);
  }

  const breakdown = Array.from(counts.entries())
    .map(([doc_key, count]) => ({
      doc_key,
      label: docKeyLabel(doc_key),
      count,
      pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.doc_key.localeCompare(b.doc_key));

  return {
    job_id: String(job.id),
    fecha_corte: String(job.fecha_corte),
    total_0_12m: total,
    invalid_birthdate: invalidBirthdate,
    breakdown,
  } satisfies PadronDniDocTypeStat;
}

export async function countAsignados(params: {
  etapa: string;
  ubigeo?: string;
  actor?: string;
  responsable?: string;
}) {
  const pool = getDbPool();
  const where: string[] = ["DATE_FORMAT(etapa, '%Y-%m-01') = ?", ninosWhere(), assignedWhere()];
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

export async function countCargados(params: {
  etapa: string;
  ubigeo?: string;
  actor?: string;
  responsable?: string;
}) {
  const pool = getDbPool();
  const where: string[] = ["DATE_FORMAT(etapa, '%Y-%m-01') = ?", ninosWhere()];
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
  const where: string[] = [`etapa IN (${placeholders})`, ninosWhere(), assignedWhere()];
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

export type TimelineTotalsPoint = { etapa: string; label: string; total: number; assigned: number };

export async function timelineTotales(params: {
  months: DashboardMonth[];
  ubigeo?: string;
  actor?: string;
  responsable?: string;
}) {
  if (!params.months.length) return [] as TimelineTotalsPoint[];
  const pool = getDbPool();
  const etapas = params.months.map((m) => m.etapa);
  const placeholders = etapas.map(() => "?").join(",");
  const where: string[] = [`DATE_FORMAT(etapa, '%Y-%m-01') IN (${placeholders})`, ninosWhere()];
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
    `SELECT DATE_FORMAT(etapa, '%Y-%m-01') as etapa, COUNT(*) as total, SUM(CASE WHEN ${assignedWhere()} THEN 1 ELSE 0 END) as assigned
     FROM padronnominal
     WHERE ${where.join(" AND ")}
     GROUP BY DATE_FORMAT(etapa, '%Y-%m-01')`,
    values,
  );
  const map = new Map<string, { total: number; assigned: number }>();
  for (const r of rows as any[]) {
    const etapa = String(r.etapa ?? "").slice(0, 10);
    map.set(etapa, { total: Number(r.total ?? 0), assigned: Number(r.assigned ?? 0) });
  }
  return params.months
    .slice()
    .reverse()
    .map((m) => ({
      etapa: m.etapa,
      label: `${pad2(m.numero_mes)}/${m.year}`,
      total: map.get(m.etapa)?.total ?? 0,
      assigned: map.get(m.etapa)?.assigned ?? 0,
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
  const where: string[] = ["DATE_FORMAT(etapa, '%Y-%m-01') = ?", ninosWhere()];
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
     WHERE DATE_FORMAT(etapa, '%Y-%m-01') = ? AND ${assignedWhere()}
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

export async function countActoresSocialesActivos(params: { ubigeo?: string; cdr?: string }) {
  const pool = getDbPool();
  const where: string[] = ["UPPER(tipo) LIKE 'ACTOR SOCIAL%'", "estado = 1"];
  const values: any[] = [];
  if (params.ubigeo) {
    where.push("ubigeo = ?");
    values.push(Number(params.ubigeo));
  }
  if (params.cdr && params.cdr.trim()) {
    where.push("cdr = ?");
    values.push(params.cdr.trim());
  }
  const [rows] = await pool.query(
    `SELECT COUNT(*) as c FROM persona WHERE ${where.join(" AND ")}`,
    values,
  );
  return Number((rows as any[])[0]?.c ?? 0);
}

export async function countCoordinadoresActivos(params: { ubigeo?: string }) {
  const pool = getDbPool();
  const where: string[] = ["UPPER(tipo) = 'COORDINADOR'", "estado = 1"];
  const values: any[] = [];
  if (params.ubigeo) {
    where.push("ubigeo = ?");
    values.push(Number(params.ubigeo));
  }
  const [rows] = await pool.query(
    `SELECT COUNT(*) as c FROM persona WHERE ${where.join(" AND ")}`,
    values,
  );
  return Number((rows as any[])[0]?.c ?? 0);
}

