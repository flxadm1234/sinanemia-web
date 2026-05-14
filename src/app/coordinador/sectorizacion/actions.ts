"use server";

import { z } from "zod";
import { requireCoordinador } from "@/lib/auth";
import { findPersonaById } from "@/lib/persona";
import { upsertSectorizacionByDni } from "@/lib/sectorizacionActor";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const schema = z.object({
  idpersona: z.coerce.number().int().positive(),
  tipo_centro_poblado: z.string().trim().optional(),
  centro_poblado: z.string().trim().optional(),
  zona: z.string().trim().optional(),
  mz: z.string().trim().optional(),
  sector: z.string().trim().optional(),
});

export async function saveSectorizacionCoordinadorAction(formData: FormData) {
  const user = await requireCoordinador();
  const parsed = schema.safeParse({
    idpersona: formData.get("idpersona"),
    tipo_centro_poblado: String(formData.get("tipo_centro_poblado") ?? ""),
    centro_poblado: String(formData.get("centro_poblado") ?? ""),
    zona: String(formData.get("zona") ?? ""),
    mz: String(formData.get("mz") ?? ""),
    sector: String(formData.get("sector") ?? ""),
  });
  if (!parsed.success) return;

  const persona = await findPersonaById(parsed.data.idpersona);
  if (!persona) return;

  const tipo = (persona.tipo ?? "").toUpperCase();
  if (!tipo.startsWith("ACTOR SOCIAL")) return;
  if ((persona.cdr ?? "") !== user.dni) return;

  await upsertSectorizacionByDni({
    dniActor: persona.dni,
    tipoCentroPoblado: parsed.data.tipo_centro_poblado || null,
    centroPoblado: parsed.data.centro_poblado || null,
    zona: parsed.data.zona || null,
    mz: parsed.data.mz || null,
    sector: parsed.data.sector || null,
  });

  revalidatePath("/coordinador/actores");
  revalidatePath(`/coordinador/sectorizacion/${persona.idpersona}`);
  redirect("/coordinador/actores");
}

