"use server";

import { z } from "zod";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { ensurePadronVdTables, updatePadronVdConfig } from "@/lib/padronVdImport";

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
  col_dni: z.coerce.number().int().min(1).max(500),
  col_fecha_nac: z.coerce.number().int().min(1).max(500),
  col_departamento: toCol,
  col_provincia: toCol,
  col_distrito: toCol,
  col_actorsocial: toCol,
  col_responsable: toCol,
  col_dnimadre: toCol,
  col_telefono: toCol,
  col_rango: toCol,
  col_direccion: toCol,
  col_ccpp: toCol,
  col_eess_ua: toCol,
  col_fecha_inicio_vd: toCol,
  col_fecha_fin_vd: toCol,
  col_etapa: toCol,
  col_nrovd: toCol,
});

export async function updatePadronVdConfigAction(_: any, formData: FormData) {
  await requireAdminOrSuperAdmin();
  await ensurePadronVdTables();

  const parsed = schema.safeParse({
    sheet_index: formData.get("sheet_index"),
    start_row: formData.get("start_row"),
    col_ubigeo: formData.get("col_ubigeo"),
    col_dni: formData.get("col_dni"),
    col_fecha_nac: formData.get("col_fecha_nac"),
    col_departamento: formData.get("col_departamento"),
    col_provincia: formData.get("col_provincia"),
    col_distrito: formData.get("col_distrito"),
    col_actorsocial: formData.get("col_actorsocial"),
    col_responsable: formData.get("col_responsable"),
    col_dnimadre: formData.get("col_dnimadre"),
    col_telefono: formData.get("col_telefono"),
    col_rango: formData.get("col_rango"),
    col_direccion: formData.get("col_direccion"),
    col_ccpp: formData.get("col_ccpp"),
    col_eess_ua: formData.get("col_eess_ua"),
    col_fecha_inicio_vd: formData.get("col_fecha_inicio_vd"),
    col_fecha_fin_vd: formData.get("col_fecha_fin_vd"),
    col_etapa: formData.get("col_etapa"),
    col_nrovd: formData.get("col_nrovd"),
  });

  if (!parsed.success) return { ok: false, message: "Datos inválidos." };

  const d = parsed.data;
  await updatePadronVdConfig({
    sheet_index: d.sheet_index,
    start_row: d.start_row,
    col_ubigeo: d.col_ubigeo - 1,
    col_dni: d.col_dni - 1,
    col_fecha_nac: d.col_fecha_nac - 1,
    col_departamento: d.col_departamento == null ? null : d.col_departamento - 1,
    col_provincia: d.col_provincia == null ? null : d.col_provincia - 1,
    col_distrito: d.col_distrito == null ? null : d.col_distrito - 1,
    col_actorsocial: d.col_actorsocial == null ? null : d.col_actorsocial - 1,
    col_responsable: d.col_responsable == null ? null : d.col_responsable - 1,
    col_dnimadre: d.col_dnimadre == null ? null : d.col_dnimadre - 1,
    col_telefono: d.col_telefono == null ? null : d.col_telefono - 1,
    col_rango: d.col_rango == null ? null : d.col_rango - 1,
    col_direccion: d.col_direccion == null ? null : d.col_direccion - 1,
    col_ccpp: d.col_ccpp == null ? null : d.col_ccpp - 1,
    col_eess_ua: d.col_eess_ua == null ? null : d.col_eess_ua - 1,
    col_fecha_inicio_vd: d.col_fecha_inicio_vd == null ? null : d.col_fecha_inicio_vd - 1,
    col_fecha_fin_vd: d.col_fecha_fin_vd == null ? null : d.col_fecha_fin_vd - 1,
    col_etapa: d.col_etapa == null ? null : d.col_etapa - 1,
    col_nrovd: d.col_nrovd == null ? null : d.col_nrovd - 1,
  });

  return { ok: true, message: "Configuración actualizada." };
}

