import Link from "next/link";
import { requireMesesAccess } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { MesForm } from "@/components/MesForm";
import { createMesAction } from "../actions";

export default async function AdminMesNuevoPage() {
  const user = await requireMesesAccess();
  if (user.tipo === "COORDINADOR") {
    return (
      <AppShell user={user} title="Nuevo mes">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No tienes permisos para crear meses.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={user} title="Nuevo mes">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              Crear mes
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Se guardará en la tabla meses
            </div>
          </div>
          <Link
            href="/admin/meses"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Cancelar
          </Link>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          <MesForm
            action={createMesAction}
            allowUbigeo={user.tipo === "SUPER ADMIN" || user.tipo === "SUPERVISOR"}
            defaultUbigeo={
              user.tipo === "SUPER ADMIN" || user.tipo === "SUPERVISOR"
                ? ""
                : String(user.ubigeo ?? "")
            }
            allowSelect={user.tipo === "ADMINISTRADOR" || user.tipo === "SUPER ADMIN"}
          />
        </div>
      </div>
    </AppShell>
  );
}

