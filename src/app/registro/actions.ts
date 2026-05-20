"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSessionCookie } from "@/lib/auth";
import { createPersona, findPersonaByDni, getRoleFromPersonaTipo } from "@/lib/persona";

const schema = z.object({
  dni: z.string().trim().min(6).max(15),
  nombrecompleto: z.string().trim().min(2).max(200),
  clave: z.string().trim().min(3).max(15),
  ubigeo: z.coerce.number().int().positive(),
});

type RegisterState = { ok: false; error: string } | null;

export async function registerInvitadoAction(_: RegisterState, formData: FormData) {
  const parsed = schema.safeParse({
    dni: formData.get("dni"),
    nombrecompleto: formData.get("nombrecompleto"),
    clave: formData.get("clave"),
    ubigeo: formData.get("ubigeo"),
  });

  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const existing = await findPersonaByDni(parsed.data.dni);
  if (existing) return { ok: false, error: "El DNI ya tiene una cuenta registrada." };

  await createPersona({
    dni: parsed.data.dni,
    nombrecompleto: parsed.data.nombrecompleto,
    apellidos: "-",
    tipo: "INVITADO",
    clave: parsed.data.clave,
    ubigeo: parsed.data.ubigeo,
    cdr: "0",
    telefono: "",
    direccion: "",
    email: null,
  });

  const role = getRoleFromPersonaTipo("INVITADO");
  await createSessionCookie({
    dni: parsed.data.dni,
    tipo: role ?? "INVITADO",
    ubigeo: parsed.data.ubigeo,
    nombre: parsed.data.nombrecompleto,
  });

  redirect("/dashboard");
}

