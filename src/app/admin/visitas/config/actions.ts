"use server";

import { z } from "zod";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { ensureVisitasTables, updateVisitasConfig } from "@/lib/visitasImport";

const toCol = z.preprocess((v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}, z.number().int().min(1).max(500).nullable());

const schema = z.object({
  sheet_index: z.coerce.number().int().min(0).max(50),
  start_row: z.coerce.number().int().min(1).max(5000),
  col_ubigeo: z.coerce.number().int().min(1).max(500),
  col_dni_nino: z.coerce.number().int().min(1).max(500),
  col_fecha_intervencion: z.coerce.number().int().min(1).max(500),
  col_etapa_text: toCol,
  col_visitas_completas: toCol,
  col_dispositivo: toCol,
  col_estado_intervencion: toCol,
  col_latitud: toCol,
  col_longitud: toCol,
});

export async function updateVisitasConfigAction(_: any, formData: FormData) {
  await requireAdminOrSuperAdmin();
  await ensureVisitasTables();

  const parsed = schema.safeParse({
    sheet_index: formData.get("sheet_index"),
    start_row: formData.get("start_row"),
    col_ubigeo: formData.get("col_ubigeo"),
    col_dni_nino: formData.get("col_dni_nino"),
    col_fecha_intervencion: formData.get("col_fecha_intervencion"),
    col_etapa_text: formData.get("col_etapa_text"),
    col_visitas_completas: formData.get("col_visitas_completas"),
    col_dispositivo: formData.get("col_dispositivo"),
    col_estado_intervencion: formData.get("col_estado_intervencion"),
    col_latitud: formData.get("col_latitud"),
    col_longitud: formData.get("col_longitud"),
  });

  if (!parsed.success) return { ok: false, message: "Datos inválidos." };

  const d = parsed.data;
  await updateVisitasConfig({
    sheet_index: d.sheet_index,
    start_row: d.start_row,
    col_ubigeo: d.col_ubigeo - 1,
    col_dni_nino: d.col_dni_nino - 1,
    col_fecha_intervencion: d.col_fecha_intervencion - 1,
    col_etapa_text: d.col_etapa_text == null ? null : d.col_etapa_text - 1,
    col_visitas_completas: d.col_visitas_completas == null ? null : d.col_visitas_completas - 1,
    col_dispositivo: d.col_dispositivo == null ? null : d.col_dispositivo - 1,
    col_estado_intervencion:
      d.col_estado_intervencion == null ? null : d.col_estado_intervencion - 1,
    col_latitud: d.col_latitud == null ? null : d.col_latitud - 1,
    col_longitud: d.col_longitud == null ? null : d.col_longitud - 1,
  });

  return { ok: true, message: "Configuración actualizada." };
}

