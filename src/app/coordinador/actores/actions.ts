"use server";

import { z } from "zod";
import { requireCoordinador } from "@/lib/auth";
import { createPersona, findPersonaById, updatePersonaById } from "@/lib/persona";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const createActorSchema = z.object({
  dni: z.string().trim().min(8).max(15),
  nombrecompleto: z.string().trim().optional(),
  apellidos: z.string().trim().min(1).max(100),
  clave: z.string().min(1).max(50),
  telefono: z.string().trim().optional(),
  direccion: z.string().trim().optional(),
  email: z.string().trim().optional(),
});

export async function createActorAction(formData: FormData) {
  const user = await requireCoordinador();

  const parsed = createActorSchema.safeParse({
    dni: String(formData.get("dni") ?? ""),
    nombrecompleto: String(formData.get("nombrecompleto") ?? ""),
    apellidos: String(formData.get("apellidos") ?? ""),
    clave: String(formData.get("clave") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    direccion: String(formData.get("direccion") ?? ""),
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) return;

  await createPersona({
    dni: parsed.data.dni,
    nombrecompleto: parsed.data.nombrecompleto || null,
    apellidos: parsed.data.apellidos,
    tipo: "ACTOR SOCIAL",
    clave: parsed.data.clave,
    ubigeo: user.ubigeo ?? null,
    cdr: user.dni,
    telefono: parsed.data.telefono || "",
    direccion: parsed.data.direccion || "",
    email: parsed.data.email || null,
  });

  revalidatePath("/coordinador/actores");
  redirect("/coordinador/actores");
}

const updateActorSchema = z.object({
  idpersona: z.coerce.number().int().positive(),
  nombrecompleto: z.string().trim().optional(),
  apellidos: z.string().trim().optional(),
  clave: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  direccion: z.string().trim().optional(),
  email: z.string().trim().optional(),
});

export async function updateActorAction(formData: FormData) {
  const user = await requireCoordinador();
  const parsed = updateActorSchema.safeParse({
    idpersona: formData.get("idpersona"),
    nombrecompleto: String(formData.get("nombrecompleto") ?? ""),
    apellidos: String(formData.get("apellidos") ?? ""),
    clave: String(formData.get("clave") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    direccion: String(formData.get("direccion") ?? ""),
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) return;

  const current = await findPersonaById(parsed.data.idpersona);
  if (!current) return;

  const tipo = (current.tipo ?? "").toUpperCase();
  if (!tipo.startsWith("ACTOR SOCIAL")) return;
  if ((current.cdr ?? "") !== user.dni) return;

  const patch: any = {};
  if (parsed.data.nombrecompleto !== undefined)
    patch.nombrecompleto = parsed.data.nombrecompleto
      ? parsed.data.nombrecompleto
      : null;
  if (parsed.data.apellidos !== undefined && parsed.data.apellidos.trim())
    patch.apellidos = parsed.data.apellidos.trim();
  if (parsed.data.clave !== undefined && parsed.data.clave.trim())
    patch.clave = parsed.data.clave.trim();
  if (parsed.data.telefono !== undefined) patch.telefono = parsed.data.telefono.trim();
  if (parsed.data.direccion !== undefined) patch.direccion = parsed.data.direccion.trim();
  if (parsed.data.email !== undefined)
    patch.email = parsed.data.email.trim() ? parsed.data.email.trim() : null;

  await updatePersonaById(parsed.data.idpersona, patch);
  revalidatePath("/coordinador/actores");
  revalidatePath(`/coordinador/actores/${parsed.data.idpersona}`);
  redirect("/coordinador/actores");
}
