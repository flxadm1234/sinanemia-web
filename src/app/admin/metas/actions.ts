"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { ensureMetasC1Table, upsertMetaC1, type MetaC1Tipo } from "@/lib/metasC1";

const ubigeoSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Ubigeo inválido.");

const vallaSchema = z.coerce.number().int().min(0).max(100);

const schema = z.object({
  ubigeo: ubigeoSchema.optional(),
  descripcion_1: z.string().trim().min(3).max(255),
  valla_1: vallaSchema,
  descripcion_2: z.string().trim().min(3).max(255),
  valla_2: vallaSchema,
  descripcion_3: z.string().trim().min(3).max(255),
  valla_3: vallaSchema,
  descripcion_4: z.string().trim().min(3).max(255),
  valla_4: vallaSchema,
  descripcion_5: z.string().trim().min(3).max(255),
  valla_5: vallaSchema,
});

export async function saveMetasC1Action(_: any, formData: FormData) {
  const user = await requireSession();
  await ensureMetasC1Table();

  const parsed = schema.safeParse({
    ubigeo: formData.get("ubigeo"),
    descripcion_1: formData.get("descripcion_1"),
    valla_1: formData.get("valla_1"),
    descripcion_2: formData.get("descripcion_2"),
    valla_2: formData.get("valla_2"),
    descripcion_3: formData.get("descripcion_3"),
    valla_3: formData.get("valla_3"),
    descripcion_4: formData.get("descripcion_4"),
    valla_4: formData.get("valla_4"),
    descripcion_5: formData.get("descripcion_5"),
    valla_5: formData.get("valla_5"),
  });

  if (!parsed.success) return { ok: false, message: "Datos inválidos." };

  const ubigeo =
    user.tipo === "SUPER ADMIN"
      ? parsed.data.ubigeo ?? ""
      : String(user.ubigeo ?? "");
  if (!ubigeo) return { ok: false, message: "Tu usuario no tiene ubigeo." };

  const upserts: Array<[MetaC1Tipo, string, number]> = [
    [1, parsed.data.descripcion_1, parsed.data.valla_1],
    [2, parsed.data.descripcion_2, parsed.data.valla_2],
    [3, parsed.data.descripcion_3, parsed.data.valla_3],
    [4, parsed.data.descripcion_4, parsed.data.valla_4],
    [5, parsed.data.descripcion_5, parsed.data.valla_5],
  ];

  for (const [tipo, descripcion_meta, valla_min] of upserts) {
    await upsertMetaC1({ ubigeo, tipo, descripcion_meta, valla_min });
  }

  return { ok: true, message: "Metas actualizadas." };
}

