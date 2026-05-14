import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { createPersonaAction } from "../actions";

export default async function AdminPersonaNewPage() {
  const user = await requireAdmin();

  return (
    <AppShell user={user} title="Nuevo usuario">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              Crear usuario
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Se guardará en la tabla persona
            </div>
          </div>
          <Link
            href="/admin/personas"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Cancelar
          </Link>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          <form
            action={createPersonaAction}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <div>
              <label className="block text-sm font-medium text-zinc-900">
                DNI
              </label>
              <input
                name="dni"
                required
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Tipo
              </label>
              <select
                name="tipo"
                defaultValue="ACTOR SOCIAL"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="ACTOR SOCIAL">ACTOR SOCIAL</option>
                <option value="COORDINADOR">COORDINADOR</option>
                <option value="ADMINISTRADOR">ADMINISTRADOR</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Nombres
              </label>
              <input
                name="nombrecompleto"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Apellidos
              </label>
              <input
                name="apellidos"
                required
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
                required
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Ubigeo
              </label>
              <input
                name="ubigeo"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                CDR (DNI coordinador)
              </label>
              <input
                name="cdr"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Teléfono
              </label>
              <input
                name="telefono"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-900">
                Dirección
              </label>
              <input
                name="direccion"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-900">
                Email
              </label>
              <input
                name="email"
                type="email"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                Crear
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

