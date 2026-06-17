import { AppShell } from "@/components/AppShell";
import { PlantillaInformesClient } from "@/components/PlantillaInformesClient";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { ensureInformeConfiguracionTable } from "@/lib/informeConfiguracion";
import { listMesesUbigeoOptions } from "@/lib/meses";

export default async function PlantillaInformesPage() {
  const user = await requireAdminOrSuperAdmin();
  await ensureInformeConfiguracionTable();
  const ubigeos = user.tipo === "SUPER ADMIN" ? await listMesesUbigeoOptions() : [];

  return (
    <AppShell user={user} title="Plantilla de informes">
      <PlantillaInformesClient role={user.tipo} sessionUbigeo={user.ubigeo} ubigeos={ubigeos} />
    </AppShell>
  );
}

