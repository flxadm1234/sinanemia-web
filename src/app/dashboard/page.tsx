import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import {
  countAsignados,
  estadosvdDistribucion,
  getLatestDashboardMonthAny,
  listDashboardMonthsByUbigeo,
  listDistinctUbigeosFromMeses,
  resumenPorDepartamento,
  resumenPorDistrito,
  resumenPorProvincia,
  timelineAsignados,
  type DashboardMonth,
} from "@/lib/dashboard";

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

function BarRow(props: { label: string; value: number; max: number }) {
  const { label, value, max } = props;
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0 text-xs text-zinc-600">{label}</div>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-zinc-100">
          <div className="h-2 rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="w-16 shrink-0 text-right text-xs font-semibold text-zinc-900">
        {value}
      </div>
    </div>
  );
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
    selectedMonth = findSelectedMonth(months, sp.year, sp.numero_mes) ?? months[0] ?? null;
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

  const asignadosActual = await countAsignados({ etapa, ...scopeFilters });

  const timeline = await timelineAsignados({
    months: months.slice(0, 6),
    ...scopeFilters,
  });
  const maxTimeline = Math.max(0, ...timeline.map((t) => t.assigned));

  const estados = await estadosvdDistribucion({ etapa, ...scopeFilters, limit: 12 });

  const showGeo = role === "SUPER ADMIN";
  const dept = showGeo ? await resumenPorDepartamento({ etapa, limit: 50 }) : [];
  const prov = showGeo ? await resumenPorProvincia({ etapa, limit: 80 }) : [];
  const dist = showGeo ? await resumenPorDistrito({ etapa, limit: 80 }) : [];

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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
            <div className="text-sm font-semibold text-zinc-900">
              Niños asignados (periodo)
            </div>
            <div className="mt-2 text-3xl font-semibold text-zinc-900">
              {asignadosActual}
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Conteo de registros con actor social asignado.
            </div>
          </div>

          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5 lg:col-span-2">
            <div className="text-sm font-semibold text-zinc-900">Línea de tiempo</div>
            <div className="mt-1 text-xs text-zinc-500">
              Últimos meses según la tabla meses.
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {timeline.map((t) => (
                <BarRow key={t.etapa} label={t.label} value={t.assigned} max={maxTimeline} />
              ))}
              {!timeline.length ? (
                <div className="text-sm text-zinc-500">Sin datos.</div>
              ) : null}
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
                Disponible para SUPER ADMIN.
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

