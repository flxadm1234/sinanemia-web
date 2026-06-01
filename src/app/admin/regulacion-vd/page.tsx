import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";
import { listActorVdCarga } from "@/lib/regulacionVd";
import { regularVdAction } from "./actions";
import { FormSubmitButton } from "@/components/FormSubmitButton";

function toInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

export default async function RegulacionVdPage(props: {
  searchParams: Promise<{
    ubigeo?: string;
    etapa?: string;
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
  const sp = await props.searchParams;

  const etapaSel =
    user.tipo === "ADMINISTRADOR"
      ? await getEtapaSeleccionadaPorUbigeo(user.ubigeo ?? "")
      : null;

  const ubigeoDefault = user.ubigeo ?? null;
  const etapaDefault = etapaSel?.etapa ?? "";

  const ubigeo =
    user.tipo === "SUPER ADMIN"
      ? sp.ubigeo && sp.ubigeo.trim()
        ? Number(sp.ubigeo)
        : null
      : ubigeoDefault;

  const etapa =
    sp.etapa && sp.etapa.trim()
      ? sp.etapa.trim()
      : etapaDefault
        ? etapaDefault
        : "";

  const rows = ubigeo && etapa ? await listActorVdCarga({ ubigeo, etapa }) : [];
  const over = rows.filter((r) => Number(r.total_nrovd ?? 0) > 60);

  const showOk = sp.ok === "1";
  const showErr = sp.err === "1";
  const errMsg = sp.msg ? String(sp.msg) : "";
  const affectedActors = toInt(sp.rows);
  const removedKids = toInt(sp.rows2);
  const removedVisits = toInt(sp.chg1);
  const notExact = toInt(sp.chg2);

  return (
    <AppShell user={user} title="Regulación VD">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-zinc-900">Regulación VD</div>
          <div className="mt-1 text-sm text-zinc-600">
            Ajusta asignaciones para que cada actor social no supere 60 visitas requeridas (suma de nrovd) en la etapa seleccionada.
          </div>
        </div>
        <Link
          href="/admin/padronnominal"
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
        >
          Volver
        </Link>
      </div>

      {showOk ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Regulación completada. Actores regulados: <span className="font-semibold">{affectedActors}</span> · Niños
          desasignados: <span className="font-semibold">{removedKids}</span> · Visitas removidas:{" "}
          <span className="font-semibold">{removedVisits}</span>
          {notExact ? (
            <>
              {" "}
              · Casos no exactos: <span className="font-semibold">{notExact}</span>
            </>
          ) : null}
        </div>
      ) : null}

      {showErr ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {errMsg || "No se pudo completar la regulación. Revisa la BD e inténtalo nuevamente."}
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl bg-white ring-1 ring-black/5 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:items-end">
          {user.tipo === "SUPER ADMIN" ? (
            <div>
              <label className="block text-sm font-medium text-zinc-900">Ubigeo</label>
              <input
                name="ubigeo"
                form="regulacionFilters"
                defaultValue={ubigeo ? String(ubigeo) : ""}
                placeholder="Ej: 160101"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
          ) : (
            <div className="text-sm text-zinc-700">
              Ubigeo: <span className="font-semibold">{ubigeoDefault ?? "-"}</span>
              <input type="hidden" name="ubigeo" form="regulacionFilters" value={ubigeoDefault ?? ""} />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-900">Etapa (YYYY-MM-01)</label>
            <input
              type="date"
              name="etapa"
              form="regulacionFilters"
              defaultValue={etapa}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-end gap-2">
            <form id="regulacionFilters" method="GET" className="flex items-center gap-2">
              <FormSubmitButton
                label="Ver resumen"
                className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
              />
            </form>

            <form action={regularVdAction} className="flex items-center">
              <input type="hidden" name="ubigeo" value={ubigeo ?? ""} />
              <input type="hidden" name="etapa" value={etapa} />
              <FormSubmitButton
                label="Aplicar regulación"
                disabled={!ubigeo || !etapa || !over.length}
                className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              />
            </form>
          </div>
        </div>

        {!ubigeo || !etapa ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Selecciona ubigeo y mes para ver el resumen.
          </div>
        ) : null}

        {ubigeo && etapa ? (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-zinc-900">
                Actores sociales (etapa {etapa})
              </div>
              <div className="text-sm text-zinc-600">
                Excedidos: <span className="font-semibold">{over.length}</span>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-zinc-200 text-xs text-zinc-600">
                      <th className="px-3 py-2">Actor social</th>
                      <th className="px-3 py-2">DNI</th>
                      <th className="px-3 py-2 text-right">Visitas (Σ nrovd)</th>
                      <th className="px-3 py-2 text-right">Niños</th>
                      <th className="px-3 py-2 text-right">Exceso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length ? (
                      rows.map((r) => {
                        const total = Number(r.total_nrovd ?? 0);
                        const exceso = total - 60;
                        const highlight = exceso > 0;
                        return (
                          <tr key={r.actorsocial} className={"border-b border-zinc-100 last:border-b-0 " + (highlight ? "bg-amber-50" : "")}>
                            <td className="px-3 py-2">
                              <div className="font-medium text-zinc-900">{r.nombre ?? "-"}</div>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-zinc-700">{r.actorsocial}</td>
                            <td className="px-3 py-2 text-right font-semibold text-zinc-900">{total}</td>
                            <td className="px-3 py-2 text-right text-zinc-700">{Number(r.ninos ?? 0)}</td>
                            <td className="px-3 py-2 text-right">
                              {exceso > 0 ? <span className="font-semibold text-amber-900">{exceso}</span> : <span className="text-zinc-500">0</span>}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-600">
                          No hay asignaciones para mostrar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-2 text-xs text-zinc-500">
              La regulación solo considera registros con tipovd=1, actorsocial no vacío y nrovd &gt; 0. Al desasignar, se ponen actorsocial y responsable en NULL.
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
