import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PadronExcelReportClient } from "@/components/PadronExcelReportClient";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { listMesesAll, listMesesByUbigeo } from "@/lib/meses";

export default async function ReportePadronPage() {
  const user = await requireAdminOrSuperAdmin();

  const meses =
    user.tipo === "SUPER ADMIN"
      ? await listMesesAll()
      : typeof user.ubigeo === "number"
        ? await listMesesByUbigeo(user.ubigeo)
        : [];

  const seen = new Set<string>();
  const opciones = meses
    .map((m) => {
      const mm = String(m.numero_mes).padStart(2, "0");
      const etapa = `${m.year}-${mm}-01`;
      const key = `${m.year}-${mm}`;
      return {
        key,
        etapa,
        label: `${m.meses} ${m.year}`,
        seleccion: Number(m.seleccion ?? 0) === 1,
      };
    })
    .filter((o) => {
      if (seen.has(o.key)) return false;
      seen.add(o.key);
      return true;
    });

  const defaultEtapas = opciones.filter((o) => o.seleccion).map((o) => o.etapa);

  return (
    <AppShell user={user} title="Reportes">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              Reporte Excel - Padrón nominal
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Descarga en Excel (.xls) con filtros por mes y tipo.
            </div>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Volver
          </Link>
        </div>

        <PadronExcelReportClient
          role={user.tipo}
          meses={opciones}
          defaultEtapas={defaultEtapas}
        />
      </div>
    </AppShell>
  );
}

