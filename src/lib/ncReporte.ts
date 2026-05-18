import { getDbPool } from "@/lib/db";

type BaseRow = {
  dni: string | null;
  fecha_nac: string | null;
  tiposeguro: string | null;
  actorsocial: string | null;
};

type TamizajeRow = {
  dni: string | null;
  fecha_atencion: string | null;
  cie_10: string | null;
  hemoglobina: number | null;
  lab1: string | null;
  id: number | null;
};

export type NcExclusionDetail = {
  dni: string;
  grupo: "6m" | "12m" | "-";
  motivo: string;
};

export type NcMonthMetrics = {
  etapa: string;
  label: string;
  total_cargados: number;
  total_asignados: number;
  total_con_edad_critica: number;
  total_con_permanencia: number;
  total_con_seguro_valido: number;
  tamizaje_registros_encontrados: number;
  tamizaje_ninos_con_registro: number;
  denom_total: number;
  denom_6m: number;
  denom_12m: number;
  num_total: number;
  num_6m: number;
  num_12m: number;
  sis: number;
  sin_seguro: number;
  con_otro_seguro: number;
  excluciones_denominador: Array<{ motivo: string; count: number }>;
  excluciones_numerador: Array<{ motivo: string; count: number }>;
  excl_detalle: NcExclusionDetail[];
};

function toDate(v: unknown) {
  if (!v) return null;
  if (v instanceof Date && Number.isFinite(v.getTime())) {
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  }
  const s = String(v).trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function fmtDateISO(v: unknown) {
  const d = toDate(v);
  return d ? d.toISOString().slice(0, 10) : null;
}

function endOfMonthUTC(etapaISO: string) {
  const d = toDate(etapaISO);
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0));
  return last;
}

function overlaps(aMin: number, aMax: number, bMin: number, bMax: number) {
  const lo = Math.max(aMin, bMin);
  const hi = Math.min(aMax, bMax);
  return lo <= hi;
}

function daysBetweenUTC(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86400000);
}

function normalizeSeguro(v: unknown) {
  const s = String(v ?? "").trim().toUpperCase();
  return s || "";
}

function normalizeLab(v: unknown) {
  const s = String(v ?? "").trim().toUpperCase();
  return s || "";
}

function anemiaFromCie10(v: unknown) {
  const s = String(v ?? "")
    .trim()
    .toUpperCase()
    .replaceAll(".", "")
    .replaceAll(" ", "");
  return s.startsWith("D509") || s.startsWith("D649");
}

function hbConsistente(hb: number | null, cie10: string | null, lab1: string | null) {
  const _lab = normalizeLab(lab1);
  if (hb == null || !Number.isFinite(hb) || hb <= 0) return { ok: false, motivo: "Sin hemoglobina" };
  if (hb < 6.0 || hb > 18.0) return { ok: false, motivo: "Hemoglobina atípica (<6 o >18)" };
  const anemia = anemiaFromCie10(cie10);
  if (hb >= 10.5 && anemia) return { ok: false, motivo: "HB>=10.5 con diagnóstico de anemia" };
  if (hb < 10.5 && !anemia) return { ok: false, motivo: "HB<10.5 sin diagnóstico de anemia" };
  return { ok: true, motivo: "" };
}

function monthLabel(etapaISO: string) {
  const d = toDate(etapaISO);
  if (!d) return etapaISO;
  const m = d.getUTCMonth() + 1;
  const y = d.getUTCFullYear();
  return `${String(m).padStart(2, "0")}/${y}`;
}

function addDaysUTC(d: Date, days: number) {
  return new Date(d.getTime() + days * 86400000);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function computeNcMetricsForEtapa(params: {
  ubigeo: number;
  etapa: string;
  includeDetails?: boolean;
}) {
  const etapa = String(params.etapa ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(etapa)) return null;
  const etapaDate = toDate(etapa);
  if (!etapaDate) return null;
  if (etapaDate.getUTCFullYear() < 2026) return null;

  const pool = getDbPool();

  const prevEtapa = (() => {
    const y = etapaDate.getUTCFullYear();
    const m = etapaDate.getUTCMonth();
    const prev = new Date(Date.UTC(y, m - 1, 1));
    return prev.getUTCFullYear() < 2026 ? "" : isoDate(prev);
  })();

  const [rowsBase] = await pool.query(
    `SELECT pn.dni, pn.fecha_nac, pn.tiposeguro, pn.actorsocial
     FROM padronnominal pn
     WHERE pn.ubigeo = ? AND pn.etapa = ? AND YEAR(pn.etapa) >= 2026
       AND TRIM(COALESCE(pn.tipovd,'')) = '1'`,
    [params.ubigeo, etapa],
  );

  const baseRows = (rowsBase as any[]).map((r) => ({
    dni: r.dni == null ? null : String(r.dni).trim(),
    fecha_nac: fmtDateISO(r.fecha_nac),
    tiposeguro: r.tiposeguro == null ? null : String(r.tiposeguro),
    actorsocial: r.actorsocial == null ? null : String(r.actorsocial).trim(),
  })) as BaseRow[];

  const byDni = new Map<string, BaseRow>();
  for (const r of baseRows) {
    const dni = String(r.dni ?? "").trim();
    if (!dni) continue;
    if (!byDni.has(dni)) byDni.set(dni, r);
  }

  const totalCargados = byDni.size;
  let totalAsignados = 0;
  for (const r of byDni.values()) {
    const a = String(r.actorsocial ?? "").trim();
    if (a && a !== "0") totalAsignados += 1;
  }

  const prevSet = new Set<string>();
  if (prevEtapa) {
    const [rowsPrev] = await pool.query(
      `SELECT DISTINCT pn.dni
       FROM padronnominal pn
       WHERE pn.ubigeo = ? AND pn.etapa = ? AND YEAR(pn.etapa) >= 2026
         AND TRIM(COALESCE(pn.tipovd,'')) = '1'`,
      [params.ubigeo, prevEtapa],
    );
    for (const r of rowsPrev as any[]) {
      const dni = String(r.dni ?? "").trim();
      if (dni) prevSet.add(dni);
    }
  }

  const eom = endOfMonthUTC(etapa);
  if (!eom) return null;
  const som = etapaDate;

  const excl: NcExclusionDetail[] = [];
  const exclDenom = new Map<string, number>();
  const exclNum = new Map<string, number>();
  const candidates: Array<{
    dni: string;
    grupo: "6m" | "12m";
    birth: Date;
    seguro: string;
  }> = [];

  let conOtroSeguro = 0;
  let sis = 0;
  let sinSeguro = 0;
  let totalEdadCritica = 0;
  let totalPermanencia = 0;
  let totalSeguroValido = 0;

  for (const r of byDni.values()) {
    const dni = String(r.dni ?? "").trim();
    if (!dni) continue;
    const b = toDate(r.fecha_nac);
    if (!b) {
      if (params.includeDetails) excl.push({ dni, grupo: "-", motivo: "Sin fecha de nacimiento" });
      exclDenom.set("Sin fecha de nacimiento", (exclDenom.get("Sin fecha de nacimiento") ?? 0) + 1);
      continue;
    }
    const ageStart = daysBetweenUTC(b, som);
    const ageEnd = daysBetweenUTC(b, eom);
    const grupo: "6m" | "12m" | null =
      overlaps(ageStart, ageEnd, 180, 209)
        ? "6m"
        : overlaps(ageStart, ageEnd, 365, 394)
          ? "12m"
          : null;
    if (!grupo) {
      if (params.includeDetails)
        excl.push({
          dni,
          grupo: "-",
          motivo: "Fuera de edad crítica (180-209 o 365-394 días en el mes)",
        });
      exclDenom.set(
        "Fuera de edad crítica (180-209 o 365-394 días en el mes)",
        (exclDenom.get("Fuera de edad crítica (180-209 o 365-394 días en el mes)") ?? 0) + 1,
      );
      continue;
    }
    totalEdadCritica += 1;

    if (!prevEtapa || !prevSet.has(dni)) {
      if (params.includeDetails) excl.push({ dni, grupo, motivo: "Sin permanencia (2 meses consecutivos)" });
      exclDenom.set(
        "Sin permanencia (2 meses consecutivos)",
        (exclDenom.get("Sin permanencia (2 meses consecutivos)") ?? 0) + 1,
      );
      continue;
    }
    totalPermanencia += 1;

    const seguro = normalizeSeguro(r.tiposeguro);
    const okSeguro = seguro === "SIS" || seguro === "";
    if (!okSeguro) {
      conOtroSeguro += 1;
      if (params.includeDetails) excl.push({ dni, grupo, motivo: "Seguro no válido (no SIS)" });
      exclDenom.set("Seguro no válido (no SIS)", (exclDenom.get("Seguro no válido (no SIS)") ?? 0) + 1);
      continue;
    }
    if (seguro === "SIS") sis += 1;
    else sinSeguro += 1;
    totalSeguroValido += 1;

    candidates.push({ dni, grupo, birth: b, seguro });
  }

  const denom6 = candidates.filter((c) => c.grupo === "6m").length;
  const denom12 = candidates.filter((c) => c.grupo === "12m").length;
  const denomTotal = candidates.length;

  if (!denomTotal) {
    return {
      etapa,
      label: monthLabel(etapa),
      total_cargados: totalCargados,
      total_asignados: totalAsignados,
      total_con_edad_critica: totalEdadCritica,
      total_con_permanencia: totalPermanencia,
      total_con_seguro_valido: totalSeguroValido,
      tamizaje_registros_encontrados: 0,
      tamizaje_ninos_con_registro: 0,
      denom_total: 0,
      denom_6m: 0,
      denom_12m: 0,
      num_total: 0,
      num_6m: 0,
      num_12m: 0,
      sis,
      sin_seguro: sinSeguro,
      con_otro_seguro: conOtroSeguro,
      excluciones_denominador: Array.from(exclDenom.entries()).map(([motivo, count]) => ({ motivo, count })),
      excluciones_numerador: [],
      excl_detalle: params.includeDetails ? excl.slice(0, 200) : [],
    } satisfies NcMonthMetrics;
  }

  const dnis = Array.from(new Set(candidates.map((c) => c.dni)));
  const birthMap = new Map<string, Date>();
  for (const c of candidates) {
    if (!birthMap.has(c.dni)) birthMap.set(c.dni, c.birth);
  }

  const minStart = (() => {
    let min: Date | null = null;
    for (const b of birthMap.values()) {
      const d = addDaysUTC(b, 170);
      if (!min || d.getTime() < min.getTime()) min = d;
    }
    return min ? isoDate(min) : "2026-01-01";
  })();
  const maxEnd = (() => {
    let max: Date | null = null;
    for (const b of birthMap.values()) {
      const d = addDaysUTC(b, 394);
      if (!max || d.getTime() > max.getTime()) max = d;
    }
    return max ? isoDate(max) : etapa;
  })();

  const tamizajes: TamizajeRow[] = [];
  for (const part of chunk(dnis, 900)) {
    const placeholders = part.map(() => "?").join(",");
    const [rowsT] = await pool.query(
      `SELECT id, dni, fecha_atencion, cie_10, hemoglobina, lab1
       FROM registro_tamizaje
       WHERE dni IN (${placeholders})
         AND fecha_atencion IS NOT NULL
         AND fecha_atencion BETWEEN ? AND ?
       ORDER BY dni ASC, fecha_atencion DESC, id DESC`,
      [...part, minStart, maxEnd],
    );
    for (const r of rowsT as any[]) {
      tamizajes.push({
        id: r.id == null ? null : Number(r.id),
        dni: r.dni == null ? null : String(r.dni).trim(),
        fecha_atencion: fmtDateISO(r.fecha_atencion),
        cie_10: r.cie_10 == null ? null : String(r.cie_10),
        hemoglobina: r.hemoglobina == null ? null : Number(r.hemoglobina),
        lab1: r.lab1 == null ? null : String(r.lab1),
      });
    }
  }

  const byTamizajeDni = new Map<string, TamizajeRow[]>();
  for (const t of tamizajes) {
    const dni = String(t.dni ?? "").trim();
    if (!dni) continue;
    const arr = byTamizajeDni.get(dni) ?? [];
    arr.push(t);
    byTamizajeDni.set(dni, arr);
  }

  const findLastInRange = (dni: string, startISO: string, endISO: string) => {
    const arr = byTamizajeDni.get(dni);
    if (!arr || !arr.length) return null;
    for (const t of arr) {
      const fa = String(t.fecha_atencion ?? "").slice(0, 10);
      if (!fa) continue;
      if (fa >= startISO && fa <= endISO) return t;
    }
    return null;
  };

  let num6 = 0;
  let num12 = 0;
  let ninosConTamizaje = 0;

  for (const c of candidates) {
    const dni = c.dni;
    const birth = c.birth;

    if (c.grupo === "6m") {
      const start = isoDate(addDaysUTC(birth, 170));
      const end = isoDate(addDaysUTC(birth, 209));
      const t = findLastInRange(dni, start, end);
      if (!t) {
        if (params.includeDetails) excl.push({ dni, grupo: "6m", motivo: "Sin tamizaje 170-209 días" });
        exclNum.set("Sin tamizaje 170-209 días", (exclNum.get("Sin tamizaje 170-209 días") ?? 0) + 1);
        continue;
      }
      ninosConTamizaje += 1;
      const cons = hbConsistente(t.hemoglobina, t.cie_10, t.lab1);
      if (!cons.ok) {
        if (params.includeDetails) excl.push({ dni, grupo: "6m", motivo: cons.motivo });
        exclNum.set(cons.motivo, (exclNum.get(cons.motivo) ?? 0) + 1);
        continue;
      }
      if (anemiaFromCie10(t.cie_10)) {
        if (params.includeDetails) excl.push({ dni, grupo: "6m", motivo: "Diagnóstico de anemia (D509/D649)" });
        exclNum.set(
          "Diagnóstico de anemia (D509/D649)",
          (exclNum.get("Diagnóstico de anemia (D509/D649)") ?? 0) + 1,
        );
        continue;
      }
      const hb = Number(t.hemoglobina ?? NaN);
      if (Number.isFinite(hb) && hb >= 10.5) {
        num6 += 1;
      } else {
        if (params.includeDetails) excl.push({ dni, grupo: "6m", motivo: "Hemoglobina < 10.5" });
        exclNum.set("Hemoglobina < 10.5", (exclNum.get("Hemoglobina < 10.5") ?? 0) + 1);
      }
    } else {
      const start = isoDate(addDaysUTC(birth, 365));
      const end = isoDate(addDaysUTC(birth, 394));
      const t = findLastInRange(dni, start, end);
      if (!t) {
        if (params.includeDetails) excl.push({ dni, grupo: "12m", motivo: "Sin tamizaje 365-394 días" });
        exclNum.set("Sin tamizaje 365-394 días", (exclNum.get("Sin tamizaje 365-394 días") ?? 0) + 1);
        continue;
      }
      ninosConTamizaje += 1;
      const cons = hbConsistente(t.hemoglobina, t.cie_10, t.lab1);
      if (!cons.ok) {
        if (params.includeDetails) excl.push({ dni, grupo: "12m", motivo: cons.motivo });
        exclNum.set(cons.motivo, (exclNum.get(cons.motivo) ?? 0) + 1);
        continue;
      }
      if (anemiaFromCie10(t.cie_10)) {
        if (params.includeDetails) excl.push({ dni, grupo: "12m", motivo: "Diagnóstico de anemia (D509/D649)" });
        exclNum.set(
          "Diagnóstico de anemia (D509/D649)",
          (exclNum.get("Diagnóstico de anemia (D509/D649)") ?? 0) + 1,
        );
        continue;
      }
      const hb = Number(t.hemoglobina ?? NaN);
      if (Number.isFinite(hb) && hb >= 10.5) {
        num12 += 1;
      } else {
        if (params.includeDetails) excl.push({ dni, grupo: "12m", motivo: "Hemoglobina < 10.5" });
        exclNum.set("Hemoglobina < 10.5", (exclNum.get("Hemoglobina < 10.5") ?? 0) + 1);
      }
    }
  }

  return {
    etapa,
    label: monthLabel(etapa),
    total_cargados: totalCargados,
    total_asignados: totalAsignados,
    total_con_edad_critica: totalEdadCritica,
    total_con_permanencia: totalPermanencia,
    total_con_seguro_valido: totalSeguroValido,
    tamizaje_registros_encontrados: tamizajes.length,
    tamizaje_ninos_con_registro: ninosConTamizaje,
    denom_total: denomTotal,
    denom_6m: denom6,
    denom_12m: denom12,
    num_total: num6 + num12,
    num_6m: num6,
    num_12m: num12,
    sis,
    sin_seguro: sinSeguro,
    con_otro_seguro: conOtroSeguro,
    excluciones_denominador: Array.from(exclDenom.entries())
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count),
    excluciones_numerador: Array.from(exclNum.entries())
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count),
    excl_detalle: params.includeDetails ? excl.slice(0, 200) : [],
  } satisfies NcMonthMetrics;
}

