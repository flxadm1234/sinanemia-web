import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth";
import { ensureVisitasTables } from "@/lib/visitasImport";
import { VisitasExcelImportClient } from "@/components/VisitasExcelImportClient";

export default async function VisitasPage() {
  const user = await requireSession();
  await ensureVisitasTables();

  const canEditConfig = user.tipo === "ADMINISTRADOR" || user.tipo === "SUPER ADMIN";

  return (
    <AppShell user={user} title="Carga Visitas">
      <VisitasExcelImportClient canEditConfig={canEditConfig} />
    </AppShell>
  );
}

