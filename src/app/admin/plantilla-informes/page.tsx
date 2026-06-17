import { AppShell } from "@/components/AppShell";
import { InformeDestinatariosClient } from "@/components/InformeDestinatariosClient";
import { PlantillaInformesClient } from "@/components/PlantillaInformesClient";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { ensureInformeConfiguracionTable } from "@/lib/informeConfiguracion";
import { ensureInformeDestinatariosTable } from "@/lib/informeDestinatarios";
import { listMesesUbigeoOptions } from "@/lib/meses";

export default async function PlantillaInformesPage() {
  const user = await requireAdminOrSuperAdmin();
  await ensureInformeConfiguracionTable();
  await ensureInformeDestinatariosTable();
  const ubigeos = user.tipo === "SUPER ADMIN" ? await listMesesUbigeoOptions() : [];

  return (
    <AppShell user={user} title="Plantilla de informes">
      <div className="flex flex-col gap-4">
        <PlantillaInformesClient role={user.tipo} sessionUbigeo={user.ubigeo} ubigeos={ubigeos} />
        <InformeDestinatariosClient role={user.tipo} sessionUbigeo={user.ubigeo} ubigeos={ubigeos} />
      </div>
    </AppShell>
  );
}
