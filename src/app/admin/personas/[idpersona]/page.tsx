import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { findPersonaById, getRoleFromPersonaTipo } from "@/lib/persona";
import { AppShell } from "@/components/AppShell";
import { updatePersonaAction } from "../actions";
import { CoordinatorCombobox } from "@/components/CoordinatorCombobox";
import { FormSubmitButton } from "@/components/FormSubmitButton";

export default async function AdminPersonaDetailPage(props: {
  params: Promise<{ idpersona: string }>;
}) {
  const user = await requireAdminOrSuperAdmin();
  const { idpersona } = await props.params;
  const id = Number(idpersona);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const persona = await findPersonaById(id);
  if (!persona) notFound();

  if (user.tipo === "ADMINISTRADOR") {
    if ((persona.ubigeo ?? null) !== (user.ubigeo ?? null)) notFound();
  }

  const nombre =
    `${persona.nombrecompleto ?? ""} ${persona.apellidos ?? ""}`.trim() ||
    persona.dni;

  const role = getRoleFromPersonaTipo(persona.tipo);
  const allowUbigeo = user.tipo === "SUPER ADMIN";
  const allowCdr = user.tipo === "ADMINISTRADOR" || user.tipo === "SUPER ADMIN";
  const allowVoluntario = allowCdr && role === "ACTOR SOCIAL";

  return (
    <AppShell user={user} title="Detalle de usuario">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">{nombre}</div>
            <div className="mt-1 text-sm text-zinc-600">
              ID: {persona.idpersona} · DNI: {persona.dni} · Tipo:{" "}
              {persona.tipo ?? "-"}
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
          <div className="text-sm font-semibold text-zinc-900">Editar</div>
          <div className="mt-1 text-sm text-zinc-600">
            El tipo no se puede modificar.{" "}
            {role === "ACTOR SOCIAL"
              ? "Puedes ajustar datos y coordinador según permisos."
              : "Puedes ajustar datos según permisos."}
          </div>

          <form
            action={updatePersonaAction}
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
                Ubigeo
              </label>
              {allowUbigeo ? (
                <input
                  name="ubigeo"
                  defaultValue={persona.ubigeo ?? ""}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              ) : (
                <>
                  <input
                    type="hidden"
                    name="ubigeo"
                    value={persona.ubigeo ?? ""}
                  />
                  <div className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700">
                    {persona.ubigeo ?? "-"}
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-900">
                Coordinador (CDR)
              </label>
              {allowCdr ? (
                <div className="mt-1">
                  <CoordinatorCombobox
                    name="cdr"
                    defaultValue={persona.cdr ?? ""}
                    ubigeo={user.tipo === "ADMINISTRADOR" ? user.ubigeo ?? null : persona.ubigeo ?? null}
                  />
                </div>
              ) : (
                <>
                  <input type="hidden" name="cdr" value={persona.cdr ?? ""} />
                  <div className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700">
                    {persona.cdr ?? "-"}
                  </div>
                </>
              )}
            </div>

            {allowVoluntario ? (
              <div>
                <label className="block text-sm font-medium text-zinc-900">Voluntario</label>
                <select
                  name="voluntario"
                  defaultValue={String((persona as any).voluntario ?? 0)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="0">No</option>
                  <option value="1">Sí</option>
                </select>
                <div className="mt-1 text-xs text-zinc-500">
                  Se usa para asignación automática en la Reapertura mensual.
                </div>
              </div>
            ) : (
              <input type="hidden" name="voluntario" value={String((persona as any).voluntario ?? 0)} />
            )}

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
              <FormSubmitButton
                label="Guardar cambios"
                pendingLabel="Guardando..."
                className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              />
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

