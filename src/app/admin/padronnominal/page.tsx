import Link from "next/link";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";
import { ActorSocialCombobox } from "@/components/ActorSocialCombobox";
import { CoordinatorCombobox } from "@/components/CoordinatorCombobox";
import { bulkActorSocialAction, bulkResponsableAction } from "./actions";

export default async function PadronNominalAdminPage(props: {
  searchParams: Promise<{ tab?: string; ok?: string; rows?: string }>;
}) {
  const user = await requireAdminOrSuperAdmin();
  const { tab, ok, rows } = await props.searchParams;
  const activeTab = tab === "responsable" ? "responsable" : "actor";

  const etapaSel =
    user.tipo === "ADMINISTRADOR"
      ? await getEtapaSeleccionadaPorUbigeo(user.ubigeo ?? "")
      : null;

  const ubigeoDefault = user.ubigeo ?? null;
  const etapaDefault = etapaSel?.etapa ?? "";
  const showResult = ok === "1";
  const affected = rows && rows.trim() ? Number(rows) : 0;

  return (
    <AppShell user={user} title="Padrón nominal">
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              Reasignación masiva
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Cambia asignaciones por etapa y ubigeo sin editar registro por
              registro.
            </div>
          </div>
          <Link
            href="/admin/personas"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Volver
          </Link>
        </div>

        {showResult ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Actualización completada. Registros afectados:{" "}
            <span className="font-semibold">{Number.isFinite(affected) ? affected : 0}</span>
          </div>
        ) : null}

        <div className="flex gap-2">
          <Link
            href="/admin/padronnominal?tab=actor"
            className={
              "rounded-xl px-4 py-2 text-sm font-semibold " +
              (activeTab === "actor"
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50")
            }
          >
            Cambiar actor social
          </Link>
          <Link
            href="/admin/padronnominal?tab=responsable"
            className={
              "rounded-xl px-4 py-2 text-sm font-semibold " +
              (activeTab === "responsable"
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50")
            }
          >
            Cambiar responsable
          </Link>
        </div>

        {activeTab === "actor" ? (
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
            <div className="text-sm font-semibold text-zinc-900">
              Reemplazar actor social
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Se actualiza el campo <span className="font-semibold">actorsocial</span> en{" "}
              <span className="font-semibold">padronnominal</span>.
            </div>

            <form action={bulkActorSocialAction} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-900">
                  Ubigeo
                </label>
                {user.tipo === "SUPER ADMIN" ? (
                  <input
                    name="ubigeo"
                    inputMode="numeric"
                    placeholder="Ej: 160101"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                ) : (
                  <>
                    <input type="hidden" name="ubigeo" value={ubigeoDefault ?? ""} />
                    <div className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700">
                      {ubigeoDefault ?? "-"}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-900">
                  Etapa (YYYY-MM-01)
                </label>
                {user.tipo === "SUPER ADMIN" ? (
                  <input
                    name="etapa"
                    placeholder="Ej: 2026-05-01"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                ) : (
                  <>
                    <input type="hidden" name="etapa" value={etapaDefault} />
                    <div className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700">
                      {etapaDefault || "-"}
                    </div>
                  </>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-900">
                  Actor social actual
                </label>
                <div className="mt-1">
                  <ActorSocialCombobox
                    name="actorAnterior"
                    ubigeo={user.tipo === "ADMINISTRADOR" ? ubigeoDefault : null}
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-900">
                  Actor social nuevo
                </label>
                <div className="mt-1">
                  <ActorSocialCombobox
                    name="actorNuevo"
                    ubigeo={user.tipo === "ADMINISTRADOR" ? ubigeoDefault : null}
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end pt-2">
                <button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                  Aplicar cambio masivo
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
            <div className="text-sm font-semibold text-zinc-900">
              Reemplazar responsable (coordinador)
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Se actualiza el campo <span className="font-semibold">responsable</span> en{" "}
              <span className="font-semibold">padronnominal</span>.
            </div>

            <form action={bulkResponsableAction} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-900">
                  Ubigeo
                </label>
                {user.tipo === "SUPER ADMIN" ? (
                  <input
                    name="ubigeo"
                    inputMode="numeric"
                    placeholder="Ej: 160101"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                ) : (
                  <>
                    <input type="hidden" name="ubigeo" value={ubigeoDefault ?? ""} />
                    <div className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700">
                      {ubigeoDefault ?? "-"}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-900">
                  Etapa (YYYY-MM-01)
                </label>
                {user.tipo === "SUPER ADMIN" ? (
                  <input
                    name="etapa"
                    placeholder="Ej: 2026-05-01"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                ) : (
                  <>
                    <input type="hidden" name="etapa" value={etapaDefault} />
                    <div className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700">
                      {etapaDefault || "-"}
                    </div>
                  </>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-900">
                  Responsable actual
                </label>
                <div className="mt-1">
                  <CoordinatorCombobox
                    name="responsableAnterior"
                    ubigeo={user.tipo === "ADMINISTRADOR" ? ubigeoDefault : null}
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-900">
                  Responsable nuevo
                </label>
                <div className="mt-1">
                  <CoordinatorCombobox
                    name="responsableNuevo"
                    ubigeo={user.tipo === "ADMINISTRADOR" ? ubigeoDefault : null}
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end pt-2">
                <button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                  Aplicar cambio masivo
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  );
}

