import { AppShell } from "@/components/AppShell";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { ensurePadronVdTables, getPadronVdConfig } from "@/lib/padronVdImport";
import { updatePadronVdConfigAction } from "./actions";
import { PadronVdConfigFormClient } from "@/components/PadronVdConfigFormClient";

function toOneBased(v: number | null | undefined) {
  if (v == null) return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return String(n + 1);
}

export default async function ConfigCargaVdPage() {
  const user = await requireAdminOrSuperAdmin();
  await ensurePadronVdTables();
  const cfg = await getPadronVdConfig();

  const clientCfg = {
    sheet_index: cfg.sheet_index,
    start_row: cfg.start_row,
    col_ubigeo: toOneBased(cfg.col_ubigeo),
    col_dni: toOneBased(cfg.col_dni),
    col_fecha_nac: toOneBased(cfg.col_fecha_nac),
    col_departamento: toOneBased(cfg.col_departamento),
    col_provincia: toOneBased(cfg.col_provincia),
    col_distrito: toOneBased(cfg.col_distrito),
    col_actorsocial: toOneBased(cfg.col_actorsocial),
    col_responsable: toOneBased(cfg.col_responsable),
    col_dnimadre: toOneBased(cfg.col_dnimadre),
    col_telefono: toOneBased(cfg.col_telefono),
    col_rango: toOneBased(cfg.col_rango),
    col_direccion: toOneBased(cfg.col_direccion),
    col_ccpp: toOneBased(cfg.col_ccpp),
    col_eess_ua: toOneBased(cfg.col_eess_ua),
    col_fecha_inicio_vd: toOneBased(cfg.col_fecha_inicio_vd),
    col_fecha_fin_vd: toOneBased(cfg.col_fecha_fin_vd),
    col_etapa: toOneBased(cfg.col_etapa),
    col_nrovd: toOneBased(cfg.col_nrovd),
  };

  return (
    <AppShell user={user} title="Configurar columnas (Carga VD)">
      <div className="rounded-2xl bg-white ring-1 ring-black/5 p-6">
        <div className="text-lg font-semibold text-zinc-900">Configuración de columnas</div>
        <div className="mt-1 text-sm text-zinc-600">
          Ingresa el número de columna (A=1, B=2, ..., Z=26, AA=27). Deja vacío si no existe.
        </div>
        <PadronVdConfigFormClient cfg={clientCfg} action={updatePadronVdConfigAction} />
      </div>
    </AppShell>
  );
}

