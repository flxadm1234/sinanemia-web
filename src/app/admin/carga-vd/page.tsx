import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth";
import { ensurePadronVdTables } from "@/lib/padronVdImport";
import { PadronVdExcelImportClient } from "@/components/PadronVdExcelImportClient";

export default async function CargaVdPage() {
  const user = await requireSession();
  if (
    user.tipo !== "ADMINISTRADOR" &&
    user.tipo !== "SUPER ADMIN" &&
    user.tipo !== "INVITADO" &&
    user.tipo !== "SUPERVISOR"
  ) {
    return (
      <AppShell user={user} title="Padrón de niños">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No tienes permisos para acceder a esta sección.
        </div>
      </AppShell>
    );
  }

  await ensurePadronVdTables();

  return (
    <AppShell user={user} title="Padrón de niños">
      <PadronVdExcelImportClient
        canEditConfig={user.tipo === "ADMINISTRADOR" || user.tipo === "SUPER ADMIN"}
      />
    </AppShell>
  );
}

