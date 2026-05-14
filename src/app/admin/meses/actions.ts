"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createMes, setMesSeleccionadoById, updateMesById } from "@/lib/meses";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const createSchema = z.object({
  numero_mes: z.coerce.number().int().min(1).max(12),
  meses: z.string().trim().min(2).max(40),
  year: z.coerce.number().int().min(2000).max(2100),
});

const updateSchema = createSchema.extend({
  idmeses: z.coerce.number().int().min(1),
});

const selectSchema = z.object({
  idmeses: z.coerce.number().int().min(1),
});

function revalidateMeses() {
  revalidatePath("/admin/meses");
  revalidatePath("/asignacion");
  revalidatePath("/admin/padronnominal");
}

export async function createMesAction(_: any, formData: FormData) {
  const user = await requireAdmin();
  const ubigeo = user.ubigeo;
  if (!ubigeo) return { ok: false, message: "Tu usuario no tiene ubigeo." };

  const parsed = createSchema.safeParse({
    numero_mes: formData.get("numero_mes"),
    meses: formData.get("meses"),
    year: formData.get("year"),
  });
  if (!parsed.success) return { ok: false, message: "Datos inválidos." };

  const sel = String(formData.get("seleccion") ?? "") === "1";

  const res = await createMes({
    ubigeo,
    numero_mes: parsed.data.numero_mes,
    meses: parsed.data.meses,
    year: parsed.data.year,
    seleccion: sel ? 1 : 0,
  });

  if (sel) {
    const id = Number((res as any)?.insertId ?? 0);
    if (id > 0) await setMesSeleccionadoById({ ubigeo, idmeses: id });
  }

  revalidateMeses();
  redirect("/admin/meses");
}

export async function updateMesAction(_: any, formData: FormData) {
  const user = await requireAdmin();
  const ubigeo = user.ubigeo;
  if (!ubigeo) return { ok: false, message: "Tu usuario no tiene ubigeo." };

  const parsed = updateSchema.safeParse({
    idmeses: formData.get("idmeses"),
    numero_mes: formData.get("numero_mes"),
    meses: formData.get("meses"),
    year: formData.get("year"),
  });
  if (!parsed.success) return { ok: false, message: "Datos inválidos." };

  await updateMesById({
    ubigeo,
    idmeses: parsed.data.idmeses,
    patch: {
      numero_mes: parsed.data.numero_mes,
      meses: parsed.data.meses,
      year: parsed.data.year,
    },
  });

  revalidateMeses();
  redirect("/admin/meses");
}

export async function seleccionarMesAction(formData: FormData) {
  const user = await requireAdmin();
  const ubigeo = user.ubigeo;
  if (!ubigeo) return;

  const parsed = selectSchema.safeParse({
    idmeses: formData.get("idmeses"),
  });
  if (!parsed.success) return;

  await setMesSeleccionadoById({ ubigeo, idmeses: parsed.data.idmeses });
  revalidateMeses();
}

