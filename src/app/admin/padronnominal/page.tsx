import Link from "next/link";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";
import { ActorSocialCombobox } from "@/components/ActorSocialCombobox";
import { CoordinatorCombobox } from "@/components/CoordinatorCombobox";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { ActorCdrBulkChangeClient } from "@/components/ActorCdrBulkChangeClient";
import { ReaperturaMensualClient } from "@/components/ReaperturaMensualClient";
import { ReasignacionHisClient } from "@/components/ReasignacionHisClient";
import {
  bulkActorCdrAction,
  bulkActorSocialAction,
  bulkResponsableAction,
  reaperturaMensualAction,
  reasignacionHisAction,
  rectifyCoordinadorAction,
} from "./actions";

export default async function PadronNominalAdminPage(props: {
  searchParams: Promise<{
    tab?: string;
    ok?: string;
    rows?: string;
    rows2?: string;
    chg1?: string;
    chg2?: string;
    err?: string;
    msg?: string;
  }>;
}) {
  const user = await requireAdminOrSuperAdmin();
  const { tab, ok, rows, rows2, chg1, chg2, err, msg } = await props.searchParams;
  const activeTab =
    tab === "responsable"
      ? "responsable"
      : tab === "coordinador"
        ? "coordinador"
        : tab === "actores"
          ? "actores"
          : tab === "reapertura"
            ? "reapertura"
            : tab === "his"
              ? "his"
          : "actor";

  const etapaSel =
    user.tipo === "ADMINISTRADOR"
      ? await getEtapaSeleccionadaPorUbigeo(user.ubigeo ?? "")
      : null;

  const ubigeoDefault = user.ubigeo ?? null;
  const etapaDefault = etapaSel?.etapa ?? "";
  const showResult = ok === "1";
  const affected = rows && rows.trim() ? Number(rows) : 0;
  const affected2 = rows2 && rows2.trim() ? Number(rows2) : 0;
  const changed1 = chg1 && chg1.trim() ? Number(chg1) : 0;
  const changed2 = chg2 && chg2.trim() ? Number(chg2) : 0;
  const showError = err === "1";
  const errorMsg = msg ? String(msg) : "";

  return (
    <AppShell user={user} title="Configurar actor social y CVD">
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

        {showError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {errorMsg || "No se pudo completar la operación."}
          </div>
        ) : null}

        {showResult ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {activeTab === "actores" ? (
              <>
                Actualización completada. Actores encontrados:{" "}
                <span className="font-semibold">{Number.isFinite(affected) ? affected : 0}</span> · Padrón
                (mes actual) encontrado:{" "}
                <span className="font-semibold">{Number.isFinite(affected2) ? affected2 : 0}</span> · Cambios
                aplicados:{" "}
                <span className="font-semibold">{Number.isFinite(changed1) ? changed1 : 0}</span> actores /{" "}
                <span className="font-semibold">{Number.isFinite(changed2) ? changed2 : 0}</span> padrón
              </>
            ) : activeTab === "reapertura" ? (
              <>
                Reapertura completada. Niños (etapa) encontrados:{" "}
                <span className="font-semibold">{Number.isFinite(affected) ? affected : 0}</span> · Coincidencias
                por histórico:{" "}
                <span className="font-semibold">{Number.isFinite(affected2) ? affected2 : 0}</span> · Asignados a
                voluntarios:{" "}
                <span className="font-semibold">{Number.isFinite(changed1) ? changed1 : 0}</span> · Cambios
                aplicados:{" "}
                <span className="font-semibold">{Number.isFinite(changed2) ? changed2 : 0}</span>
              </>
            ) : activeTab === "his" ? (
              <>
                Reasignación por HIS completada. Niños (etapa) encontrados:{" "}
                <span className="font-semibold">{Number.isFinite(affected) ? affected : 0}</span> · Con HIS (último
                periodo):{" "}
                <span className="font-semibold">{Number.isFinite(affected2) ? affected2 : 0}</span> · DIRESA distinta:{" "}
                <span className="font-semibold">{Number.isFinite(changed1) ? changed1 : 0}</span> · Cambios aplicados:{" "}
                <span className="font-semibold">{Number.isFinite(changed2) ? changed2 : 0}</span>
              </>
            ) : (
              <>
                Actualización completada. Registros encontrados:{" "}
                <span className="font-semibold">{Number.isFinite(affected) ? affected : 0}</span>
                {activeTab === "responsable" ? (
                  <>
                    {" "}
                    · Personas encontradas (CDR):{" "}
                    <span className="font-semibold">{Number.isFinite(affected2) ? affected2 : 0}</span> ·
                    Cambios aplicados:{" "}
                    <span className="font-semibold">{Number.isFinite(changed1) ? changed1 : 0}</span> padrón /{" "}
                    <span className="font-semibold">{Number.isFinite(changed2) ? changed2 : 0}</span> persona
                  </>
                ) : activeTab === "actor" || activeTab === "coordinador" ? (
                  <>
                    {" "}
                    · Filas modificadas:{" "}
                    <span className="font-semibold">{Number.isFinite(affected2) ? affected2 : 0}</span>
                  </>
                ) : null}
              </>
            )}
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
          <Link
            href="/admin/padronnominal?tab=coordinador"
            className={
              "rounded-xl px-4 py-2 text-sm font-semibold " +
              (activeTab === "coordinador"
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50")
            }
          >
            Rectificar coordinador
          </Link>
          <Link
            href="/admin/padronnominal?tab=actores"
            className={
              "rounded-xl px-4 py-2 text-sm font-semibold " +
              (activeTab === "actores"
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50")
            }
          >
            Cambiar coordinador de actores
          </Link>
          <Link
            href="/admin/padronnominal?tab=reapertura"
            className={
              "rounded-xl px-4 py-2 text-sm font-semibold " +
              (activeTab === "reapertura"
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50")
            }
          >
            Reapertura mensual
          </Link>
          <Link
            href="/admin/padronnominal?tab=his"
            className={
              "rounded-xl px-4 py-2 text-sm font-semibold " +
              (activeTab === "his"
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50")
            }
          >
            Reasignación por HIS
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
                <FormSubmitButton
                  label="Aplicar cambio masivo"
                  pendingLabel="Aplicando..."
                  overlayLabel="Aplicando cambio masivo..."
                  className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                />
              </div>
            </form>
          </div>
        ) : activeTab === "reapertura" ? (
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
            <div className="text-sm font-semibold text-zinc-900">Reapertura Mensual</div>
            <div className="mt-1 text-sm text-zinc-600">
              Reutiliza asignaciones de meses previos para el mes seleccionado. Incluye asignación a voluntarios para
              casos “no encontrado / fallecido / otra ciudad / otro distrito”.
            </div>

            <ReaperturaMensualClient
              isSuperAdmin={user.tipo === "SUPER ADMIN"}
              ubigeoDefault={ubigeoDefault}
              etapaDefault={etapaDefault}
              action={reaperturaMensualAction}
            />
          </div>
        ) : activeTab === "his" ? (
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
            <div className="text-sm font-semibold text-zinc-900">Reasignación por HIS</div>
            <div className="mt-1 text-sm text-zinc-600">
              Reasigna a voluntarios cuando el último HIS (tabla atenciones) tenga DIRESA distinta a la indicada.
            </div>

            <ReasignacionHisClient
              isSuperAdmin={user.tipo === "SUPER ADMIN"}
              ubigeoDefault={ubigeoDefault}
              etapaDefault={etapaDefault}
              action={reasignacionHisAction}
            />
          </div>
        ) : activeTab === "responsable" ? (
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
            <div className="text-sm font-semibold text-zinc-900">
              Reemplazar responsable (coordinador)
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Actualiza <span className="font-semibold">padronnominal.responsable</span> (por etapa/ubigeo) y
              también <span className="font-semibold">persona.cdr</span> (por ubigeo) para mantener consistencia.
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
                <FormSubmitButton
                  label="Aplicar cambio masivo"
                  pendingLabel="Aplicando..."
                  overlayLabel="Aplicando cambio masivo..."
                  className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                />
              </div>
            </form>
          </div>
        ) : activeTab === "actores" ? (
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
            <div className="text-sm font-semibold text-zinc-900">Cambiar coordinador de actores sociales</div>
            <div className="mt-1 text-sm text-zinc-600">
              Actualiza <span className="font-semibold">persona.cdr</span> para los actores seleccionados y, en
              paralelo, actualiza <span className="font-semibold">padronnominal.responsable</span> del{" "}
              <span className="font-semibold">mes seleccionado</span> (según tabla meses) para esos actores.
            </div>
            <ActorCdrBulkChangeClient
              isSuperAdmin={user.tipo === "SUPER ADMIN"}
              ubigeoDefault={ubigeoDefault}
              action={bulkActorCdrAction}
            />
          </div>
        ) : (
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
            <div className="text-sm font-semibold text-zinc-900">Rectificar coordinador</div>
            <div className="mt-1 text-sm text-zinc-600">
              Actualiza <span className="font-semibold">padronnominal.responsable</span> tomando el{" "}
              <span className="font-semibold">cdr</span> de{" "}
              <span className="font-semibold">persona</span>, uniendo por{" "}
              <span className="font-semibold">actorsocial (dni)</span>.
            </div>

            <form action={rectifyCoordinadorAction} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-900">Ubigeo</label>
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
                <label className="block text-sm font-medium text-zinc-900">Etapa (YYYY-MM-01)</label>
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

              <div className="md:col-span-2 flex justify-end pt-2">
                <FormSubmitButton
                  label="Rectificar ahora"
                  pendingLabel="Rectificando..."
                  overlayLabel="Rectificando coordinador..."
                  className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                />
              </div>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  );
}

