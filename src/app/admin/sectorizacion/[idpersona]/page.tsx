import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { findPersonaById } from "@/lib/persona";
import { findSectorizacionByDni } from "@/lib/sectorizacionActor";
import { AppShell } from "@/components/AppShell";
import { saveSectorizacionAction } from "../actions";

export default async function SectorizacionActorPage(props: {
  params: Promise<{ idpersona: string }>;
}) {
  const user = await requireAdminOrSuperAdmin();
  const { idpersona } = await props.params;
  const id = Number(idpersona);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const persona = await findPersonaById(id);
  if (!persona) notFound();

  const tipo = (persona.tipo ?? "").toUpperCase();
  if (!tipo.startsWith("ACTOR SOCIAL")) notFound();

  if (user.tipo === "ADMINISTRADOR") {
    if ((persona.ubigeo ?? null) !== (user.ubigeo ?? null)) notFound();
  }

  const sec = await findSectorizacionByDni(persona.dni);
  const nombre =
    `${persona.nombrecompleto ?? ""} ${persona.apellidos ?? ""}`.trim() ||
    persona.dni;

  return (
    <AppShell user={user} title="Sectorización">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">{nombre}</div>
            <div className="mt-1 text-sm text-zinc-600">
              DNI actor social: {persona.dni} · Ubigeo: {persona.ubigeo ?? "-"}
            </div>
          </div>
          <Link
            href="/admin/personas"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Volver
          </Link>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          <div className="text-sm font-semibold text-zinc-900">
            {sec ? "Editar sectorización" : "Registrar sectorización"}
          </div>
          <div className="mt-1 text-sm text-zinc-600">
            {sec
              ? "Existe un registro para este actor social."
              : "No existe registro, completa los datos para crearlo."}
          </div>

          <form
            action={saveSectorizacionAction}
            className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <input type="hidden" name="idpersona" value={String(persona.idpersona)} />

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Tipo de centro poblado
              </label>
              <input
                name="tipo_centro_poblado"
                defaultValue={sec?.tipo_centro_poblado ?? ""}
                placeholder="Ej: urbano / rural"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Centro poblado
              </label>
              <input
                name="centro_poblado"
                defaultValue={sec?.centro_poblado ?? ""}
                placeholder="Ej: NAUTA"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Zona
              </label>
              <input
                name="zona"
                defaultValue={sec?.zona ?? ""}
                placeholder="Ej: 3"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Mz
              </label>
              <input
                name="mz"
                defaultValue={sec?.mz ?? ""}
                placeholder="Ej: 26V"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-900">
                Sector
              </label>
              <input
                name="sector"
                defaultValue={sec?.sector ?? ""}
                placeholder="Ej: SECTOR 02"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

