"use server";

import { z } from "zod";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const etapaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function qs(v: string) {
  return encodeURIComponent(v);
}

function seededShuffle<T>(arr: T[], seed: number) {
  let x = seed | 0;
  function next() {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
}

function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

function pickToRemove(candidates: Array<{ idpn: number; nrovd: number; dni: string }>, excess: number, seed: string) {
  const g3: typeof candidates = [];
  const g2: typeof candidates = [];
  const g1: typeof candidates = [];
  for (const c of candidates) {
    if (c.nrovd === 3) g3.push(c);
    else if (c.nrovd === 2) g2.push(c);
    else if (c.nrovd === 1) g1.push(c);
  }
  seededShuffle(g3, hashSeed(seed + ":3"));
  seededShuffle(g2, hashSeed(seed + ":2"));
  seededShuffle(g1, hashSeed(seed + ":1"));

  const picked: typeof candidates = [];
  let remaining = excess;
  while (remaining > 0) {
    if (remaining >= 3 && g3.length) {
      const c = g3.pop()!;
      picked.push(c);
      remaining -= 3;
      continue;
    }
    if (remaining >= 2 && g2.length) {
      const c = g2.pop()!;
      picked.push(c);
      remaining -= 2;
      continue;
    }
    if (remaining >= 1 && g1.length) {
      const c = g1.pop()!;
      picked.push(c);
      remaining -= 1;
      continue;
    }
    break;
  }

  if (remaining === 0) {
    return { picked, exact: true, remaining };
  }

  const anyLeft = [...g1, ...g2, ...g3];
  if (!anyLeft.length) return { picked, exact: false, remaining };

  anyLeft.sort((a, b) => a.nrovd - b.nrovd);
  const extra = anyLeft[0]!;
  picked.push(extra);
  remaining -= extra.nrovd;
  return { picked, exact: false, remaining };
}

const regulacionSchema = z.object({
  ubigeo: z.coerce.number().int().positive().optional(),
  etapa: etapaSchema,
});

export async function regularVdAction(formData: FormData) {
  const user = await requireAdminOrSuperAdmin();
  const parsed = regulacionSchema.safeParse({
    ubigeo: formData.get("ubigeo"),
    etapa: String(formData.get("etapa") ?? ""),
  });
  if (!parsed.success) {
    redirect(`/admin/regulacion-vd?err=1&msg=${qs("Datos inválidos.")}`);
  }

  const ubigeo = user.tipo === "SUPER ADMIN" ? parsed.data.ubigeo ?? null : user.ubigeo ?? null;
  if (!ubigeo) {
    redirect(`/admin/regulacion-vd?err=1&msg=${qs("Falta ubigeo.")}`);
  }
  const etapa = parsed.data.etapa;

  const pool = getDbPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rowsActors] = await conn.query(
      `
      SELECT
        TRIM(actorsocial) AS actorsocial,
        SUM(COALESCE(nrovd, 0)) AS total_nrovd
      FROM padronnominal
      WHERE ubigeo = ?
        AND DATE_FORMAT(etapa, '%Y-%m-01') = ?
        AND TRIM(COALESCE(tipovd,'')) = '1'
        AND TRIM(COALESCE(actorsocial,'')) <> ''
        AND COALESCE(nrovd, 0) > 0
      GROUP BY TRIM(actorsocial)
      HAVING total_nrovd > 60
      ORDER BY total_nrovd DESC
      `,
      [ubigeo, etapa],
    );

    const actors = (rowsActors as any[]).map((r) => ({
      actorsocial: String(r.actorsocial ?? "").trim(),
      total: Number(r.total_nrovd ?? 0),
    }));

    let actoresAfectados = 0;
    let ninosDesasignados = 0;
    let visitasRemovidas = 0;
    let actoresNoExacto = 0;

    for (const a of actors) {
      const excess = a.total - 60;
      if (excess <= 0 || !a.actorsocial) continue;

      const [rowsCand] = await conn.query(
        `
        SELECT idpn, TRIM(dni) AS dni, COALESCE(nrovd, 0) AS nrovd
        FROM padronnominal
        WHERE ubigeo = ?
          AND DATE_FORMAT(etapa, '%Y-%m-01') = ?
          AND TRIM(COALESCE(tipovd,'')) = '1'
          AND TRIM(actorsocial) = ?
          AND COALESCE(nrovd, 0) > 0
        `,
        [ubigeo, etapa, a.actorsocial],
      );

      const cands = (rowsCand as any[])
        .map((r) => ({
          idpn: Number(r.idpn),
          dni: String(r.dni ?? "").trim(),
          nrovd: Number(r.nrovd ?? 0),
        }))
        .filter((r) => Number.isFinite(r.idpn) && r.idpn > 0 && r.nrovd > 0);

      if (!cands.length) continue;

      const seed = `${ubigeo}:${etapa}:${a.actorsocial}`;
      const plan = pickToRemove(cands, excess, seed);
      if (!plan.exact) actoresNoExacto += 1;

      const ids = Array.from(new Set(plan.picked.map((p) => p.idpn)));
      if (!ids.length) continue;

      const placeholders = ids.map(() => "?").join(",");
      const [r2] = await conn.query(
        `UPDATE padronnominal
         SET actorsocial = NULL, responsable = NULL
         WHERE ubigeo = ?
           AND DATE_FORMAT(etapa, '%Y-%m-01') = ?
           AND idpn IN (${placeholders})`,
        [ubigeo, etapa, ...ids],
      );

      const changed = Number((r2 as any)?.changedRows ?? 0);
      if (changed > 0) {
        actoresAfectados += 1;
        ninosDesasignados += changed;
        const sumRemoved = plan.picked.reduce((acc, p) => acc + (p.nrovd > 0 ? p.nrovd : 0), 0);
        visitasRemovidas += sumRemoved;
      }
    }

    await conn.commit();
    revalidatePath("/admin/regulacion-vd");
    redirect(
      `/admin/regulacion-vd?ok=1&rows=${actoresAfectados}&rows2=${ninosDesasignados}&chg1=${visitasRemovidas}&chg2=${actoresNoExacto}&ubigeo=${ubigeo}&etapa=${etapa}`,
    );
  } catch (e: any) {
    const digest = String(e?.digest ?? "");
    const msg0 = String(e?.message ?? e ?? "");
    if (digest.includes("NEXT_REDIRECT") || msg0 === "NEXT_REDIRECT" || digest.includes("NEXT_NOT_FOUND")) {
      throw e;
    }
    try {
      await conn.rollback();
    } catch {}
    const msg = msg0.replaceAll("\n", " ").replaceAll("\r", " ").slice(0, 220);
    redirect(
      `/admin/regulacion-vd?err=1&msg=${qs(
        msg ? `No se pudo completar la regulación: ${msg}` : "No se pudo completar la regulación.",
      )}`,
    );
  } finally {
    conn.release();
  }
}

