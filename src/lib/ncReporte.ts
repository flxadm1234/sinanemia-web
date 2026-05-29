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
  diagnostico: string | null;
  resultado: string | null;
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

export type NcMatrixRow = {
  dni: string;
  nombrecompleto: string;
  actorsocial: string;
  responsable: string;
  eess_ua: string;
  fechacita: string;
  estadosvd: string;
  rango: string;
  departamento: string;
  provincia: string;
  distrito: string;
  fecha_nac: string;
  edad_anios: string;
  edad_meses: string;
  edad_dias: string;
  tiposeguro: string;
  grupo: "6m" | "12m" | "-";
  en_denominador: "SI" | "NO";
  motivo_exclusion_denominador: string;
  en_numerador: "SI" | "NO";
  motivo_exclusion_numerador: string;
  fecha_atencion: string;
  hemoglobina: string;
  cie_10: string;
  diagnostico: string;
  lab1: string;
  resultado: string;
};

function diffAgeParts(birth: Date, asOf: Date) {
  const b = new Date(Date.UTC(birth.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()));
  const a = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  if (a.getTime() < b.getTime()) return null;

  let years = a.getUTCFullYear() - b.getUTCFullYear();
  let months = a.getUTCMonth() - b.getUTCMonth();
  let days = a.getUTCDate() - b.getUTCDate();

  if (days < 0) {
    const prevMonth = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 0));
    days += prevMonth.getUTCDate();
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }
  const totalDays = Math.floor((a.getTime() - b.getTime()) / 86400000);
  return { years, months, days, totalDays };
}

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

function hbConsistente(hb: number | null, _cie10: string | null, _lab1: string | null) {
  if (hb == null || !Number.isFinite(hb) || hb <= 0) return { ok: false, motivo: "Sin hemoglobina" };
  if (hb < 6.0 || hb > 18.0) return { ok: false, motivo: "Hemoglobina atípica (<6 o >18)" };
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

  const tamizajes: TamizajeRow[] = [];
  for (const part of chunk(dnis, 900)) {
    const placeholders = part.map(() => "?").join(",");
    const [rowsT] = await pool.query(
      `SELECT id, TRIM(dni) AS dni, fecha_atencion, cie_10, diagnostico, hemoglobina, lab1, resultado
       FROM (
         SELECT
           rt.id,
           rt.dni,
           rt.fecha_atencion,
           rt.cie_10,
           rt.diagnostico,
           rt.hemoglobina,
           rt.lab1,
           rt.resultado,
           ROW_NUMBER() OVER (PARTITION BY TRIM(rt.dni) ORDER BY rt.fecha_atencion DESC, rt.id DESC) AS rn
         FROM registro_tamizaje rt
         WHERE TRIM(rt.dni) IN (${placeholders})
           AND rt.fecha_atencion IS NOT NULL
       ) t
       WHERE t.rn = 1
       ORDER BY dni ASC`,
      part,
    );
    for (const r of rowsT as any[]) {
      tamizajes.push({
        id: r.id == null ? null : Number(r.id),
        dni: r.dni == null ? null : String(r.dni).trim(),
        fecha_atencion: fmtDateISO(r.fecha_atencion),
        cie_10: r.cie_10 == null ? null : String(r.cie_10),
        diagnostico: r.diagnostico == null ? null : String(r.diagnostico),
        hemoglobina: r.hemoglobina == null ? null : Number(r.hemoglobina),
        lab1: r.lab1 == null ? null : String(r.lab1),
        resultado: r.resultado == null ? null : String(r.resultado),
      });
    }
  }

  const byTamizajeDni = new Map<string, TamizajeRow>();
  for (const t of tamizajes) {
    const dni = String(t.dni ?? "").trim();
    if (!dni) continue;
    if (!byTamizajeDni.has(dni)) byTamizajeDni.set(dni, t);
  }

  let num6 = 0;
  let num12 = 0;
  const ninosConTamizaje = byTamizajeDni.size;

  for (const c of candidates) {
    const dni = c.dni;
    const t = byTamizajeDni.get(dni) ?? null;

    if (c.grupo === "6m") {
      if (!t) {
        if (params.includeDetails) excl.push({ dni, grupo: "6m", motivo: "Sin tamizaje (sin registros HIS)" });
        exclNum.set(
          "Sin tamizaje (sin registros HIS)",
          (exclNum.get("Sin tamizaje (sin registros HIS)") ?? 0) + 1,
        );
        continue;
      }
      const cons = hbConsistente(t.hemoglobina, t.cie_10, t.lab1);
      if (!cons.ok) {
        if (params.includeDetails) excl.push({ dni, grupo: "6m", motivo: cons.motivo });
        exclNum.set(cons.motivo, (exclNum.get(cons.motivo) ?? 0) + 1);
        continue;
      }
      const hb = Number(t.hemoglobina ?? NaN);
      if (Number.isFinite(hb) && hb >= 10.5) {
        num6 += 1;
      } else {
        if (params.includeDetails) excl.push({ dni, grupo: "6m", motivo: "Anemia (HB < 10.5)" });
        exclNum.set("Anemia (HB < 10.5)", (exclNum.get("Anemia (HB < 10.5)") ?? 0) + 1);
      }
    } else {
      if (!t) {
        if (params.includeDetails) excl.push({ dni, grupo: "12m", motivo: "Sin tamizaje (sin registros HIS)" });
        exclNum.set(
          "Sin tamizaje (sin registros HIS)",
          (exclNum.get("Sin tamizaje (sin registros HIS)") ?? 0) + 1,
        );
        continue;
      }
      const cons = hbConsistente(t.hemoglobina, t.cie_10, t.lab1);
      if (!cons.ok) {
        if (params.includeDetails) excl.push({ dni, grupo: "12m", motivo: cons.motivo });
        exclNum.set(cons.motivo, (exclNum.get(cons.motivo) ?? 0) + 1);
        continue;
      }
      const hb = Number(t.hemoglobina ?? NaN);
      if (Number.isFinite(hb) && hb >= 10.5) {
        num12 += 1;
      } else {
        if (params.includeDetails) excl.push({ dni, grupo: "12m", motivo: "Anemia (HB < 10.5)" });
        exclNum.set("Anemia (HB < 10.5)", (exclNum.get("Anemia (HB < 10.5)") ?? 0) + 1);
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

export async function listNcMatrixForEtapa(params: { ubigeo: number; etapa: string }) {
  const etapa = String(params.etapa ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(etapa)) return [];
  const etapaDate = toDate(etapa);
  if (!etapaDate) return [];
  if (etapaDate.getUTCFullYear() < 2026) return [];

  const pool = getDbPool();

  const prevEtapa = (() => {
    const y = etapaDate.getUTCFullYear();
    const m = etapaDate.getUTCMonth();
    const prev = new Date(Date.UTC(y, m - 1, 1));
    return prev.getUTCFullYear() < 2026 ? "" : isoDate(prev);
  })();

  const [rowsBase] = await pool.query(
    `SELECT pn.dni,
            pn.nombres,
            pn.actorsocial,
            pn.responsable,
            pn.eess_ua,
            pn.fechacita,
            pn.estadosvd,
            pn.rango,
            pn.departamento,
            pn.provincia,
            pn.distrito,
            pn.fecha_nac,
            pn.tiposeguro
     FROM padronnominal pn
     WHERE pn.ubigeo = ? AND pn.etapa = ? AND YEAR(pn.etapa) >= 2026
       AND TRIM(COALESCE(pn.tipovd,'')) = '1'`,
    [params.ubigeo, etapa],
  );

  const byDni = new Map<string, any>();
  for (const r of rowsBase as any[]) {
    const dni = String(r.dni ?? "").trim();
    if (!dni) continue;
    if (!byDni.has(dni)) byDni.set(dni, r);
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
  if (!eom) return [];
  const som = etapaDate;

  const baseItems = Array.from(byDni.entries()).map(([dni, r]) => ({
    dni,
    nombrecompleto: String(r.nombres ?? "").trim(),
    actorsocial: String(r.actorsocial ?? "").trim(),
    responsable: String(r.responsable ?? "").trim(),
    eess_ua: String(r.eess_ua ?? "").trim(),
    fechacita: fmtDateISO(r.fechacita) ?? "",
    estadosvd: String(r.estadosvd ?? "").trim(),
    rango: String(r.rango ?? "").trim(),
    departamento: String(r.departamento ?? "").trim(),
    provincia: String(r.provincia ?? "").trim(),
    distrito: String(r.distrito ?? "").trim(),
    fecha_nac: fmtDateISO(r.fecha_nac) ?? "",
    tiposeguro: String(r.tiposeguro ?? "").trim(),
  }));

  const denomInfo = new Map<
    string,
    {
      grupo: "6m" | "12m" | "-";
      ok: boolean;
      motivo: string;
      birth: Date | null;
    }
  >();

  for (const it of baseItems) {
    const b = toDate(it.fecha_nac);
    if (!b) {
      denomInfo.set(it.dni, { grupo: "-", ok: false, motivo: "Sin fecha de nacimiento", birth: null });
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
      denomInfo.set(it.dni, {
        grupo: "-",
        ok: false,
        motivo: "Fuera de edad crítica (180-209 o 365-394 días en el mes)",
        birth: b,
      });
      continue;
    }
    if (!prevEtapa || !prevSet.has(it.dni)) {
      denomInfo.set(it.dni, { grupo, ok: false, motivo: "Sin permanencia (2 meses consecutivos)", birth: b });
      continue;
    }
    const seguro = normalizeSeguro(it.tiposeguro);
    const okSeguro = seguro === "SIS" || seguro === "";
    if (!okSeguro) {
      denomInfo.set(it.dni, { grupo, ok: false, motivo: "Seguro no válido (no SIS)", birth: b });
      continue;
    }
    denomInfo.set(it.dni, { grupo, ok: true, motivo: "", birth: b });
  }

  const allDnis = baseItems.map((x) => x.dni);
  const tamizajes: TamizajeRow[] = [];
  if (allDnis.length) {
    for (const part of chunk(allDnis, 900)) {
      const placeholders = part.map(() => "?").join(",");
      const [rowsT] = await pool.query(
        `SELECT id, TRIM(dni) AS dni, fecha_atencion, cie_10, diagnostico, hemoglobina, lab1, resultado
         FROM (
           SELECT
             rt.id,
             rt.dni,
             rt.fecha_atencion,
             rt.cie_10,
             rt.diagnostico,
             rt.hemoglobina,
             rt.lab1,
             rt.resultado,
             ROW_NUMBER() OVER (PARTITION BY TRIM(rt.dni) ORDER BY rt.fecha_atencion DESC, rt.id DESC) AS rn
           FROM registro_tamizaje rt
           WHERE TRIM(rt.dni) IN (${placeholders})
             AND rt.fecha_atencion IS NOT NULL
         ) t
         WHERE t.rn = 1
         ORDER BY dni ASC`,
        part,
      );
      for (const r of rowsT as any[]) {
        tamizajes.push({
          id: r.id == null ? null : Number(r.id),
          dni: r.dni == null ? null : String(r.dni).trim(),
          fecha_atencion: fmtDateISO(r.fecha_atencion),
          cie_10: r.cie_10 == null ? null : String(r.cie_10),
          diagnostico: r.diagnostico == null ? null : String(r.diagnostico),
          hemoglobina: r.hemoglobina == null ? null : Number(r.hemoglobina),
          lab1: r.lab1 == null ? null : String(r.lab1),
          resultado: r.resultado == null ? null : String(r.resultado),
        });
      }
    }
  }

  const byTamizajeDni = new Map<string, TamizajeRow>();
  for (const t of tamizajes) {
    const dni = String(t.dni ?? "").trim();
    if (!dni) continue;
    if (!byTamizajeDni.has(dni)) byTamizajeDni.set(dni, t);
  }

  const out: NcMatrixRow[] = [];
  for (const it of baseItems) {
    const den = denomInfo.get(it.dni) ?? { grupo: "-", ok: false, motivo: "Sin evaluación", birth: null };
    const row: NcMatrixRow = {
      dni: it.dni,
      nombrecompleto: it.nombrecompleto,
      actorsocial: it.actorsocial,
      responsable: it.responsable,
      eess_ua: it.eess_ua,
      fechacita: it.fechacita,
      estadosvd: it.estadosvd,
      rango: it.rango,
      departamento: it.departamento,
      provincia: it.provincia,
      distrito: it.distrito,
      fecha_nac: it.fecha_nac,
      edad_anios: "",
      edad_meses: "",
      edad_dias: "",
      tiposeguro: it.tiposeguro,
      grupo: den.grupo,
      en_denominador: den.ok ? "SI" : "NO",
      motivo_exclusion_denominador: den.ok ? "" : den.motivo,
      en_numerador: "NO",
      motivo_exclusion_numerador: den.ok ? "" : "No aplica (fuera del denominador)",
      fecha_atencion: "",
      hemoglobina: "",
      cie_10: "",
      diagnostico: "",
      lab1: "",
      resultado: "",
    };

    if (den.birth) {
      const age = diffAgeParts(den.birth, etapaDate);
      if (age) {
        row.edad_anios = String(age.years);
        row.edad_meses = String(age.months);
        row.edad_dias = String(age.totalDays);
      }
    }

    const t = byTamizajeDni.get(it.dni) ?? null;
    if (t) {
      row.fecha_atencion = t.fecha_atencion ?? "";
      row.hemoglobina = t.hemoglobina == null ? "" : String(t.hemoglobina);
      row.cie_10 = t.cie_10 ?? "";
      row.diagnostico = t.diagnostico ?? "";
      row.lab1 = t.lab1 ?? "";
      row.resultado = t.resultado ?? "";
    }

    if (den.ok) {
      if (!t) {
        row.motivo_exclusion_numerador = "Sin tamizaje (sin registros HIS)";
      } else {
        const cons = hbConsistente(t.hemoglobina, t.cie_10, t.lab1);
        if (!cons.ok) {
          row.motivo_exclusion_numerador = cons.motivo;
        } else {
          const hb = Number(t.hemoglobina ?? NaN);
          if (Number.isFinite(hb) && hb >= 10.5) {
            row.en_numerador = "SI";
            row.motivo_exclusion_numerador = "";
          } else {
            row.motivo_exclusion_numerador = "Anemia (HB < 10.5)";
          }
        }
      }
    }

    out.push(row);
  }

  return out;
}
