import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { MesesExcelImportClient } from "@/components/MesesExcelImportClient";

export default async function ImportarMesesPage() {
  const user = await requireSuperAdmin();

  return (
    <AppShell user={user} title="Importar meses">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              Importar meses desde Excel
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Solo disponible para SUPER ADMIN.
            </div>
          </div>
          <Link
            href="/admin/meses"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Volver
          </Link>
        </div>

        <MesesExcelImportClient />
      </div>
    </AppShell>
  );
}

