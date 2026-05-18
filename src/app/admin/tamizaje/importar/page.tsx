import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { TamizajeExcelImportClient } from "@/components/TamizajeExcelImportClient";

export default async function TamizajeImportPage() {
  const user = await requireAdminOrSuperAdmin();

  return (
    <AppShell user={user} title="Tamizaje">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              Carga masiva - Registro de tamizaje
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Importa un Excel (HIS MINSA). La carga corre en segundo plano y reemplaza la
              data anterior.
            </div>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Volver
          </Link>
        </div>

        <TamizajeExcelImportClient />
      </div>
    </AppShell>
  );
}

