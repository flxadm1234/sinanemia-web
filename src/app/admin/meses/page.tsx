import Link from "next/link";
import { requireMesesAccess } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { listMesesAll, listMesesByUbigeo } from "@/lib/meses";
import { seleccionarMesAction, deletePadronMesAction } from "./actions";
import { countPadronPorUbigeoEtapaTipovd } from "@/lib/padronnominal";
import { DeletePadronButton } from "@/components/DeletePadronButton";
import { MesesFiltersClient } from "@/components/MesesFiltersClient";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export default async function AdminMesesPage(props: {
  searchParams?: Promise<{ q?: string; ubigeo?: string; year?: string; estado?: string }>;
}) {
  const user = await requireMesesAccess();
  const ubigeo = user.ubigeo ?? null;
  const canEdit =
    user.tipo === "ADMINISTRADOR" || user.tipo === "SUPER ADMIN" || user.tipo === "SUPERVISOR";
  const canSelect =
    user.tipo === "ADMINISTRADOR" || user.tipo === "SUPER ADMIN" || user.tipo === "COORDINADOR";
  const canDeletePadron = user.tipo === "SUPER ADMIN";
  const canCreate = canEdit || user.tipo === "INVITADO";

  if (
    (user.tipo === "ADMINISTRADOR" || user.tipo === "INVITADO" || user.tipo === "COORDINADOR") &&
    !ubigeo
  ) {
    return (
      <AppShell user={user} title="Meses">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tu usuario no tiene ubigeo configurado.
        </div>
      </AppShell>
    );
  }

  const rows =
    user.tipo === "SUPER ADMIN" || user.tipo === "SUPERVISOR"
      ? await listMesesAll()
      : await listMesesByUbigeo(ubigeo as number);
  const sp = (await props.searchParams) ?? {};
  const q = String(sp.q ?? "").trim().toLowerCase();
  const filterUbigeo = String(sp.ubigeo ?? "").trim();
  const filterYear = String(sp.year ?? "").trim();
  const estado = String(sp.estado ?? "").trim();

  const filteredRows = rows.filter((r) => {
    const u = String(r.ubigeo ?? "");
    const y = String(r.year ?? "");
    const m = String(r.meses ?? "");
    const n = String(r.numero_mes ?? "");
    const isSelected = Number(r.seleccion ?? 0) === 1;

    if (filterUbigeo && u !== filterUbigeo) return false;
    if (filterYear && y !== filterYear) return false;
    if (estado === "selected" && !isSelected) return false;
    if (estado === "unselected" && isSelected) return false;

    if (!q) return true;
    const hay = `${u} ${m} ${y} ${n}`.toLowerCase();
    return hay.includes(q);
  });
  const selected =
    user.tipo === "SUPER ADMIN" || user.tipo === "SUPERVISOR"
      ? null
      : filteredRows.find((r) => Number(r.seleccion ?? 0) === 1) ?? null;

  const ubigeos = Array.from(
    new Set(
      filteredRows
        .map((r) => Number(r.ubigeo ?? NaN))
        .filter((n) => Number.isFinite(n)),
    ),
  );
  const countsMap = await countPadronPorUbigeoEtapaTipovd({ ubigeos, tipovd: "1" });
  const ubigeoOptions = Array.from(
    new Set(rows.map((r) => Number(r.ubigeo ?? NaN)).filter((n) => Number.isFinite(n))),
  ).sort((a, b) => a - b);
  const yearOptions = Array.from(
    new Set(rows.map((r) => Number(r.year ?? NaN)).filter((n) => Number.isFinite(n))),
  ).sort((a, b) => b - a);

  return (
    <AppShell user={user} title="Meses">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              {user.tipo === "SUPER ADMIN" || user.tipo === "SUPERVISOR"
                ? "Meses (todos los ubigeos)"
                : `Meses (ubigeo ${ubigeo})`}
            </div>
            {user.tipo !== "SUPER ADMIN" && user.tipo !== "SUPERVISOR" ? (
              <div className="mt-1 text-sm text-zinc-600">
                Mes seleccionado:{" "}
                <span className="font-semibold">
                  {selected
                    ? `${selected.meses} ${selected.year} (N° ${selected.numero_mes})`
                    : "—"}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && user.tipo === "SUPER ADMIN" ? (
              <Link
                href="/admin/meses/importar"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Importar Excel
              </Link>
            ) : null}
            {canCreate ? (
              <Link
                href="/admin/meses/nuevo"
                className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Nuevo mes
              </Link>
            ) : null}
          </div>
        </div>

        <MesesFiltersClient ubigeos={ubigeoOptions} years={yearOptions} />

        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Ubigeo</th>
                  <th className="px-4 py-3">Mes</th>
                  <th className="px-4 py-3">N°</th>
                  <th className="px-4 py-3">Año</th>
                  <th className="px-4 py-3">Niños (tipovd=1)</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Eliminar padrón</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredRows.map((r) => {
                  const isSelected = Number(r.seleccion ?? 0) === 1;
                  const etapa = `${r.year}-${pad2(Number(r.numero_mes ?? 0))}-01`;
                  const count = countsMap.get(`${Number(r.ubigeo)}|${etapa}`) ?? 0;
                  return (
                    <tr key={r.idmeses} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-zinc-700">{r.idmeses}</td>
                      <td className="px-4 py-3 text-zinc-700">{r.ubigeo}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {r.meses}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{r.numero_mes}</td>
                      <td className="px-4 py-3 text-zinc-700">{r.year}</td>
                      <td className="px-4 py-3 text-zinc-700">{count}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold " +
                            (isSelected
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200")
                          }
                        >
                          {isSelected ? "Seleccionado" : "No seleccionado"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canDeletePadron ? (
                          <DeletePadronButton
                            action={deletePadronMesAction}
                            ubigeo={String(r.ubigeo)}
                            etapa={etapa}
                            count={count}
                          />
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit ? (
                            <>
                              <Link
                                href={`/admin/meses/${r.idmeses}`}
                                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                              >
                                Editar
                              </Link>
                            </>
                          ) : null}
                          {canSelect ? (
                            <form action={seleccionarMesAction}>
                              <input type="hidden" name="idmeses" value={String(r.idmeses)} />
                              <input type="hidden" name="ubigeo" value={String(r.ubigeo ?? "")} />
                              <button
                                disabled={isSelected}
                                className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                              >
                                Seleccionar
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-zinc-500"
                      colSpan={9}
                    >
                      No se encontraron meses con los filtros actuales.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

