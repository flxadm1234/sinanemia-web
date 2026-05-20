"use server";

import { z } from "zod";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import {
  createPersona,
  findPersonaById,
  updatePersonaEstado,
} from "@/lib/persona";
import { getDbPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";

const estadoSchema = z.object({
  idpersona: z.coerce.number().int().positive(),
  estado: z.coerce.number().int().min(0).max(1),
});

export async function setEstadoAction(formData: FormData) {
  const user = await requireAdminOrSuperAdmin();
  const parsed = estadoSchema.safeParse({
    idpersona: formData.get("idpersona"),
    estado: formData.get("estado"),
  });
  if (!parsed.success) return;

  if (user.tipo === "ADMINISTRADOR") {
    const current = await findPersonaById(parsed.data.idpersona);
    if (!current) return;
    if ((current.ubigeo ?? null) !== (user.ubigeo ?? null)) return;
  }

  await updatePersonaEstado(parsed.data.idpersona, parsed.data.estado);
  revalidatePath("/admin/personas");
}

const personaCreateSchema = z.object({
  dni: z.string().trim().min(8).max(15),
  nombrecompleto: z.string().trim().optional(),
  apellidos: z.string().trim().min(1).max(100),
  tipo: z.string().trim().min(1).max(30),
  clave: z.string().min(1).max(50),
  ubigeo: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null)),
  cdr: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  direccion: z.string().trim().optional(),
  email: z.string().trim().optional(),
});

export async function createPersonaAction(formData: FormData) {
  const user = await requireAdminOrSuperAdmin();
  const parsed = personaCreateSchema.safeParse({
    dni: String(formData.get("dni") ?? ""),
    nombrecompleto: String(formData.get("nombrecompleto") ?? ""),
    apellidos: String(formData.get("apellidos") ?? ""),
    tipo: String(formData.get("tipo") ?? ""),
    clave: String(formData.get("clave") ?? ""),
    ubigeo: String(formData.get("ubigeo") ?? ""),
    cdr: String(formData.get("cdr") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    direccion: String(formData.get("direccion") ?? ""),
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) return;

  const tipoUpper = parsed.data.tipo.trim().toUpperCase();
  if (
    user.tipo === "ADMINISTRADOR" &&
    (tipoUpper === "SUPER ADMIN" || tipoUpper === "SUPERVISOR")
  )
    return;

  const ubigeoFinal =
    user.tipo === "SUPER ADMIN"
      ? Number.isFinite(parsed.data.ubigeo)
        ? parsed.data.ubigeo
        : null
      : user.ubigeo ?? null;

  await createPersona({
    dni: parsed.data.dni,
    nombrecompleto: parsed.data.nombrecompleto || null,
    apellidos: parsed.data.apellidos,
    tipo: tipoUpper,
    clave: parsed.data.clave,
    ubigeo: ubigeoFinal,
    cdr: parsed.data.cdr || "0",
    telefono: parsed.data.telefono || "",
    direccion: parsed.data.direccion || "",
    email: parsed.data.email || null,
  });

  revalidatePath("/admin/personas");
  redirect("/admin/personas");
}

const personaUpdateSchema = z.object({
  idpersona: z.coerce.number().int().positive(),
  nombrecompleto: z.string().trim().optional(),
  apellidos: z.string().trim().optional(),
  clave: z.string().trim().optional(),
  ubigeo: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null)),
  cdr: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  direccion: z.string().trim().optional(),
  email: z.string().trim().optional(),
});

function qs(v: string) {
  return encodeURIComponent(v);
}

export async function updatePersonaAction(formData: FormData) {
  const user = await requireAdminOrSuperAdmin();
  const parsed = personaUpdateSchema.safeParse({
    idpersona: formData.get("idpersona"),
    nombrecompleto: String(formData.get("nombrecompleto") ?? ""),
    apellidos: String(formData.get("apellidos") ?? ""),
    clave: String(formData.get("clave") ?? ""),
    ubigeo: String(formData.get("ubigeo") ?? ""),
    cdr: String(formData.get("cdr") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    direccion: String(formData.get("direccion") ?? ""),
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) return;

  const data = parsed.data;
  const current = await findPersonaById(data.idpersona);
  if (!current) return;
  if (user.tipo === "ADMINISTRADOR") {
    if ((current.ubigeo ?? null) !== (user.ubigeo ?? null)) return;
  }

  const patch: any = {};
  const oldCdr = String(current.cdr ?? "").trim();

  if (data.nombrecompleto !== undefined)
    patch.nombrecompleto = data.nombrecompleto ? data.nombrecompleto : null;
  if (data.apellidos !== undefined && data.apellidos.trim())
    patch.apellidos = data.apellidos.trim();
  if (data.clave !== undefined && data.clave.trim()) patch.clave = data.clave.trim();
  if (user.tipo === "SUPER ADMIN") {
    if (data.ubigeo !== undefined)
      patch.ubigeo = Number.isFinite(data.ubigeo) ? data.ubigeo : null;
  }
  if (user.tipo === "ADMINISTRADOR" || user.tipo === "SUPER ADMIN") {
    if (data.cdr !== undefined && data.cdr.trim()) patch.cdr = data.cdr.trim();
  }
  if (data.telefono !== undefined) patch.telefono = data.telefono.trim();
  if (data.direccion !== undefined) patch.direccion = data.direccion.trim();
  if (data.email !== undefined) patch.email = data.email.trim() ? data.email.trim() : null;

  const newCdr = typeof patch.cdr === "string" ? patch.cdr.trim() : "";
  const needsPadronUpdate = Boolean(newCdr) && newCdr !== oldCdr;

  const ubigeoToUse =
    typeof user.ubigeo === "number"
      ? user.ubigeo
      : typeof current.ubigeo === "number"
        ? current.ubigeo
        : null;

  if (needsPadronUpdate && typeof ubigeoToUse !== "number") {
    redirect(
      `/admin/personas?err=1&msg=${qs("No se pudo determinar el ubigeo para actualizar padrón nominal.")}`,
    );
  }

  const etapaSel =
    needsPadronUpdate && typeof ubigeoToUse === "number"
      ? await getEtapaSeleccionadaPorUbigeo(ubigeoToUse)
      : null;
  const etapa = etapaSel?.etapa ?? "";
  if (needsPadronUpdate && !/^\d{4}-\d{2}-\d{2}$/.test(etapa)) {
    redirect(
      `/admin/personas?err=1&msg=${qs("No hay un mes seleccionado (seleccion=1) para este ubigeo. Configura el mes actual en Meses.")}`,
    );
  }

  const hasChanges = Object.keys(patch).length > 0;
  if (!hasChanges) {
    redirect(`/admin/personas?err=1&msg=${qs("No se detectaron cambios para guardar.")}`);
  }

  const pool = getDbPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const keys = Object.keys(patch);
    if (keys.length) {
      const set = keys.map((k) => `${k} = ?`).join(", ");
      const values = keys.map((k) => patch[k]);
      values.push(data.idpersona);
      await conn.query(`UPDATE persona SET ${set} WHERE idpersona = ?`, values);
    }

    let affectedPadron = 0;
    if (needsPadronUpdate && typeof ubigeoToUse === "number") {
      const [resPadron] = await conn.query(
        "UPDATE padronnominal SET responsable = ? WHERE responsable = ? AND ubigeo = ? AND etapa = ?",
        [newCdr, oldCdr, ubigeoToUse, etapa],
      );
      affectedPadron = Number((resPadron as any)?.affectedRows ?? 0);
    }

    await conn.commit();

    revalidatePath("/admin/personas");
    revalidatePath(`/admin/personas/${data.idpersona}`);

    const msg = needsPadronUpdate
      ? `Coordinador (CDR) actualizado. Padrón nominal actualizado en etapa ${etapa}: ${affectedPadron} registros.`
      : "Usuario actualizado correctamente.";
    redirect(`/admin/personas?ok=1&msg=${qs(msg)}`);
  } catch {
    try {
      await conn.rollback();
    } catch {}
    redirect(
      `/admin/personas?err=1&msg=${qs("No se pudo guardar los cambios. Revisa la BD e inténtalo nuevamente.")}`,
    );
  } finally {
    conn.release();
  }
}

