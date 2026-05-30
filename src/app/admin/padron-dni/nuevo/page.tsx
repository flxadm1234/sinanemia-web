import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth";
import { PadronDniExcelImportClient } from "@/components/PadronDniExcelImportClient";

export default async function PadronDniNuevoPage() {
  const user = await requireSession();
  if (user.tipo === "COORDINADOR" || user.tipo === "ACTOR SOCIAL") {
    return (
      <AppShell user={user} title="Carga DNI">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No tienes permisos para acceder a esta sección.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={user} title="Carga DNI">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">Nueva carga</div>
            <div className="mt-1 text-sm text-zinc-600">Adjunta los 3 archivos y selecciona la fecha de corte.</div>
          </div>
          <Link
            href="/admin/padron-dni"
            className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Volver
          </Link>
        </div>

        <PadronDniExcelImportClient />
      </div>
    </AppShell>
  );
}

