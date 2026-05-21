import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth";
import { ensureVisitasTables, getDefaultVisitasConfigId, listVisitasConfigs } from "@/lib/visitasImport";
import { VisitasExcelImportClient } from "@/components/VisitasExcelImportClient";

export default async function VisitasPage() {
  const user = await requireSession();
  await ensureVisitasTables();

  const canEditConfig = user.tipo === "SUPER ADMIN";
  const configs = await listVisitasConfigs();
  const defaultConfigId = await getDefaultVisitasConfigId();

  return (
    <AppShell user={user} title="Carga Reporte de actividades">
      <VisitasExcelImportClient
        canEditConfig={canEditConfig}
        configs={configs}
        defaultConfigId={defaultConfigId}
      />
    </AppShell>
  );
}

