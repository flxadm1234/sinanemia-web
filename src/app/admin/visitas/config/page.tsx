import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import {
  ensureVisitasTables,
  getDefaultVisitasConfigId,
  getVisitasConfig,
  listVisitasConfigs,
} from "@/lib/visitasImport";
import { VisitasConfigFormClient } from "@/components/VisitasConfigFormClient";
import { updateVisitasConfigAction } from "./actions";

export default async function VisitasConfigPage(props: { searchParams?: Promise<any> }) {
  const user = await requireSuperAdmin();
  await ensureVisitasTables();
  const configs = await listVisitasConfigs();
  const sp = (await props.searchParams) ?? {};
  const idRaw = String(sp?.id ?? "").trim();
  const parsedId = idRaw ? Number(idRaw) : NaN;
  const selectedId =
    Number.isFinite(parsedId) && parsedId > 0
      ? Math.trunc(parsedId)
      : await getDefaultVisitasConfigId();
  const cfg =
    (await getVisitasConfig(selectedId)) ?? (await getVisitasConfig(await getDefaultVisitasConfigId()));
  if (!cfg) throw new Error("No existe configuración de columnas registrada.");

  const uiCfg = {
    ...cfg,
    name: cfg.name,
    col_ubigeo: cfg.col_ubigeo + 1,
    col_dni_nino: cfg.col_dni_nino + 1,
    col_fecha_intervencion: cfg.col_fecha_intervencion + 1,
    col_etapa_text: cfg.col_etapa_text == null ? "" : cfg.col_etapa_text + 1,
    col_visitas_completas: cfg.col_visitas_completas == null ? "" : cfg.col_visitas_completas + 1,
    col_dispositivo: cfg.col_dispositivo == null ? "" : cfg.col_dispositivo + 1,
    col_estado_intervencion:
      cfg.col_estado_intervencion == null ? "" : cfg.col_estado_intervencion + 1,
    col_latitud: cfg.col_latitud == null ? "" : cfg.col_latitud + 1,
    col_longitud: cfg.col_longitud == null ? "" : cfg.col_longitud + 1,
  };

  return (
    <AppShell user={user} title="Configurar columnas (Reporte de actividades)">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">Configurar columnas</div>
            <div className="mt-1 text-sm text-zinc-600">
              Ajusta columnas cuando cambie la plantilla del Excel.
            </div>
          </div>
          <Link
            href="/admin/visitas"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Volver
          </Link>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          <VisitasConfigFormClient
            cfgId={cfg.id}
            cfg={uiCfg}
            configs={configs}
            action={updateVisitasConfigAction}
          />
        </div>
      </div>
    </AppShell>
  );
}

