import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import {
  countActoresSocialesActivos,
  countAsignados,
  countCargados,
  estadosvdDistribucion,
  getLatestDashboardMonthAny,
  listDashboardMonthsByUbigeo,
  listDistinctUbigeosFromMeses,
  resumenPorDepartamento,
  resumenPorDistrito,
  resumenPorProvincia,
  timelineTotales,
  countCoordinadoresActivos,
  type DashboardMonth,
} from "@/lib/dashboard";
import { DashboardLineChart } from "@/components/DashboardLineChart";
import { computeNcMetricsForEtapa } from "@/lib/ncReporte";
import { NcLineChart } from "@/components/NcLineChart";

function parseSearch(params: Record<string, string | undefined>) {
  const ubigeo = String(params.ubigeo ?? "").trim();
  const ym = String(params.ym ?? "").trim();
  const [yStr, mStr] = ym.split("-");
  const year = Number(yStr ?? "");
  const numero_mes = Number(mStr ?? "");
  return {
    ubigeo: ubigeo || "",
    year: Number.isFinite(year) ? year : NaN,
    numero_mes: Number.isFinite(numero_mes) ? numero_mes : NaN,
  };
}

function findSelectedMonth(months: DashboardMonth[], year: number, numero_mes: number) {
  if (!Number.isFinite(year) || !Number.isFinite(numero_mes)) return null;
  return months.find((m) => m.year === year && m.numero_mes === numero_mes) ?? null;
}

function pickDefaultMonth(months: DashboardMonth[]) {
  const sel = months.find((m) => Number(m.seleccion ?? 0) === 1);
  return sel ?? months[0] ?? null;
}

export default async function DashboardPage(props: {
  searchParams: Promise<{ ubigeo?: string; ym?: string }>;
}) {
  const user = await requireSession();
  const sp = parseSearch(await props.searchParams);

  const role = user.tipo;

  let scopeUbigeo = "";
  if (role === "ADMINISTRADOR" || role === "COORDINADOR" || role === "ACTOR SOCIAL") {
    scopeUbigeo = String(user.ubigeo ?? "");
  } else if (role === "SUPER ADMIN") {
    scopeUbigeo = sp.ubigeo;
  }

  const ubigeos = role === "SUPER ADMIN" ? await listDistinctUbigeosFromMeses() : [];

  let months: DashboardMonth[] = [];
  if (scopeUbigeo) {
    months = await listDashboardMonthsByUbigeo(scopeUbigeo, 12);
  } else if (role === "SUPER ADMIN") {
    const latest = await getLatestDashboardMonthAny();
    if (latest) {
      scopeUbigeo = latest.ubigeo;
      months = await listDashboardMonthsByUbigeo(scopeUbigeo, 12);
    }
  }

  let selectedMonth: DashboardMonth | null = null;
  if (months.length) {
    selectedMonth = findSelectedMonth(months, sp.year, sp.numero_mes) ?? pickDefaultMonth(months);
  }

  if (!selectedMonth) {
    return (
      <AppShell user={user} title="Dashboard">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No hay meses disponibles para mostrar el dashboard.
        </div>
      </AppShell>
    );
  }

  const etapa = selectedMonth.etapa;

  const scopeFilters = (() => {
    if (role === "COORDINADOR") return { ubigeo: scopeUbigeo, responsable: user.dni };
    if (role === "ACTOR SOCIAL") return { ubigeo: scopeUbigeo, actor: user.dni };
    if (role === "ADMINISTRADOR") return { ubigeo: scopeUbigeo };
    if (role === "SUPER ADMIN") return scopeUbigeo ? { ubigeo: scopeUbigeo } : {};
    return {};
  })();

  const cargadosActual = await countCargados({ etapa, ...scopeFilters });
  const asignadosActual = await countAsignados({ etapa, ...scopeFilters });
  const sinAsignarActual = Math.max(0, cargadosActual - asignadosActual);

  const timeline = await timelineTotales({ months: months.slice(0, 8), ...scopeFilters });

  const estados = await estadosvdDistribucion({ etapa, ...scopeFilters, limit: 12 });

  const showGeo = role === "SUPER ADMIN";
  const dept = showGeo ? await resumenPorDepartamento({ etapa, limit: 50 }) : [];
  const prov = showGeo ? await resumenPorProvincia({ etapa, limit: 80 }) : [];
  const dist = showGeo ? await resumenPorDistrito({ etapa, limit: 80 }) : [];

  const ubigeoForCounts = scopeUbigeo ? scopeUbigeo : undefined;
  const actoresActivos =
    role === "COORDINADOR"
      ? await countActoresSocialesActivos({ ubigeo: ubigeoForCounts, cdr: user.dni })
      : await countActoresSocialesActivos({ ubigeo: ubigeoForCounts });
  const coordinadoresActivos = await countCoordinadoresActivos({ ubigeo: ubigeoForCounts });

  const ncEnabled = role === "ADMINISTRADOR" || role === "SUPER ADMIN";
  const ncUbigeo = Number(scopeUbigeo);
  const ncOkUbigeo = ncEnabled && Number.isFinite(ncUbigeo) && ncUbigeo > 0;
  const ncMonthsSource = months.filter((m) => m.year === selectedMonth.year && m.year >= 2026);
  const selectedIdx = ncMonthsSource.findIndex(
    (m) => m.year === selectedMonth.year && m.numero_mes === selectedMonth.numero_mes,
  );
  const ncMonthsWindow =
    ncOkUbigeo && selectedIdx >= 0
      ? ncMonthsSource.slice(selectedIdx, selectedIdx + 6)
      : [];

  const ncSeries = [];
  let ncSelected: Awaited<ReturnType<typeof computeNcMetricsForEtapa>> | null = null;
  if (ncOkUbigeo && ncMonthsWindow.length) {
    for (const m of ncMonthsWindow) {
      const isSelected = m.etapa === selectedMonth.etapa;
      const metrics = await computeNcMetricsForEtapa({
        ubigeo: ncUbigeo,
        etapa: m.etapa,
        includeDetails: isSelected,
      });
      if (!metrics) continue;
      if (isSelected) ncSelected = metrics;
      ncSeries.push(metrics);
    }
  }

  return (
    <AppShell user={user} title="Dashboard">
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          <div className="text-lg font-semibold text-zinc-900">Resumen</div>
          <div className="mt-1 text-sm text-zinc-600">
            Periodo: <span className="font-semibold">{selectedMonth.meses}</span>{" "}
            <span className="font-semibold">{selectedMonth.year}</span> · Etapa{" "}
            <span className="font-semibold">{selectedMonth.etapa}</span>
            {scopeUbigeo ? (
              <>
                {" "}
                · Ubigeo <span className="font-semibold">{scopeUbigeo}</span>
              </>
            ) : null}
          </div>

          <form className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
            {role === "SUPER ADMIN" ? (
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-900">
                  Ubigeo
                </label>
                <select
                  name="ubigeo"
                  defaultValue={scopeUbigeo}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  {ubigeos.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-900">
                Mes
              </label>
              <select
                name="ym"
                defaultValue={`${selectedMonth.year}-${selectedMonth.numero_mes}`}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                {months.map((m) => (
                  <option key={`${m.year}-${m.numero_mes}`} value={`${m.year}-${m.numero_mes}`}>
                    {m.meses} {m.year} (N° {m.numero_mes})
                  </option>
                ))}
              </select>
            </div>
            <button className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800">
              Ver
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-5 lg:col-span-2">
            <div className="text-sm font-semibold opacity-90">Niños cargados (periodo)</div>
            <div className="mt-2 text-3xl font-semibold">{cargadosActual}</div>
            <div className="mt-2 text-xs opacity-90">Registros tipovd=1 en la etapa.</div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-5 lg:col-span-2">
            <div className="text-sm font-semibold opacity-90">Niños asignados (periodo)</div>
            <div className="mt-2 text-3xl font-semibold">{asignadosActual}</div>
            <div className="mt-2 text-xs opacity-90">Registros con actor social asignado.</div>
          </div>
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5 lg:col-span-2">
            <div className="text-sm font-semibold text-zinc-900">Sin asignar (periodo)</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-900">{sinAsignarActual}</div>
            <div className="mt-2 text-xs text-zinc-500">Cargados menos asignados.</div>
          </div>
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5 lg:col-span-3">
            <div className="text-sm font-semibold text-zinc-900">Voluntarios (actores sociales) activos</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-900">{actoresActivos}</div>
            <div className="mt-2 text-xs text-zinc-500">
              {role === "COORDINADOR" ? "Filtrado por tu CDR." : "Filtrado por ubigeo."}
            </div>
          </div>
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5 lg:col-span-3">
            <div className="text-sm font-semibold text-zinc-900">No voluntarios (coordinadores) activos</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-900">{coordinadoresActivos}</div>
            <div className="mt-2 text-xs text-zinc-500">Filtrado por ubigeo.</div>
          </div>
        </div>

        <DashboardLineChart
          points={timeline.map((t) => ({ label: t.label, total: t.total, assigned: t.assigned }))}
        />

        {ncEnabled ? (
          ncOkUbigeo && ncSeries.length && ncSelected ? (
            <>
              <NcLineChart
                target={Number((selectedMonth as any).valla_min ?? 60)}
                points={ncSeries
                  .slice()
                  .reverse()
                  .map((m) => ({ label: m.label, denom: m.denom_total, numer: m.num_total }))}
              />
              <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Detalle del mes seleccionado (NC)
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Etapa: <span className="font-semibold">{ncSelected.etapa}</span>
                    </div>
                  </div>
                  <div className="text-sm text-zinc-700">
                    <a
                      className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      href={`/api/reportes/nc-excel?ubigeo=${encodeURIComponent(scopeUbigeo)}&etapa=${encodeURIComponent(
                        ncSelected.etapa,
                      )}`}
                    >
                      Descargar Excel
                    </a>
                    <span className="ml-3">
                      NC: <span className="font-semibold">{ncSelected.denom_total}</span> · N:{" "}
                      <span className="font-semibold">{ncSelected.num_total}</span>
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
                  <div className="rounded-2xl bg-zinc-50 ring-1 ring-black/5 p-4">
                    <div className="text-xs text-zinc-600">Niños cargados (padron)</div>
                    <div className="mt-1 text-2xl font-semibold text-zinc-900">
                      {ncSelected.total_cargados}
                    </div>
                    <div className="mt-2 text-xs text-zinc-600">
                      Asignados: <span className="font-semibold">{ncSelected.total_asignados}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 ring-1 ring-black/5 p-4">
                    <div className="text-xs text-zinc-600">Pasan filtros (denominador)</div>
                    <div className="mt-2 text-xs text-zinc-700">
                      Edad crítica:{" "}
                      <span className="font-semibold">{ncSelected.total_con_edad_critica}</span>
                    </div>
                    <div className="mt-2 text-xs text-zinc-700">
                      Permanencia:{" "}
                      <span className="font-semibold">{ncSelected.total_con_permanencia}</span>
                    </div>
                    <div className="mt-2 text-xs text-zinc-700">
                      Seguro válido:{" "}
                      <span className="font-semibold">{ncSelected.total_con_seguro_valido}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 ring-1 ring-black/5 p-4">
                    <div className="text-xs text-zinc-600">Denominador (NC)</div>
                    <div className="mt-1 text-2xl font-semibold text-zinc-900">
                      {ncSelected.denom_total}
                    </div>
                    <div className="mt-2 text-xs text-zinc-600">
                      6m: <span className="font-semibold">{ncSelected.denom_6m}</span> · 12m:{" "}
                      <span className="font-semibold">{ncSelected.denom_12m}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 ring-1 ring-black/5 p-4">
                    <div className="text-xs text-zinc-600">Tamizaje (HIS)</div>
                    <div className="mt-1 text-2xl font-semibold text-zinc-900">
                      {ncSelected.tamizaje_ninos_con_registro}
                    </div>
                    <div className="mt-2 text-xs text-zinc-600">
                      Registros:{" "}
                      <span className="font-semibold">{ncSelected.tamizaje_registros_encontrados}</span>{" "}
                      · Sin tamizaje:{" "}
                      <span className="font-semibold">
                        {Math.max(0, ncSelected.denom_total - ncSelected.tamizaje_ninos_con_registro)}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 ring-1 ring-black/5 p-4">
                    <div className="text-xs text-zinc-600">Numerador (N) y cumplimiento</div>
                    <div className="mt-1 text-2xl font-semibold text-zinc-900">
                      {ncSelected.num_total}
                    </div>
                    <div className="mt-2 text-xs text-zinc-600">
                      6m: <span className="font-semibold">{ncSelected.num_6m}</span> · 12m:{" "}
                      <span className="font-semibold">{ncSelected.num_12m}</span>
                    </div>
                    <div className="mt-2 text-xs text-zinc-600">
                      %:{" "}
                      <span className="font-semibold">
                        {ncSelected.denom_total
                          ? Math.round((ncSelected.num_total / ncSelected.denom_total) * 1000) / 10
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
                    <div className="text-sm font-semibold text-zinc-900">Seguro (en NC)</div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="rounded-xl bg-zinc-50 ring-1 ring-black/5 p-3">
                        <div className="text-xs text-zinc-600">SIS</div>
                        <div className="mt-1 text-lg font-semibold text-zinc-900">{ncSelected.sis}</div>
                      </div>
                      <div className="rounded-xl bg-zinc-50 ring-1 ring-black/5 p-3">
                        <div className="text-xs text-zinc-600">Sin seguro</div>
                        <div className="mt-1 text-lg font-semibold text-zinc-900">
                          {ncSelected.sin_seguro}
                        </div>
                      </div>
                      <div className="rounded-xl bg-zinc-50 ring-1 ring-black/5 p-3">
                        <div className="text-xs text-zinc-600">Otros (excl.)</div>
                        <div className="mt-1 text-lg font-semibold text-zinc-900">
                          {ncSelected.con_otro_seguro}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
                    <div className="text-sm font-semibold text-zinc-900">Control de totales</div>
                    <div className="mt-2 text-xs text-zinc-600">
                      {(() => {
                        const exclDen = ncSelected.excluciones_denominador.reduce((a, b) => a + b.count, 0);
                        const exclNum = ncSelected.excluciones_numerador.reduce((a, b) => a + b.count, 0);
                        return (
                          <>
                            <div>
                              Cargados = Excl. Denom ({exclDen}) + NC ({ncSelected.denom_total}) ={" "}
                              <span className="font-semibold">{exclDen + ncSelected.denom_total}</span>
                            </div>
                            <div className="mt-1">
                              NC = Excl. Num ({exclNum}) + N ({ncSelected.num_total}) ={" "}
                              <span className="font-semibold">{exclNum + ncSelected.num_total}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
                    <div className="text-sm font-semibold text-zinc-900">
                      Exclusiones del denominador (desde cargados)
                    </div>
                    <div className="mt-3 overflow-auto">
                      <table className="min-w-[520px] text-sm">
                        <thead className="bg-zinc-50 text-left text-zinc-600">
                          <tr>
                            <th className="px-3 py-2">Motivo</th>
                            <th className="px-3 py-2 text-right">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {ncSelected.excluciones_denominador.map((e) => (
                            <tr key={e.motivo}>
                              <td className="px-3 py-2 text-zinc-800">{e.motivo}</td>
                              <td className="px-3 py-2 text-right font-semibold text-zinc-900">
                                {e.count}
                              </td>
                            </tr>
                          ))}
                          {!ncSelected.excluciones_denominador.length ? (
                            <tr>
                              <td className="px-3 py-6 text-center text-zinc-500" colSpan={2}>
                                Sin exclusiones registradas.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
                    <div className="text-sm font-semibold text-zinc-900">
                      Exclusiones del numerador (desde NC)
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Incluye anemia, hemoglobina inconsistente y falta de tamizaje en ventana.
                    </div>
                    <div className="mt-3 overflow-auto">
                      <table className="min-w-[520px] text-sm">
                        <thead className="bg-zinc-50 text-left text-zinc-600">
                          <tr>
                            <th className="px-3 py-2">Motivo</th>
                            <th className="px-3 py-2 text-right">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {ncSelected.excluciones_numerador.map((e) => (
                            <tr key={e.motivo}>
                              <td className="px-3 py-2 text-zinc-800">{e.motivo}</td>
                              <td className="px-3 py-2 text-right font-semibold text-zinc-900">
                                {e.count}
                              </td>
                            </tr>
                          ))}
                          {!ncSelected.excluciones_numerador.length ? (
                            <tr>
                              <td className="px-3 py-6 text-center text-zinc-500" colSpan={2}>
                                Sin exclusiones registradas.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white ring-1 ring-black/5 p-4">
                  <div className="text-sm font-semibold text-zinc-900">
                    Detalle de exclusiones (muestra)
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">Se muestran hasta 200 registros.</div>
                  <div className="mt-3 overflow-auto">
                    <table className="min-w-[680px] text-sm">
                      <thead className="bg-zinc-50 text-left text-zinc-600">
                        <tr>
                          <th className="px-3 py-2">DNI</th>
                          <th className="px-3 py-2">Grupo</th>
                          <th className="px-3 py-2">Motivo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {ncSelected.excl_detalle.map((d) => (
                          <tr key={`${d.dni}-${d.grupo}-${d.motivo}`}>
                            <td className="px-3 py-2 font-medium text-zinc-900">{d.dni}</td>
                            <td className="px-3 py-2 text-zinc-700">{d.grupo}</td>
                            <td className="px-3 py-2 text-zinc-700">{d.motivo}</td>
                          </tr>
                        ))}
                        {!ncSelected.excl_detalle.length ? (
                          <tr>
                            <td className="px-3 py-6 text-center text-zinc-500" colSpan={3}>
                              Sin detalle.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No hay datos suficientes para calcular el reporte NC en este mes/ubigeo.
            </div>
          )
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
            <div className="text-sm font-semibold text-zinc-900">
              Reporte por estadosvd (mes)
            </div>
            <div className="mt-3 overflow-auto">
              <table className="min-w-[520px] text-sm">
                <thead className="bg-zinc-50 text-left text-zinc-600">
                  <tr>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {estados.map((e) => (
                    <tr key={e.estado}>
                      <td className="px-3 py-2 text-zinc-800">{e.estado}</td>
                      <td className="px-3 py-2 text-right font-semibold text-zinc-900">
                        {e.count}
                      </td>
                    </tr>
                  ))}
                  {!estados.length ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-zinc-500" colSpan={2}>
                        Sin datos.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {showGeo ? (
            <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
              <div className="text-sm font-semibold text-zinc-900">
                Resumen por ubicación (mes)
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Agrupa por códigos de ubigeo: departamento (2), provincia (4), distrito (6).
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="overflow-auto">
                  <div className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                    Departamentos
                  </div>
                  <table className="mt-2 min-w-[420px] text-sm">
                    <thead className="bg-zinc-50 text-left text-zinc-600">
                      <tr>
                        <th className="px-3 py-2">Código</th>
                        <th className="px-3 py-2 text-right">Niños</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {dept.slice(0, 20).map((r) => (
                        <tr key={r.code}>
                          <td className="px-3 py-2 text-zinc-800">{r.code}</td>
                          <td className="px-3 py-2 text-right font-semibold text-zinc-900">
                            {r.count}
                          </td>
                        </tr>
                      ))}
                      {!dept.length ? (
                        <tr>
                          <td className="px-3 py-6 text-center text-zinc-500" colSpan={2}>
                            Sin datos.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-auto">
                  <div className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                    Provincias
                  </div>
                  <table className="mt-2 min-w-[420px] text-sm">
                    <thead className="bg-zinc-50 text-left text-zinc-600">
                      <tr>
                        <th className="px-3 py-2">Código</th>
                        <th className="px-3 py-2 text-right">Niños</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {prov.slice(0, 20).map((r) => (
                        <tr key={r.code}>
                          <td className="px-3 py-2 text-zinc-800">{r.code}</td>
                          <td className="px-3 py-2 text-right font-semibold text-zinc-900">
                            {r.count}
                          </td>
                        </tr>
                      ))}
                      {!prov.length ? (
                        <tr>
                          <td className="px-3 py-6 text-center text-zinc-500" colSpan={2}>
                            Sin datos.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-auto">
                  <div className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                    Distritos
                  </div>
                  <table className="mt-2 min-w-[420px] text-sm">
                    <thead className="bg-zinc-50 text-left text-zinc-600">
                      <tr>
                        <th className="px-3 py-2">Código</th>
                        <th className="px-3 py-2 text-right">Niños</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {dist.slice(0, 20).map((r) => (
                        <tr key={r.code}>
                          <td className="px-3 py-2 text-zinc-800">{r.code}</td>
                          <td className="px-3 py-2 text-right font-semibold text-zinc-900">
                            {r.count}
                          </td>
                        </tr>
                      ))}
                      {!dist.length ? (
                        <tr>
                          <td className="px-3 py-6 text-center text-zinc-500" colSpan={2}>
                            Sin datos.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
              <div className="text-sm font-semibold text-zinc-900">
                Resumen por ubicación
              </div>
              <div className="mt-1 text-sm text-zinc-600">
                Disponible para SUPER ADMIN.
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

