import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { DashboardPdfButton } from "@/components/DashboardPdfButton";
import {
  computePadronDniDocTypeStats,
  computePadronMetaUpdateStats,
  estadosvdDistribucion,
  listDashboardMonthsByUbigeo,
  listDistinctUbigeosFromMeses,
  resumenPorDepartamento,
  resumenPorDistrito,
  resumenPorProvincia,
  timelineTotales,
  type DashboardMonth,
} from "@/lib/dashboard";
import { computeNcMetricsForEtapa } from "@/lib/ncReporte";
import { NcLineChart } from "@/components/NcLineChart";
import { DownloadFileButton } from "@/components/DownloadFileButton";
import { DashboardFiltersClient } from "@/components/DashboardFiltersClient";
import { DownloadIconButton } from "@/components/DownloadIconButton";
import {
  computeVisitasGeoSeries,
  computeVisitasMetaDetalleMes,
  computeVisitasMetaSeries,
} from "@/lib/visitasMeta";
import { ensureMetasC1DefaultsForUbigeo, getMetaC1ByUbigeoTipo } from "@/lib/metasC1";

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

function ymOf(m: DashboardMonth | null) {
  return m ? `${m.year}-${m.numero_mes}` : "";
}

export default async function DashboardPage(props: {
  searchParams: Promise<{ ubigeo?: string; ym?: string }>;
}) {
  const user = await requireSession();
  const sp = parseSearch(await props.searchParams);

  const role = user.tipo;

  let scopeUbigeo = "";
  if (
    role === "ADMINISTRADOR" ||
    role === "COORDINADOR" ||
    role === "ACTOR SOCIAL" ||
    role === "INVITADO"
  ) {
    scopeUbigeo = String(user.ubigeo ?? "");
  } else if (role === "SUPER ADMIN" || role === "SUPERVISOR") {
    scopeUbigeo = sp.ubigeo;
  }

  const ubigeos =
    role === "SUPER ADMIN" || role === "SUPERVISOR"
      ? await listDistinctUbigeosFromMeses()
      : [];

  let months: DashboardMonth[] = [];
  if (scopeUbigeo) {
    months = await listDashboardMonthsByUbigeo(scopeUbigeo, 12);
  }

  let selectedMonth: DashboardMonth | null = null;
  if (months.length) {
    selectedMonth =
      role === "SUPER ADMIN" || role === "SUPERVISOR"
        ? findSelectedMonth(months, sp.year, sp.numero_mes)
        : findSelectedMonth(months, sp.year, sp.numero_mes) ?? pickDefaultMonth(months);
  }

  if (!selectedMonth) {
    return (
      <AppShell user={user} title="Dashboard">
        {role === "SUPER ADMIN" || role === "SUPERVISOR" ? (
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
            <div className="text-lg font-semibold text-zinc-900">Resumen</div>
            <div className="mt-1 text-sm text-zinc-600">
              Selecciona un ubigeo y un mes para visualizar el dashboard.
            </div>
            <DashboardFiltersClient
              ubigeos={ubigeos}
              initialUbigeo={sp.ubigeo}
              initialYm={sp.ubigeo && sp.year && sp.numero_mes ? `${sp.year}-${sp.numero_mes}` : ""}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No hay meses disponibles para mostrar el dashboard.
          </div>
        )}
      </AppShell>
    );
  }

  const etapa = selectedMonth.etapa;
  if (scopeUbigeo) {
    await ensureMetasC1DefaultsForUbigeo(scopeUbigeo);
  }

  const scopeFilters = (() => {
    if (role === "COORDINADOR") return { ubigeo: scopeUbigeo, responsable: user.dni };
    if (role === "ACTOR SOCIAL") return { ubigeo: scopeUbigeo, actor: user.dni };
    if (role === "ADMINISTRADOR") return { ubigeo: scopeUbigeo };
    if (role === "SUPER ADMIN" || role === "SUPERVISOR")
      return scopeUbigeo ? { ubigeo: scopeUbigeo } : {};
    if (role === "INVITADO") return { ubigeo: scopeUbigeo };
    return {};
  })();

  const estados = await estadosvdDistribucion({ etapa, ...scopeFilters, limit: 12 });
  const totalsPoint =
    (
      await timelineTotales({
        months: [selectedMonth],
        ubigeo: scopeUbigeo || undefined,
        actor: role === "ACTOR SOCIAL" ? user.dni : undefined,
        responsable: role === "COORDINADOR" ? user.dni : undefined,
      })
    )[0] ?? null;

  const padronDniDocStats = scopeUbigeo ? await computePadronDniDocTypeStats({ ubigeo: Number(scopeUbigeo) }) : null;
  const padronMetaStats =
    scopeUbigeo && selectedMonth?.etapa
      ? await computePadronMetaUpdateStats({ ubigeo: Number(scopeUbigeo), periodo: selectedMonth.etapa })
      : null;

  const showGeo = role === "SUPER ADMIN" || role === "SUPERVISOR";
  const dept = showGeo ? await resumenPorDepartamento({ etapa, limit: 50 }) : [];
  const prov = showGeo ? await resumenPorProvincia({ etapa, limit: 80 }) : [];
  const dist = showGeo ? await resumenPorDistrito({ etapa, limit: 80 }) : [];

  const ncEnabled =
    role === "ADMINISTRADOR" ||
    role === "SUPER ADMIN" ||
    role === "INVITADO" ||
    role === "SUPERVISOR";
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

  const metaNc = scopeUbigeo
    ? await getMetaC1ByUbigeoTipo({ ubigeo: scopeUbigeo, tipo: 1 })
    : null;
  const metaVisitas = scopeUbigeo
    ? await getMetaC1ByUbigeoTipo({ ubigeo: scopeUbigeo, tipo: 2 })
    : null;
  const metaGeo = scopeUbigeo
    ? await getMetaC1ByUbigeoTipo({ ubigeo: scopeUbigeo, tipo: 3 })
    : null;

  const visitasEnabled = Boolean(scopeUbigeo) && selectedMonth.year === 2026 && selectedMonth.numero_mes >= 2;
  const visitasUbigeo = Number(scopeUbigeo);
  const visitasOkUbigeo = visitasEnabled && Number.isFinite(visitasUbigeo) && visitasUbigeo > 0;

  const visitasMonthsSource = months
    .filter((m) => m.year === 2026 && m.numero_mes >= 2 && m.numero_mes <= selectedMonth.numero_mes)
    .slice()
    .sort((a, b) => a.numero_mes - b.numero_mes);

  const visitasEtapas = visitasMonthsSource.map((m) => m.etapa);
  const visitasActor = role === "ACTOR SOCIAL" ? user.dni : undefined;
  const visitasResponsable = role === "COORDINADOR" ? user.dni : undefined;
  const visitasSeries = visitasOkUbigeo
    ? await computeVisitasMetaSeries({
        ubigeo: visitasUbigeo,
        etapas: visitasEtapas,
        actor: visitasActor,
        responsable: visitasResponsable,
      })
    : [];
  const visitasDetalle = visitasOkUbigeo
    ? await computeVisitasMetaDetalleMes({
        ubigeo: visitasUbigeo,
        etapa: selectedMonth.etapa,
        actor: visitasActor,
        responsable: visitasResponsable,
      })
    : null;
  const geoSeries = visitasOkUbigeo
    ? await computeVisitasGeoSeries({
        ubigeo: visitasUbigeo,
        etapas: visitasEtapas,
        actor: visitasActor,
        responsable: visitasResponsable,
      })
    : [];
  const geoSelected = geoSeries.find((p) => p.etapa === selectedMonth.etapa) ?? null;

  const pdfPayload = {
    scopeUbigeo: scopeUbigeo,
    etapa: selectedMonth.etapa,
    periodoLabel: `${selectedMonth.meses} ${selectedMonth.year}`,
    userLabel: user.nombre,
    role: role,
    totals: totalsPoint ? { total: totalsPoint.total, assigned: totalsPoint.assigned } : undefined,
    nc: ncSelected
      ? {
          denom: ncSelected.denom_total,
          numer: ncSelected.num_total,
          pct: ncSelected.denom_total
            ? Math.round((ncSelected.num_total / ncSelected.denom_total) * 1000) / 10
            : 0,
          meta: metaNc ? Number(metaNc.valla_min) : undefined,
        }
      : undefined,
    visitas: visitasDetalle
      ? {
          denom: visitasDetalle.denom_total,
          numer: visitasDetalle.numer_total,
          pct: visitasDetalle.denom_total
            ? Math.round((visitasDetalle.numer_total / visitasDetalle.denom_total) * 1000) / 10
            : 0,
          meta: metaVisitas ? Number(metaVisitas.valla_min) : undefined,
        }
      : undefined,
    geo: geoSelected
      ? {
          denom: geoSelected.denom,
          numer: geoSelected.numer,
          pct: geoSelected.denom
            ? Math.round((geoSelected.numer / geoSelected.denom) * 1000) / 10
            : 0,
          meta: metaGeo ? Number(metaGeo.valla_min) : undefined,
        }
      : undefined,
    series: {
      nc: ncSeries.length
        ? ncSeries.map((m: any) => ({
            etapa: String(m.etapa ?? ""),
            label: String(m.label ?? ""),
            denom: Number(m.denom_total ?? 0),
            numer: Number(m.num_total ?? 0),
            pct: Number(m.denom_total ?? 0)
              ? Math.round((Number(m.num_total ?? 0) / Number(m.denom_total ?? 0)) * 1000) / 10
              : 0,
            meta: metaNc ? Number(metaNc.valla_min) : undefined,
          }))
        : undefined,
      visitas: visitasSeries.length
        ? visitasSeries.map((p: any) => ({
            etapa: String(p.etapa ?? ""),
            label: String(p.label ?? ""),
            denom: Number(p.denom ?? 0),
            numer: Number(p.numer ?? 0),
            pct: Number(p.denom ?? 0)
              ? Math.round((Number(p.numer ?? 0) / Number(p.denom ?? 0)) * 1000) / 10
              : 0,
            meta: metaVisitas ? Number(metaVisitas.valla_min) : undefined,
          }))
        : undefined,
      geo: geoSeries.length
        ? geoSeries.map((p: any) => ({
            etapa: String(p.etapa ?? ""),
            label: String(p.label ?? ""),
            denom: Number(p.denom ?? 0),
            numer: Number(p.numer ?? 0),
            pct: Number(p.denom ?? 0)
              ? Math.round((Number(p.numer ?? 0) / Number(p.denom ?? 0)) * 1000) / 10
              : 0,
            meta: metaGeo ? Number(metaGeo.valla_min) : undefined,
          }))
        : undefined,
    },
    charts: [
      ncOkUbigeo && ncSeries.length
        ? {
            key: "nc",
            title: "Porcentaje de niños de 6 y/o 12 meses de edad sin anemia",
            svgId: "chart-nc",
          }
        : null,
      visitasOkUbigeo && visitasSeries.length
        ? {
            key: "visitas",
            title:
              "Porcentaje de niños de 1 a 12 meses de edad que reciben visitas domiciliarias por actor social de manera oportuna y completa.",
            svgId: "chart-visitas",
          }
        : null,
      visitasOkUbigeo && geoSeries.length
        ? {
            key: "geo",
            title: "Cumplimiento de visitas georreferenciadas",
            svgId: "chart-geo",
          }
        : null,
    ].filter(Boolean) as any,
  };

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

          {role === "SUPER ADMIN" || role === "SUPERVISOR" ? (
            <div className="mt-2">
              <DashboardFiltersClient
                ubigeos={ubigeos}
                initialUbigeo={scopeUbigeo}
                initialYm={ymOf(selectedMonth)}
                pdfPayload={pdfPayload as any}
              />
            </div>
          ) : (
            <form className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-900">Mes</label>
                <select
                  name="ym"
                  defaultValue={ymOf(selectedMonth)}
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
              <div className="md:ml-auto">
                <DashboardPdfButton payload={pdfPayload as any} />
              </div>
            </form>
          )}
        </div>

        {totalsPoint ? (
          <div className="rounded-2xl bg-blue-50 ring-1 ring-blue-200 p-5">
            <div className="text-sm font-semibold text-blue-950">
              Resumen de la carga de niños del mes {String(selectedMonth.meses ?? "").toUpperCase()}
            </div>
            <div className="mt-1 text-xs text-blue-900/70">
              Asignados = registros con Actor Social.
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/70 ring-1 ring-blue-200/60 p-4">
                <div className="text-xs text-blue-900/70">Niños cargados</div>
                <div className="mt-1 text-2xl font-semibold text-blue-950">
                  {totalsPoint.total}
                </div>
              </div>
              <div className="rounded-2xl bg-white/70 ring-1 ring-blue-200/60 p-4">
                <div className="text-xs text-blue-900/70">Niños asignados</div>
                <div className="mt-1 text-2xl font-semibold text-blue-950">
                  {totalsPoint.assigned}
                </div>
              </div>
              <div className="rounded-2xl bg-white/70 ring-1 ring-blue-200/60 p-4">
                <div className="text-xs text-blue-900/70">Niños sin asignar</div>
                <div className="mt-1 text-2xl font-semibold text-blue-950">
                  {Math.max(0, totalsPoint.total - totalsPoint.assigned)}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          <div className="text-sm font-semibold text-zinc-900">PADRON NOMINAL</div>
          {padronDniDocStats ? (
            <div className="mt-1 text-xs text-zinc-500">
              Último corte: <span className="font-semibold">{padronDniDocStats.fecha_corte}</span>
            </div>
          ) : (
            <div className="mt-1 text-xs text-zinc-500">Sin carga DNI disponible para este ubigeo.</div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-zinc-50 ring-1 ring-black/5 p-4">
              <div className="text-sm font-semibold text-zinc-900">TIPO DE DOCUMENTO (0-12 MESES)</div>
              {padronDniDocStats ? (
                <>
                  <div className="mt-2 text-xs text-zinc-600">
                    Niños 0–12 meses:{" "}
                    <span className="font-semibold">{padronDniDocStats.total_0_12m}</span>
                    {padronDniDocStats.invalid_birthdate ? (
                      <span className="ml-2 text-zinc-500">
                        (sin fecha nacimiento válida: {padronDniDocStats.invalid_birthdate})
                      </span>
                    ) : null}
                  </div>

                  {padronDniDocStats.breakdown.length ? (
                    <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-black/5">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-3 py-2 font-semibold text-zinc-700">Tipo</th>
                            <th className="px-3 py-2 font-semibold text-zinc-700">N</th>
                            <th className="px-3 py-2 font-semibold text-zinc-700">%</th>
                            <th className="px-3 py-2 font-semibold text-zinc-700 text-right"> </th>
                          </tr>
                        </thead>
                        <tbody className="bg-zinc-50">
                          {padronDniDocStats.breakdown.map((r) => (
                            <tr key={r.doc_key} className="border-t border-zinc-200/60">
                              <td className="px-3 py-2 text-zinc-800">{r.label}</td>
                              <td className="px-3 py-2 font-semibold text-zinc-900">{r.count}</td>
                              <td className="px-3 py-2 text-zinc-700">{r.pct}%</td>
                              <td className="px-3 py-2 text-right">
                                {role === "INVITADO" ? (
                                  <span className="text-zinc-400">—</span>
                                ) : (
                                  <DownloadIconButton
                                    href={`/api/reportes/padron-dni-doc-excel?ubigeo=${encodeURIComponent(
                                      String(scopeUbigeo),
                                    )}&doc_key=${encodeURIComponent(r.doc_key)}`}
                                    filename={`padron_dni_${String(scopeUbigeo)}_${padronDniDocStats.fecha_corte}_${r.doc_key}.xls`}
                                    overlayLabel="Generando Excel..."
                                    title="Descargar Excel"
                                  />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-zinc-600">No hay registros con edad 0–12 meses.</div>
                  )}
                </>
              ) : (
                <div className="mt-2 text-xs text-zinc-600">—</div>
              )}
            </div>

            <div className="rounded-2xl bg-zinc-50 ring-1 ring-black/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-zinc-900">
                  META ACTUALIZACIÓN DEL PADRÓN NOMINAL (0-12 MESES)
                </div>
                {role === "INVITADO" || !padronMetaStats ? null : (
                  <DownloadIconButton
                    href={`/api/reportes/padron-meta-update-excel?ubigeo=${encodeURIComponent(
                      String(scopeUbigeo),
                    )}&periodo=${encodeURIComponent(padronMetaStats.periodo)}`}
                    filename={`padron_meta_${String(scopeUbigeo)}_${padronMetaStats.periodo}.xls`}
                    overlayLabel="Generando Excel..."
                    title="Descargar Excel"
                  />
                )}
              </div>

              {padronMetaStats ? (
                <>
                  <div className="mt-2 text-xs text-zinc-600">
                    Periodo: <span className="font-semibold">{padronMetaStats.periodo}</span> · Corte (inicio):{" "}
                    <span className="font-semibold">{padronMetaStats.fecha_corte}</span> · Cierre:{" "}
                    <span className="font-semibold">{padronMetaStats.fecha_cierre}</span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-white ring-1 ring-black/5 p-3">
                      <div className="text-xs text-zinc-600">Niños 0–12 meses (al cierre)</div>
                      <div className="mt-1 text-xl font-semibold text-zinc-900">
                        {padronMetaStats.total_0_12m}
                      </div>
                      {padronMetaStats.invalid_birthdate ? (
                        <div className="mt-1 text-[11px] text-zinc-500">
                          Sin fecha nacimiento válida: {padronMetaStats.invalid_birthdate}
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-xl bg-white ring-1 ring-black/5 p-3">
                      <div className="text-xs text-zinc-600">Meta (con faltantes)</div>
                      <div className="mt-1 text-xl font-semibold text-zinc-900">
                        {padronMetaStats.denom_meta}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Actualizados: {padronMetaStats.numer_actualizados} · Avance:{" "}
                        <span className="font-semibold">{padronMetaStats.pct_actualizados}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-zinc-700">
                    Faltantes: DNI{" "}
                    <span className="font-semibold">{padronMetaStats.missing.dni}</span> · Programas{" "}
                    <span className="font-semibold">{padronMetaStats.missing.programas}</span> · Dirección{" "}
                    <span className="font-semibold">{padronMetaStats.missing.direccion}</span> · EESS{" "}
                    <span className="font-semibold">{padronMetaStats.missing.eess}</span>
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm text-zinc-600">
                  Sin carga DNI de inicio de mes para este periodo.
                </div>
              )}
            </div>
          </div>
        </div>

        {ncEnabled ? (
          ncOkUbigeo && ncSeries.length && ncSelected ? (
            <>
              <NcLineChart
                target={metaNc ? Number(metaNc.valla_min) : undefined}
                svgId="chart-nc"
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
                      Incluye anemia (HB{"<"}10.5), hemoglobina inválida y falta de tamizaje en ventana (HB 0/vacía o sin registro HIS).
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
                    Descarga
                  </div>
                  {role === "INVITADO" ? (
                    <div className="mt-2 text-xs text-zinc-600">
                      La exportación de Excel se encuentra deshabilitada para tu rol.
                    </div>
                  ) : (
                    <DownloadFileButton
                      href={`/api/reportes/nc-excel?ubigeo=${encodeURIComponent(
                        scopeUbigeo,
                      )}&etapa=${encodeURIComponent(ncSelected.etapa)}`}
                      filename={`nc_${scopeUbigeo}_${ncSelected.etapa}.xls`}
                      label="Descargar Excel"
                      overlayLabel="Generando Excel..."
                      className="mt-3 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    />
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No hay datos suficientes para calcular el reporte NC en este mes/ubigeo.
            </div>
          )
        ) : null}

        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          <div className="text-sm font-semibold text-zinc-900">Condiciones previas</div>
          <div className="mt-1 text-xs text-zinc-500">
            Se calculan por etapa y ubigeo (periodo: Febrero–Diciembre 2026).
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-2xl bg-zinc-50 ring-1 ring-black/5 p-4">
              <div className="text-sm font-semibold text-zinc-900">
                META DE VISITAS COMPLETAS Y OPORTUNAS
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Denominador (Nₙ): niños del padrón (etapa), asignados y no asignados, con edad 30–389 días y seguro SIS o sin seguro. Numerador (NVₙ): cumplen visitas completas y oportunas (intervalos 7–10 días) según el Excel cargado. Registros “No encontrado” o “Rechazado” no suman al numerador.
              </div>

              {visitasOkUbigeo && visitasSeries.length && visitasDetalle ? (
                <>
                  <div className="mt-4">
                    <NcLineChart
                      title="Porcentaje de niños de 1 a 12 meses de edad que reciben visitas domiciliarias por actor social de manera oportuna y completa."
                      subtitle="Línea = % (Σ NVₙ / Σ Nₙ) × 100. NVₙ: niños con visitas completas y oportunas. Nₙ: niños del padrón con edad 30–389 días y SIS/sin seguro (incluye no asignados)."
                      target={metaVisitas ? Number(metaVisitas.valla_min) : undefined}
                      svgId="chart-visitas"
                      points={visitasSeries.map((p) => ({
                        label: p.label,
                        denom: p.denom,
                        numer: p.numer,
                      }))}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
                    <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
                      <div className="text-xs text-zinc-600">Total padrón (base)</div>
                      <div className="mt-1 text-2xl font-semibold text-zinc-900">
                        {visitasDetalle.total_padron}
                      </div>
                      <div className="mt-2 text-xs text-zinc-600">
                        Asignados: <span className="font-semibold">{visitasDetalle.total_asignados}</span>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
                      <div className="text-xs text-zinc-600">Excl. edad (30–389d)</div>
                      <div className="mt-1 text-2xl font-semibold text-zinc-900">
                        {visitasDetalle.excl_edad}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
                      <div className="text-xs text-zinc-600">Excl. seguro (no SIS)</div>
                      <div className="mt-1 text-2xl font-semibold text-zinc-900">
                        {visitasDetalle.excl_seguro}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
                      <div className="text-xs text-zinc-600">Resultado del mes</div>
                      <div className="mt-1 text-sm text-zinc-700">
                        Nₙ: <span className="font-semibold">{visitasDetalle.denom_total}</span> · NVₙ:{" "}
                        <span className="font-semibold">{visitasDetalle.numer_total}</span>
                      </div>
                      <div className="mt-1 text-sm text-zinc-700">
                        %:{" "}
                        <span className="font-semibold">
                          {visitasDetalle.denom_total
                            ? Math.round((visitasDetalle.numer_total / visitasDetalle.denom_total) * 1000) / 10
                            : 0}
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white ring-1 ring-black/5 p-4">
                    <div className="text-sm font-semibold text-zinc-900">Detalle técnico (mes)</div>
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3 text-sm text-zinc-700">
                      <div>
                        Sin registro de visita (Excel):{" "}
                        <span className="font-semibold">{visitasDetalle.sin_registro_visita}</span>
                      </div>
                      <div>
                        Con visitas pero no completas:{" "}
                        <span className="font-semibold">{visitasDetalle.no_completa}</span>
                      </div>
                      <div>
                        Completas pero no oportunas (7–10d):{" "}
                        <span className="font-semibold">{visitasDetalle.no_oportuna}</span>
                      </div>
                        <div>
                          No encontrado: <span className="font-semibold">{visitasDetalle.no_encontrado}</span>
                        </div>
                        <div>
                          Rechazado: <span className="font-semibold">{visitasDetalle.rechazado}</span>
                        </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white ring-1 ring-black/5 p-4">
                    <div className="text-sm font-semibold text-zinc-900">Descarga</div>
                    {role === "INVITADO" ? (
                      <div className="mt-2 text-xs text-zinc-600">
                        La exportación de Excel se encuentra deshabilitada para tu rol.
                      </div>
                    ) : (
                      <DownloadFileButton
                        href={`/api/reportes/visitas-excel?ubigeo=${encodeURIComponent(
                          String(visitasUbigeo),
                        )}&etapa=${encodeURIComponent(selectedMonth.etapa)}`}
                        filename={`visitas_${String(visitasUbigeo)}_${selectedMonth.etapa}.xls`}
                        label="Descargar Excel (detalle del mes)"
                        overlayLabel="Generando Excel..."
                        className="mt-3 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-sm text-zinc-700">
                  Sección en mantenimiento (en proceso). Primero carga el Excel en “Carga Reporte de actividades”.
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-zinc-50 ring-1 ring-black/5 p-4">
              <div className="text-sm font-semibold text-zinc-900">
                CUMPLIMIENTO DE VISITAS GEORREFERENCIADAS
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Denominador: total de visitas (visitas_raw) de los niños que forman parte del numerador NVₙ
                (visitas completas y oportunas), excluyendo etapa_text “No Encontrado”. Numerador: visitas con
                dispositivo “MOVIL”.
              </div>

              {visitasOkUbigeo && geoSeries.length ? (
                <>
                  <div className="mt-4">
                    <NcLineChart
                      title="Cumplimiento de visitas georreferenciadas por mes"
                      subtitle="Línea = % (Visitas georreferenciadas / Total de visitas) × 100, calculado sobre visitas_raw para niños del numerador NVₙ."
                      target={metaGeo ? Number(metaGeo.valla_min) : undefined}
                      svgId="chart-geo"
                      points={geoSeries.map((p) => ({
                        label: p.label,
                        denom: p.denom,
                        numer: p.numer,
                      }))}
                    />
                  </div>

                  {geoSelected ? (
                    <div className="mt-4 rounded-2xl bg-white ring-1 ring-black/5 p-4">
                      <div className="text-sm font-semibold text-zinc-900">Resultado del mes</div>
                      <div className="mt-2 text-sm text-zinc-700">
                        Total visitas: <span className="font-semibold">{geoSelected.denom}</span> · Visitas
                        georreferenciadas: <span className="font-semibold">{geoSelected.numer}</span> · %:{" "}
                        <span className="font-semibold">
                          {geoSelected.denom
                            ? Math.round((geoSelected.numer / geoSelected.denom) * 1000) / 10
                            : 0}
                          %
                        </span>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-3 text-sm text-zinc-700">
                  Sección en mantenimiento (en proceso). Primero carga el Excel en “Carga Reporte de actividades”.
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-zinc-50 ring-1 ring-black/5 p-4">
              <div className="text-sm font-semibold text-zinc-900">META ACTUALIZACIÓN TELEFÓNICA</div>
              <div className="mt-2 text-sm text-zinc-700">Sección en mantenimiento (en proceso).</div>
            </div>
          </div>
        </div>

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
                Disponible para SUPER ADMIN / SUPERVISOR.
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

