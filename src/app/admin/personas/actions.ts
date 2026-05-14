"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createPersona, updatePersona, updatePersonaEstado } from "@/lib/persona";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const estadoSchema = z.object({
  dni: z.string().trim().min(1),
  estado: z.coerce.number().int().min(0).max(1),
});

export async function setEstadoAction(formData: FormData) {
  await requireAdmin();
  const parsed = estadoSchema.safeParse({
    dni: String(formData.get("dni") ?? ""),
    estado: formData.get("estado"),
  });
  if (!parsed.success) return;

  await updatePersonaEstado(parsed.data.dni, parsed.data.estado);
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
  await requireAdmin();
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

  await createPersona({
    dni: parsed.data.dni,
    nombrecompleto: parsed.data.nombrecompleto || null,
    apellidos: parsed.data.apellidos,
    tipo: parsed.data.tipo,
    clave: parsed.data.clave,
    ubigeo: Number.isFinite(parsed.data.ubigeo) ? parsed.data.ubigeo : null,
    cdr: parsed.data.cdr || "0",
    telefono: parsed.data.telefono || "",
    direccion: parsed.data.direccion || "",
    email: parsed.data.email || null,
  });

  revalidatePath("/admin/personas");
  redirect("/admin/personas");
}

const personaUpdateSchema = z.object({
  dni: z.string().trim().min(1),
  nombrecompleto: z.string().trim().optional(),
  apellidos: z.string().trim().optional(),
  tipo: z.string().trim().optional(),
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

export async function updatePersonaAction(formData: FormData) {
  await requireAdmin();
  const parsed = personaUpdateSchema.safeParse({
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

  const data = parsed.data;
  const patch: any = {};

  if (data.nombrecompleto !== undefined)
    patch.nombrecompleto = data.nombrecompleto ? data.nombrecompleto : null;
  if (data.apellidos !== undefined && data.apellidos.trim())
    patch.apellidos = data.apellidos.trim();
  if (data.tipo !== undefined && data.tipo.trim()) patch.tipo = data.tipo.trim();
  if (data.clave !== undefined && data.clave.trim()) patch.clave = data.clave.trim();
  if (data.ubigeo !== undefined)
    patch.ubigeo = Number.isFinite(data.ubigeo) ? data.ubigeo : null;
  if (data.cdr !== undefined && data.cdr.trim()) patch.cdr = data.cdr.trim();
  if (data.telefono !== undefined) patch.telefono = data.telefono.trim();
  if (data.direccion !== undefined) patch.direccion = data.direccion.trim();
  if (data.email !== undefined) patch.email = data.email.trim() ? data.email.trim() : null;

  await updatePersona(data.dni, patch);
  revalidatePath("/admin/personas");
  revalidatePath(`/admin/personas/${data.dni}`);
}

