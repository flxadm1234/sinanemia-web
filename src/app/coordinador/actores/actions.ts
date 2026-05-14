"use server";

import { z } from "zod";
import { requireCoordinador } from "@/lib/auth";
import { createPersona } from "@/lib/persona";
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

