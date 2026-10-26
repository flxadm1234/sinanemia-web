import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth";
import { ConsultaTamizajeClient } from "@/components/ConsultaTamizajeClient";

export default async function Page() {
  const user = await requireSession();
  if (
    user.tipo !== "ADMINISTRADOR" &&
    user.tipo !== "COORDINADOR" &&
    user.tipo !== "SUPER ADMIN" &&
    user.tipo !== "SUPERVISOR"
  ) {
    return null;
  }

  return (
    <AppShell user={user} title="Consulta de tamizaje">
      <ConsultaTamizajeClient />
    </AppShell>
  );
}

