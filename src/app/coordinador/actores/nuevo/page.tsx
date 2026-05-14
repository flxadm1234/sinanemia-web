import Link from "next/link";
import { requireCoordinador } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PersonaCreateForm } from "@/components/PersonaCreateForm";
import { createActorAction } from "../actions";

export default async function CoordinadorNuevoActorPage() {
  const user = await requireCoordinador();

  return (
    <AppShell user={user} title="Nuevo actor social">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              Crear actor social
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Ubigeo: {user.ubigeo ?? "-"} · CDR: {user.dni}
            </div>
          </div>
          <Link
            href="/coordinador/actores"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Cancelar
          </Link>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          <PersonaCreateForm
            action={createActorAction}
            role="COORDINADOR"
            ubigeo={user.ubigeo ?? null}
            cdrDefault={user.dni}
          />
        </div>
      </div>
    </AppShell>
  );
}

