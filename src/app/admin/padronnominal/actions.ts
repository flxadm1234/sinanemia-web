"use server";

import { z } from "zod";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";
import { updatePadronActorSocial, updatePadronResponsable } from "@/lib/padronnominal";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const etapaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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
  if (!parsed.success) return;

  let ubigeo = user.ubigeo ?? null;
  let etapa = "";

  if (user.tipo === "SUPER ADMIN") {
    ubigeo = parsed.data.ubigeo ?? null;
    etapa = parsed.data.etapa ?? "";
  } else {
    const sel = await getEtapaSeleccionadaPorUbigeo(user.ubigeo ?? "");
    etapa = sel?.etapa ?? "";
  }

  if (!ubigeo) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(etapa)) return;

  const res = await updatePadronActorSocial({
    ubigeo,
    etapa,
    actorAnterior: parsed.data.actorAnterior,
    actorNuevo: parsed.data.actorNuevo,
  });

  const affected = Number((res as any)?.affectedRows ?? 0);
  revalidatePath("/admin/padronnominal");
  redirect(`/admin/padronnominal?tab=actor&ok=1&rows=${affected}`);
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
  if (!parsed.success) return;

  let ubigeo = user.ubigeo ?? null;
  let etapa = "";

  if (user.tipo === "SUPER ADMIN") {
    ubigeo = parsed.data.ubigeo ?? null;
    etapa = parsed.data.etapa ?? "";
  } else {
    const sel = await getEtapaSeleccionadaPorUbigeo(user.ubigeo ?? "");
    etapa = sel?.etapa ?? "";
  }

  if (!ubigeo) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(etapa)) return;

  const res = await updatePadronResponsable({
    ubigeo,
    etapa,
    responsableAnterior: parsed.data.responsableAnterior,
    responsableNuevo: parsed.data.responsableNuevo,
  });

  const affected = Number((res as any)?.affectedRows ?? 0);
  revalidatePath("/admin/padronnominal");
  redirect(`/admin/padronnominal?tab=responsable&ok=1&rows=${affected}`);
}

