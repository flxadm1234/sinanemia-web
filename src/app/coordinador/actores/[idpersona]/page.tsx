import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoordinador } from "@/lib/auth";
import { findPersonaById } from "@/lib/persona";
import { AppShell } from "@/components/AppShell";
import { updateActorAction } from "../actions";

export default async function CoordinadorActorDetailPage(props: {
  params: Promise<{ idpersona: string }>;
}) {
  const user = await requireCoordinador();
  const { idpersona } = await props.params;
  const id = Number(idpersona);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const persona = await findPersonaById(id);
  if (!persona) notFound();

  const tipo = (persona.tipo ?? "").toUpperCase();
  if (!tipo.startsWith("ACTOR SOCIAL")) notFound();
  if ((persona.cdr ?? "") !== user.dni) notFound();

  const nombre =
    `${persona.nombrecompleto ?? ""} ${persona.apellidos ?? ""}`.trim() ||
    persona.dni;

  return (
    <AppShell user={user} title="Editar actor social">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">{nombre}</div>
            <div className="mt-1 text-sm text-zinc-600">
              ID: {persona.idpersona} · DNI: {persona.dni}
            </div>
          </div>
          <Link
            href="/coordinador/actores"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Volver
          </Link>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          <div className="text-sm font-semibold text-zinc-900">Datos</div>
          <div className="mt-1 text-sm text-zinc-600">
            Puedes modificar nombre, apellidos, clave, teléfono, email y dirección.
          </div>

          <form
            action={updateActorAction}
            className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <input type="hidden" name="idpersona" value={String(persona.idpersona)} />

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
                Teléfono
              </label>
              <input
                name="telefono"
                defaultValue={(persona as any).telefono ?? ""}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Email
              </label>
              <input
                name="email"
                type="email"
                defaultValue={(persona as any).email ?? ""}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-900">
                Dirección
              </label>
              <input
                name="direccion"
                defaultValue={(persona as any).direccion ?? ""}
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

