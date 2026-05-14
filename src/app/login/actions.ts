"use server";

import { z } from "zod";
import { createSessionCookie, routeForRole } from "@/lib/auth";
import { findPersonaForLogin, getRoleFromPersonaTipo } from "@/lib/persona";
import { redirect } from "next/navigation";

const loginSchema = z.object({
  dni: z.string().trim().min(8).max(15),
  clave: z.string().min(1).max(50),
});

export async function loginAction(_: unknown, formData: FormData) {
  const parsed = loginSchema.safeParse({
    dni: String(formData.get("dni") ?? ""),
    clave: String(formData.get("clave") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos." };
  }

  const { dni, clave } = parsed.data;
  let persona: Awaited<ReturnType<typeof findPersonaForLogin>> | null = null;
  try {
    persona = await findPersonaForLogin(dni, clave);
  } catch {
    return {
      ok: false as const,
      error: "No se pudo conectar con la base de datos. Intenta nuevamente.",
    };
  }

  if (!persona) return { ok: false as const, error: "Credenciales incorrectas." };
  if ((persona.estado ?? 0) !== 1)
    return { ok: false as const, error: "Usuario inactivo." };

  const role = getRoleFromPersonaTipo(persona.tipo);
  if (!role) return { ok: false as const, error: "Usuario sin rol válido." };

  try {
    await createSessionCookie({
      dni: persona.dni,
      tipo: role,
      ubigeo: persona.ubigeo ?? null,
      nombre:
        `${persona.nombrecompleto ?? ""} ${persona.apellidos ?? ""}`.trim() ||
        persona.dni,
    });
  } catch {
    return {
      ok: false as const,
      error: "No se pudo iniciar sesión. Intenta nuevamente.",
    };
  }

  redirect(routeForRole(role));
}

