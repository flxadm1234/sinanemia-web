import { AppShell } from "@/components/AppShell";
import { ArchivosManagerClient } from "@/components/ArchivosManagerClient";
import { requireSuperAdmin } from "@/lib/auth";
import { ensureArchivosTables } from "@/lib/archivos";

export default async function ArchivosPage() {
  const user = await requireSuperAdmin();
  await ensureArchivosTables();

  return (
    <AppShell user={user} title="Archivos">
      <ArchivosManagerClient />
    </AppShell>
  );
}

