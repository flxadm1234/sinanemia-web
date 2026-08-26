import { AppShell } from "@/components/AppShell";
import { CarnetsRegistroClient } from "@/components/CarnetsRegistroClient";
import { requireAdminOrCoordinador } from "@/lib/auth";
import { ensurePadronHasCarnetFields, ensureRegistrosHemoglobinaTable } from "@/lib/carnets";

export default async function CarnetsPage() {
  const user = await requireAdminOrCoordinador();
  await ensurePadronHasCarnetFields();
  await ensureRegistrosHemoglobinaTable();

  return (
    <AppShell user={user} title="Registro de carnets">
      <CarnetsRegistroClient />
    </AppShell>
  );
}

