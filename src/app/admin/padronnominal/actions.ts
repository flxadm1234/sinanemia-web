"use server";

import { z } from "zod";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";
import {
  updatePadronActorSocialAndResponsable,
  rectifyPadronResponsableFromActorCdr,
} from "@/lib/padronnominal";
import { getDbPool } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const etapaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function qs(v: string) {
  return encodeURIComponent(v);
}

function monthStartAdd(etapa: string, addMonths: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(etapa);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return "";
  const d = new Date(Date.UTC(y, mo - 1 + addMonths, 1));
  if (Number.isNaN(d.getTime())) return "";
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}-01`;
}

const actorSchema = z.object({
  ubigeo: z.coerce.number().int().positive().optional(),
  etapa: etapaSchema.optional(),
  actorAnterior: z.string().trim().min(1),
  actorNuevo: z.string().trim().min(1),
});

export async function bulkActorSocialAction(formData: FormData) {
  const user = await requireAdminOrSuperAdmin();
  const parsed = actorSchema.safeParse({
    ubigeo: formData.get("ubigeo"),
    etapa: String(formData.get("etapa") ?? ""),
    actorAnterior: String(formData.get("actorAnterior") ?? ""),
    actorNuevo: String(formData.get("actorNuevo") ?? ""),
  });
  if (!parsed.success) {
    redirect(`/admin/padronnominal?tab=actor&err=1&msg=${qs("Datos inválidos.")}`);
  }

  let ubigeo = user.ubigeo ?? null;
  let etapa = "";

  if (user.tipo === "SUPER ADMIN") {
    ubigeo = parsed.data.ubigeo ?? null;
    etapa = parsed.data.etapa ?? "";
  } else {
    const sel = await getEtapaSeleccionadaPorUbigeo(user.ubigeo ?? "");
    etapa = sel?.etapa ?? "";
  }

  if (!ubigeo) {
    redirect(`/admin/padronnominal?tab=actor&err=1&msg=${qs("Falta ubigeo.")}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(etapa)) {
    redirect(`/admin/padronnominal?tab=actor&err=1&msg=${qs("Falta etapa (YYYY-MM-01).")}`);
  }
  if (parsed.data.actorAnterior === parsed.data.actorNuevo) {
    redirect(`/admin/padronnominal?tab=actor&err=1&msg=${qs("El actor anterior y el nuevo no pueden ser iguales.")}`);
  }

  const res = await updatePadronActorSocialAndResponsable({
    ubigeo,
    etapa,
    actorAnterior: parsed.data.actorAnterior,
    actorNuevo: parsed.data.actorNuevo,
  });

  if (!res.ok) {
    redirect(
      `/admin/padronnominal?tab=actor&err=1&msg=${qs(
        "No se pudo aplicar el cambio: el actor social nuevo no tiene CDR configurado.",
      )}`,
    );
  }

  const affected = Number(res.matched ?? 0);
  const changed = Number(res.changedRows ?? 0);
  revalidatePath("/admin/padronnominal");
  redirect(`/admin/padronnominal?tab=actor&ok=1&rows=${affected}&rows2=${changed}`);
}

const rectifySchema = z.object({
  ubigeo: z.coerce.number().int().positive().optional(),
  etapa: etapaSchema.optional(),
});

export async function rectifyCoordinadorAction(formData: FormData) {
  const user = await requireAdminOrSuperAdmin();
  const parsed = rectifySchema.safeParse({
    ubigeo: formData.get("ubigeo"),
    etapa: String(formData.get("etapa") ?? ""),
  });
  if (!parsed.success) {
    redirect(`/admin/padronnominal?tab=coordinador&err=1&msg=${qs("Datos inválidos.")}`);
  }

  let ubigeo = user.ubigeo ?? null;
  let etapa = "";

  if (user.tipo === "SUPER ADMIN") {
    ubigeo = parsed.data.ubigeo ?? null;
    etapa = parsed.data.etapa ?? "";
  } else {
    const sel = await getEtapaSeleccionadaPorUbigeo(user.ubigeo ?? "");
    etapa = sel?.etapa ?? "";
  }

  if (!ubigeo) {
    redirect(`/admin/padronnominal?tab=coordinador&err=1&msg=${qs("Falta ubigeo.")}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(etapa)) {
    redirect(`/admin/padronnominal?tab=coordinador&err=1&msg=${qs("Falta etapa (YYYY-MM-01).")}`);
  }

  const res = await rectifyPadronResponsableFromActorCdr({ ubigeo, etapa });
  const matched = Number(res.matched ?? 0);
  const changed = Number(res.changedRows ?? 0);
  revalidatePath("/admin/padronnominal");
  redirect(`/admin/padronnominal?tab=coordinador&ok=1&rows=${matched}&rows2=${changed}`);
}

const respSchema = z.object({
  ubigeo: z.coerce.number().int().positive().optional(),
  etapa: etapaSchema.optional(),
  responsableAnterior: z.string().trim().min(1),
  responsableNuevo: z.string().trim().min(1),
});

export async function bulkResponsableAction(formData: FormData) {
  const user = await requireAdminOrSuperAdmin();
  const parsed = respSchema.safeParse({
    ubigeo: formData.get("ubigeo"),
    etapa: String(formData.get("etapa") ?? ""),
    responsableAnterior: String(formData.get("responsableAnterior") ?? ""),
    responsableNuevo: String(formData.get("responsableNuevo") ?? ""),
  });
  if (!parsed.success) {
    redirect(`/admin/padronnominal?tab=responsable&err=1&msg=${qs("Datos inválidos.")}`);
  }

  let ubigeo = user.ubigeo ?? null;
  let etapa = "";

  if (user.tipo === "SUPER ADMIN") {
    ubigeo = parsed.data.ubigeo ?? null;
    etapa = parsed.data.etapa ?? "";
  } else {
    const sel = await getEtapaSeleccionadaPorUbigeo(user.ubigeo ?? "");
    etapa = sel?.etapa ?? "";
  }

  if (!ubigeo) {
    redirect(`/admin/padronnominal?tab=responsable&err=1&msg=${qs("Falta ubigeo.")}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(etapa)) {
    redirect(`/admin/padronnominal?tab=responsable&err=1&msg=${qs("Falta etapa (YYYY-MM-01).")}`);
  }
  if (parsed.data.responsableAnterior === parsed.data.responsableNuevo) {
    redirect(`/admin/padronnominal?tab=responsable&err=1&msg=${qs("El responsable anterior y el nuevo no pueden ser iguales.")}`);
  }

  const pool = getDbPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rowsCountPadron] = await conn.query(
      `SELECT COUNT(*) as c
       FROM padronnominal
       WHERE etapa = ? AND ubigeo = ? AND responsable = ?`,
      [etapa, ubigeo, parsed.data.responsableAnterior],
    );
    const matchedPadron = Number((rowsCountPadron as any)?.[0]?.c ?? 0);
    const [rowsCountPersona] = await conn.query(
      `SELECT COUNT(*) as c
       FROM persona
       WHERE ubigeo = ? AND cdr = ?`,
      [ubigeo, parsed.data.responsableAnterior],
    );
    const matchedPersona = Number((rowsCountPersona as any)?.[0]?.c ?? 0);

    const [resPadron] = await conn.query(
      "UPDATE padronnominal SET responsable = ? WHERE etapa = ? AND ubigeo = ? AND responsable = ?",
      [
        parsed.data.responsableNuevo,
        etapa,
        ubigeo,
        parsed.data.responsableAnterior,
      ],
    );
    const [resPersona] = await conn.query(
      "UPDATE persona SET cdr = ? WHERE ubigeo = ? AND cdr = ?",
      [parsed.data.responsableNuevo, ubigeo, parsed.data.responsableAnterior],
    );
    await conn.commit();

    const affectedPadron = matchedPadron;
    const affectedPersona = matchedPersona;
    const changedPadron = Number((resPadron as any)?.changedRows ?? 0);
    const changedPersona = Number((resPersona as any)?.changedRows ?? 0);
    revalidatePath("/admin/padronnominal");
    redirect(
      `/admin/padronnominal?tab=responsable&ok=1&rows=${affectedPadron}&rows2=${affectedPersona}&chg1=${changedPadron}&chg2=${changedPersona}`,
    );
  } catch {
    try {
      await conn.rollback();
    } catch {}
    redirect(`/admin/padronnominal?tab=responsable&err=1&msg=${qs("No se pudo aplicar el cambio. Revisa que la BD esté disponible e inténtalo nuevamente.")}`);
  } finally {
    conn.release();
  }
}

const actorCdrSchema = z.object({
  ubigeo: z.coerce.number().int().positive().optional(),
  coordinador: z.string().trim().min(1),
  actores: z.string().trim().min(2),
});

export async function bulkActorCdrAction(formData: FormData) {
  const user = await requireAdminOrSuperAdmin();
  const parsed = actorCdrSchema.safeParse({
    ubigeo: formData.get("ubigeo"),
    coordinador: String(formData.get("coordinador") ?? ""),
    actores: String(formData.get("actores") ?? ""),
  });
  if (!parsed.success) {
    redirect(`/admin/padronnominal?tab=actores&err=1&msg=${qs("Datos inválidos.")}`);
  }

  const ubigeo = user.tipo === "SUPER ADMIN" ? parsed.data.ubigeo ?? null : user.ubigeo ?? null;
  if (!ubigeo) {
    redirect(`/admin/padronnominal?tab=actores&err=1&msg=${qs("Falta ubigeo.")}`);
  }

  const actoresRaw = (() => {
    try {
      return JSON.parse(parsed.data.actores) as unknown;
    } catch {
      return null;
    }
  })();
  if (!Array.isArray(actoresRaw)) {
    redirect(`/admin/padronnominal?tab=actores&err=1&msg=${qs("Selección inválida.")}`);
  }
  const actores = actoresRaw
    .map((x) => String(x ?? "").trim())
    .filter((x) => x.length >= 6);
  const uniqueActores = Array.from(new Set(actores));
  if (!uniqueActores.length) {
    redirect(`/admin/padronnominal?tab=actores&err=1&msg=${qs("Selecciona al menos un actor social.")}`);
  }

  const sel = await getEtapaSeleccionadaPorUbigeo(String(ubigeo));
  const etapa = sel?.etapa ?? "";
  if (!etapa) {
    redirect(`/admin/padronnominal?tab=actores&err=1&msg=${qs("No hay mes seleccionado para este ubigeo.")}`);
  }

  const pool = getDbPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rowsCoord] = await conn.query(
      "SELECT dni FROM persona WHERE ubigeo = ? AND tipo = 'COORDINADOR' AND dni = ? LIMIT 1",
      [ubigeo, parsed.data.coordinador],
    );
    if (!Array.isArray(rowsCoord) || !rowsCoord.length) {
      await conn.rollback();
      redirect(
        `/admin/padronnominal?tab=actores&err=1&msg=${qs(
          "Coordinador inválido para el ubigeo seleccionado.",
        )}`,
      );
    }

    const actorPlaceholders = uniqueActores.map(() => "?").join(",");
    const [rowsCountActors] = await conn.query(
      `SELECT COUNT(*) as c
       FROM persona
       WHERE ubigeo = ? AND tipo = 'ACTOR SOCIAL' AND dni IN (${actorPlaceholders})`,
      [ubigeo, ...uniqueActores],
    );
    const matchedActors = Number((rowsCountActors as any)?.[0]?.c ?? 0);

    const [resActors] = await conn.query(
      `UPDATE persona
       SET cdr = ?
       WHERE ubigeo = ? AND tipo = 'ACTOR SOCIAL' AND dni IN (${actorPlaceholders})`,
      [parsed.data.coordinador, ubigeo, ...uniqueActores],
    );

    const [rowsCountPadron] = await conn.query(
      `SELECT COUNT(*) as c
       FROM padronnominal
       WHERE ubigeo = ?
         AND DATE_FORMAT(etapa,'%Y-%m-01') = ?
         AND TRIM(COALESCE(actorsocial,'')) IN (${actorPlaceholders})`,
      [ubigeo, etapa, ...uniqueActores],
    );
    const matchedPadron = Number((rowsCountPadron as any)?.[0]?.c ?? 0);

    const [resPadron] = await conn.query(
      `UPDATE padronnominal
       SET responsable = ?
       WHERE ubigeo = ?
         AND DATE_FORMAT(etapa,'%Y-%m-01') = ?
         AND TRIM(COALESCE(actorsocial,'')) IN (${actorPlaceholders})`,
      [parsed.data.coordinador, ubigeo, etapa, ...uniqueActores],
    );

    await conn.commit();
    const changedActors = Number((resActors as any)?.changedRows ?? 0);
    const changedPadron = Number((resPadron as any)?.changedRows ?? 0);
    revalidatePath("/admin/padronnominal");
    redirect(
      `/admin/padronnominal?tab=actores&ok=1&rows=${matchedActors}&rows2=${matchedPadron}&chg1=${changedActors}&chg2=${changedPadron}`,
    );
  } catch {
    try {
      await conn.rollback();
    } catch {}
    redirect(
      `/admin/padronnominal?tab=actores&err=1&msg=${qs(
        "No se pudo aplicar el cambio. Revisa la BD e inténtalo nuevamente.",
      )}`,
    );
  } finally {
    conn.release();
  }
}

const reaperturaSchema = z.object({
  ubigeo: z.coerce.number().int().positive().optional(),
  etapa: etapaSchema,
  overwrite: z.coerce.number().int().min(0).max(1).optional(),
  voluntarios: z.string().trim().min(2),
});

export async function reaperturaMensualAction(formData: FormData) {
  const user = await requireAdminOrSuperAdmin();
  const parsed = reaperturaSchema.safeParse({
    ubigeo: formData.get("ubigeo"),
    etapa: String(formData.get("etapa") ?? ""),
    overwrite: formData.get("overwrite"),
    voluntarios: String(formData.get("voluntarios") ?? ""),
  });
  if (!parsed.success) {
    redirect(`/admin/padronnominal?tab=reapertura&err=1&msg=${qs("Datos inválidos.")}`);
  }

  const ubigeo = user.tipo === "SUPER ADMIN" ? parsed.data.ubigeo ?? null : user.ubigeo ?? null;
  if (!ubigeo) {
    redirect(`/admin/padronnominal?tab=reapertura&err=1&msg=${qs("Falta ubigeo.")}`);
  }
  const etapa = parsed.data.etapa;
  const overwrite = Number(parsed.data.overwrite ?? 0) === 1;

  let voluntariosRaw: unknown = null;
  try {
    voluntariosRaw = JSON.parse(parsed.data.voluntarios);
  } catch {
    voluntariosRaw = null;
  }
  if (!Array.isArray(voluntariosRaw)) {
    redirect(`/admin/padronnominal?tab=reapertura&err=1&msg=${qs("Selección de voluntarios inválida.")}`);
  }
  const voluntarios = voluntariosRaw
    .map((x) => String(x ?? "").trim())
    .filter((x) => x.length >= 6);
  const voluntariosUniq = Array.from(new Set(voluntarios));
  if (!voluntariosUniq.length) {
    redirect(`/admin/padronnominal?tab=reapertura&err=1&msg=${qs("Selecciona al menos un voluntario.")}`);
  }

  const prevEtapas = Array.from({ length: 6 }, (_, i) => monthStartAdd(etapa, -(i + 1))).filter(Boolean);
  const etapaPrev1 = prevEtapas[0] ?? "";
  if (!etapaPrev1) {
    redirect(`/admin/padronnominal?tab=reapertura&err=1&msg=${qs("No se pudo calcular etapa anterior.")}`);
  }

  const pool = getDbPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    try {
      await conn.query("ALTER TABLE persona ADD COLUMN voluntario TINYINT NOT NULL DEFAULT 0");
    } catch {}

    const [rowsTarget] = await conn.query(
      `SELECT TRIM(dni) AS dni, TRIM(COALESCE(actorsocial,'')) AS actorsocial, TRIM(COALESCE(responsable,'')) AS responsable
       FROM padronnominal
       WHERE ubigeo = ?
         AND DATE_FORMAT(etapa,'%Y-%m-01') = ?
         AND TRIM(COALESCE(dni,'')) <> ''
         AND TRIM(COALESCE(tipovd,'')) = '1'`,
      [ubigeo, etapa],
    );
    const targets = (rowsTarget as any[]).map((r) => ({
      dni: String(r.dni ?? "").trim(),
      actorsocial: String(r.actorsocial ?? "").trim(),
      responsable: String(r.responsable ?? "").trim(),
    }));
    const dniList = targets.map((t) => t.dni).filter(Boolean);
    if (!dniList.length) {
      await conn.rollback();
      redirect(`/admin/padronnominal?tab=reapertura&err=1&msg=${qs("No hay niños (tipovd=1) en la etapa seleccionada.")}`);
    }

    const badSet = new Set([2, 6, 7, 8, 10]);
    const idocPrev1 = new Map<string, number>();
    const histAssign = new Map<string, { actorsocial: string; responsable: string }>();

    const chunk = 900;
    for (let i = 0; i < prevEtapas.length; i++) {
      const e = prevEtapas[i]!;
      for (let j = 0; j < dniList.length; j += chunk) {
        const part = dniList.slice(j, j + chunk);
        const placeholders = part.map(() => "?").join(",");
        const [rowsPrev] = await conn.query(
          `SELECT TRIM(dni) AS dni, TRIM(COALESCE(actorsocial,'')) AS actorsocial, TRIM(COALESCE(responsable,'')) AS responsable, idocurrencia
           FROM padronnominal
           WHERE ubigeo = ?
             AND DATE_FORMAT(etapa,'%Y-%m-01') = ?
             AND TRIM(COALESCE(tipovd,'')) = '1'
             AND TRIM(dni) IN (${placeholders})`,
          [ubigeo, e, ...part],
        );
        for (const r of rowsPrev as any[]) {
          const dni = String(r.dni ?? "").trim();
          if (!dni) continue;
          const ido = Number(r.idocurrencia ?? 0);
          if (e === etapaPrev1 && !idocPrev1.has(dni) && Number.isFinite(ido)) idocPrev1.set(dni, ido);
          if (histAssign.has(dni)) continue;
          const a = String(r.actorsocial ?? "").trim();
          const resp = String(r.responsable ?? "").trim();
          if (a) histAssign.set(dni, { actorsocial: a, responsable: resp });
        }
      }
    }

    const vPlaceholders = voluntariosUniq.map(() => "?").join(",");
    const [rowsVol] = await conn.query(
      `SELECT TRIM(dni) AS dni, TRIM(COALESCE(cdr,'')) AS cdr
       FROM persona
       WHERE ubigeo = ?
         AND UPPER(tipo) LIKE 'ACTOR SOCIAL%'
         AND estado = 1
         AND voluntario = 1
         AND TRIM(dni) IN (${vPlaceholders})
       ORDER BY dni ASC`,
      [ubigeo, ...voluntariosUniq],
    );
    const vols = (rowsVol as any[])
      .map((r) => ({ dni: String(r.dni ?? "").trim(), cdr: String(r.cdr ?? "").trim() }))
      .filter((r) => r.dni);
    if (!vols.length) {
      await conn.rollback();
      redirect(`/admin/padronnominal?tab=reapertura&err=1&msg=${qs("No se encontraron voluntarios activos para la selección indicada.")}`);
    }
    const volsSorted = vols.slice().sort((a, b) => a.dni.localeCompare(b.dni));

    const updates: Array<[string, string, number, string, string]> = [];
    let matchedHist = 0;
    let assignedVol = 0;
    let rr = 0;

    const targetsSorted = targets.slice().sort((a, b) => a.dni.localeCompare(b.dni));
    for (const t of targetsSorted) {
      const hasAssign = Boolean(t.actorsocial && t.actorsocial !== "0");
      if (!overwrite && hasAssign) continue;

      const ido = idocPrev1.get(t.dni);
      const needsVol = typeof ido === "number" && badSet.has(ido);

      if (needsVol) {
        const v = volsSorted[rr % volsSorted.length]!;
        rr += 1;
        updates.push([v.dni, v.cdr || "", ubigeo, etapa, t.dni]);
        assignedVol += 1;
        continue;
      }

      const prev = histAssign.get(t.dni);
      if (prev && prev.actorsocial) {
        updates.push([prev.actorsocial, prev.responsable || "", ubigeo, etapa, t.dni]);
        matchedHist += 1;
      }
    }

    let changed = 0;
    if (updates.length) {
      try {
        await conn.query(
          "CREATE TEMPORARY TABLE tmp_reapertura (dni VARCHAR(15) PRIMARY KEY, actorsocial VARCHAR(15) NULL, responsable VARCHAR(15) NULL) ENGINE=MEMORY",
        );
        const rowsToInsert = updates.map((u) => [u[4], u[0], u[1]]);
        const batchInsert = 900;
        for (let i = 0; i < rowsToInsert.length; i += batchInsert) {
          const part = rowsToInsert.slice(i, i + batchInsert);
          await conn.query("INSERT INTO tmp_reapertura (dni, actorsocial, responsable) VALUES ?", [part]);
        }
        const [r2] = await conn.query(
          `UPDATE padronnominal pn
           JOIN tmp_reapertura t ON TRIM(pn.dni) = t.dni
           SET pn.actorsocial = t.actorsocial, pn.responsable = t.responsable
           WHERE pn.ubigeo = ?
             AND DATE_FORMAT(pn.etapa,'%Y-%m-01') = ?
             AND TRIM(COALESCE(pn.tipovd,'')) = '1'`,
          [ubigeo, etapa],
        );
        changed = Number((r2 as any)?.changedRows ?? 0);
      } catch {
        for (const u of updates) {
          const [r2] = await conn.query(
            "UPDATE padronnominal SET actorsocial = ?, responsable = ? WHERE ubigeo = ? AND DATE_FORMAT(etapa,'%Y-%m-01') = ? AND TRIM(dni) = ?",
            u,
          );
          changed += Number((r2 as any)?.changedRows ?? 0);
        }
      }
    }

    await conn.commit();
    revalidatePath("/admin/padronnominal");
    redirect(
      `/admin/padronnominal?tab=reapertura&ok=1&rows=${dniList.length}&rows2=${matchedHist}&chg1=${assignedVol}&chg2=${changed}`,
    );
  } catch (e: any) {
    try {
      await conn.rollback();
    } catch {}
    const msg = String(e?.message ?? e ?? "")
      .replaceAll("\n", " ")
      .replaceAll("\r", " ")
      .slice(0, 220);
    redirect(
      `/admin/padronnominal?tab=reapertura&err=1&msg=${qs(
        msg ? `No se pudo completar la reapertura: ${msg}` : "No se pudo completar la reapertura. Revisa la BD e inténtalo nuevamente.",
      )}`,
    );
  } finally {
    conn.release();
  }
}

