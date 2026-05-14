import Link from "next/link";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PersonaExcelImportClient } from "@/components/PersonaExcelImportClient";

export default async function ImportarPersonasPage() {
  const user = await requireAdminOrSuperAdmin();

  return (
    <AppShell user={user} title="Importar usuarios">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              Importar usuarios desde Excel
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Se importarán como ACTOR SOCIAL y estado activo.
            </div>
          </div>
          <Link
            href="/admin/personas"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Volver
          </Link>
        </div>

        <PersonaExcelImportClient role={user.tipo} />
      </div>
    </AppShell>
  );
}

