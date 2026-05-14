"use server";

import { z } from "zod";
import { requireAdminOrCoordinador } from "@/lib/auth";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";
import {
  asignarPadron,
  countAsignadosActor,
  countIdsEnEtapaUbigeo,
  countSeleccionYaAsignado,
} from "@/lib/padronnominal";
import { findActorSocialByDni } from "@/lib/persona";
import { revalidatePath } from "next/cache";

const schema = z.object({
  ids: z.string().trim().min(2),
  actor: z.string().trim().min(6),
});

export type AsignacionResult =
  | { ok: true; affected: number }
  | { ok: false; message: string };

export async function asignarAction(
  _prev: AsignacionResult | null,
  formData: FormData,
): Promise<AsignacionResult> {
  const user = await requireAdminOrCoordinador();
  const parsed = schema.safeParse({
    ids: String(formData.get("ids") ?? ""),
    actor: String(formData.get("actor") ?? ""),
  });
  if (!parsed.success) return { ok: false, message: "Datos inválidos." };

  const idsRaw = (() => {
    try {
      return JSON.parse(parsed.data.ids) as unknown;
    } catch {
      return null;
    }
  })();
  if (!Array.isArray(idsRaw)) return { ok: false, message: "Selección inválida." };
  const ids = idsRaw
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) return { ok: false, message: "Selecciona al menos un registro." };

  const ubigeo = user.ubigeo;
  if (!ubigeo) return { ok: false, message: "Tu usuario no tiene ubigeo." };

  const sel = await getEtapaSeleccionadaPorUbigeo(ubigeo);
  const etapa = sel?.etapa ?? "";
  if (!etapa) return { ok: false, message: "No hay etapa seleccionada para tu ubigeo." };

  const actor = await findActorSocialByDni(parsed.data.actor);
  if (!actor) return { ok: false, message: "Actor social no encontrado." };
  if ((actor.ubigeo ?? null) !== ubigeo)
    return { ok: false, message: "El actor social no pertenece a tu ubigeo." };

  const cdr = String(actor.cdr ?? "").trim();
  if (!cdr) return { ok: false, message: "El actor social no tiene coordinador asignado (CDR)." };

  if (user.tipo === "COORDINADOR" && cdr !== user.dni)
    return { ok: false, message: "Solo puedes asignar a tus actores sociales." };

  const countOk = await countIdsEnEtapaUbigeo({ ubigeo, etapa, ids });
  if (countOk !== ids.length)
    return { ok: false, message: "La selección contiene registros fuera de tu etapa/ubigeo." };

  const yaAsignado = await countSeleccionYaAsignado({
    ubigeo,
    etapa,
    actor: actor.dni,
    ids,
  });
  const actuales = await countAsignadosActor({ ubigeo, etapa, actor: actor.dni });
  const extra = ids.length - yaAsignado;
  const total = actuales + extra;

  if (total > 20) {
    const cupo = Math.max(20 - actuales, 0);
    return {
      ok: false,
      message: `No se puede asignar. Cupo disponible para este actor: ${cupo}. Máximo 20 niños por etapa.`,
    };
  }

  const res = await asignarPadron({
    ubigeo,
    etapa,
    ids,
    actor: actor.dni,
    responsable: cdr,
  });
  const affected = Number((res as any)?.affectedRows ?? 0);
  revalidatePath("/asignacion");
  return { ok: true, affected };
}

