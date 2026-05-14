import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { findPersonaByDni } from "@/lib/persona";
import { AppShell } from "@/components/AppShell";
import { updatePersonaAction } from "../actions";

export default async function AdminPersonaDetailPage(props: {
  params: Promise<{ dni: string }>;
}) {
  const user = await requireAdmin();
  const { dni } = await props.params;

  const persona = await findPersonaByDni(dni);
  if (!persona) notFound();

  const nombre =
    `${persona.nombrecompleto ?? ""} ${persona.apellidos ?? ""}`.trim() ||
    persona.dni;

  return (
    <AppShell user={user} title="Detalle de usuario">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">{nombre}</div>
            <div className="mt-1 text-sm text-zinc-600">DNI: {persona.dni}</div>
          </div>
          <Link
            href="/admin/personas"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Volver
          </Link>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          <div className="text-sm font-semibold text-zinc-900">Editar</div>
          <div className="mt-1 text-sm text-zinc-600">
            Guarda cambios sin alterar otras tablas del sistema
          </div>

          <form action={updatePersonaAction} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <input type="hidden" name="dni" value={persona.dni} />

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Nombres
              </label>
              <input
                name="nombrecompleto"
                defaultValue={persona.nombrecompleto ?? ""}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Apellidos
              </label>
              <input
                name="apellidos"
                defaultValue={persona.apellidos ?? ""}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Tipo
              </label>
              <select
                name="tipo"
                defaultValue={persona.tipo ?? ""}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="ACTOR SOCIAL">ACTOR SOCIAL</option>
                <option value="COORDINADOR">COORDINADOR</option>
                <option value="ADMINISTRADOR">ADMINISTRADOR</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                CDR (DNI coordinador)
              </label>
              <input
                name="cdr"
                defaultValue={persona.cdr ?? ""}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Ubigeo
              </label>
              <input
                name="ubigeo"
                defaultValue={persona.ubigeo ?? ""}
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Clave
              </label>
              <input
                name="clave"
                type="password"
                placeholder="Nueva clave (opcional)"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

