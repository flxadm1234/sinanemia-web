"use server";

import { z } from "zod";
import { requireAdminOrSuperAdmin, requireMesesAccess, requireMesesManage } from "@/lib/auth";
import {
  createMes,
  setMesSeleccionadoById,
  updateMesById,
  updateMesByIdAny,
} from "@/lib/meses";
import { deletePadronByUbigeoEtapa } from "@/lib/padronnominal";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ubigeoSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Ubigeo inválido.");

const createSchema = z.object({
  numero_mes: z.coerce.number().int().min(1).max(12),
  meses: z.string().trim().min(2).max(40),
  year: z.coerce.number().int().min(2000).max(2100),
  ubigeo: ubigeoSchema.optional(),
});

const updateSchema = createSchema.extend({
  idmeses: z.coerce.number().int().min(1),
});

const selectSchema = z.object({
  idmeses: z.coerce.number().int().min(1),
  ubigeo: ubigeoSchema.optional(),
});

const deletePadronSchema = z.object({
  ubigeo: ubigeoSchema,
  etapa: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function revalidateMeses() {
  revalidatePath("/admin/meses");
  revalidatePath("/asignacion");
  revalidatePath("/admin/padronnominal");
}

export async function createMesAction(_: any, formData: FormData) {
  const user = await requireMesesAccess();
  const parsed = createSchema.safeParse({
    numero_mes: formData.get("numero_mes"),
    meses: formData.get("meses"),
    year: formData.get("year"),
    ubigeo: formData.get("ubigeo"),
  });
  if (!parsed.success) return { ok: false, message: "Datos inválidos." };

  const ubigeo =
    user.tipo === "SUPER ADMIN" || user.tipo === "SUPERVISOR"
      ? parsed.data.ubigeo ?? ""
      : String(user.ubigeo ?? "");
  if (!ubigeo) return { ok: false, message: "Tu usuario no tiene ubigeo." };

  const sel =
    user.tipo === "ADMINISTRADOR" || user.tipo === "SUPER ADMIN"
      ? String(formData.get("seleccion") ?? "") === "1"
      : false;

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
  const user = await requireMesesManage();
  const parsed = updateSchema.safeParse({
    idmeses: formData.get("idmeses"),
    numero_mes: formData.get("numero_mes"),
    meses: formData.get("meses"),
    year: formData.get("year"),
    ubigeo: formData.get("ubigeo"),
  });
  if (!parsed.success) return { ok: false, message: "Datos inválidos." };

  if (user.tipo === "SUPER ADMIN" || user.tipo === "SUPERVISOR") {
    const ubigeo = parsed.data.ubigeo ?? "";
    if (!ubigeo) return { ok: false, message: "Ubigeo requerido." };
    await updateMesByIdAny({
      idmeses: parsed.data.idmeses,
      patch: {
        numero_mes: parsed.data.numero_mes,
        meses: parsed.data.meses,
        year: parsed.data.year,
        ubigeo,
      },
    });
  } else {
    const ubigeo = user.ubigeo;
    if (!ubigeo) return { ok: false, message: "Tu usuario no tiene ubigeo." };
    await updateMesById({
      ubigeo,
      idmeses: parsed.data.idmeses,
      patch: {
        numero_mes: parsed.data.numero_mes,
        meses: parsed.data.meses,
        year: parsed.data.year,
      },
    });
  }

  revalidateMeses();
  redirect("/admin/meses");
}

export async function seleccionarMesAction(formData: FormData) {
  const user = await requireAdminOrSuperAdmin();

  const parsed = selectSchema.safeParse({
    idmeses: formData.get("idmeses"),
    ubigeo: formData.get("ubigeo"),
  });
  if (!parsed.success) return;

  const ubigeo =
    user.tipo === "SUPER ADMIN"
      ? parsed.data.ubigeo ?? ""
      : String(user.ubigeo ?? "");
  if (!ubigeo) return;

  await setMesSeleccionadoById({ ubigeo, idmeses: parsed.data.idmeses });
  revalidateMeses();
}

export async function deletePadronMesAction(formData: FormData) {
  const user = await requireAdminOrSuperAdmin();
  const parsed = deletePadronSchema.safeParse({
    ubigeo: formData.get("ubigeo"),
    etapa: formData.get("etapa"),
  });
  if (!parsed.success) return;

  if (user.tipo === "ADMINISTRADOR") {
    const own = String(user.ubigeo ?? "");
    if (!own) return;
    if (parsed.data.ubigeo !== own) return;
  }

  await deletePadronByUbigeoEtapa({
    ubigeo: Number(parsed.data.ubigeo),
    etapa: parsed.data.etapa,
  });
  revalidateMeses();
}

