import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default async function ActorHomePage() {
  const user = await requireSession();

  return (
    <AppShell user={user} title="Inicio">
      <div className="rounded-2xl bg-white ring-1 ring-black/5 p-6">
        <div className="text-lg font-semibold text-zinc-900">
          Panel del actor social
        </div>
        <div className="mt-2 text-sm text-zinc-600">
          Aquí irá el registro de visitas domiciliarias (Compromiso 1), carga de Excel
          y seguimiento de condiciones.
        </div>
      </div>
    </AppShell>
  );
}

