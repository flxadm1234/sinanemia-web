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

