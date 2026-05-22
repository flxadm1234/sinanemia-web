import Link from "next/link";
import { requireMesesAccess } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import {
  findMesSeleccionadoByUbigeo,
  listMesesPage,
  listMesesUbigeoOptions,
  listMesesYearOptions,
} from "@/lib/meses";
import { seleccionarMesAction, deletePadronMesAction } from "./actions";
import { countPadronPorUbigeoEtapaTipovd } from "@/lib/padronnominal";
import { DeletePadronButton } from "@/components/DeletePadronButton";
import { MesesFiltersClient } from "@/components/MesesFiltersClient";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export default async function AdminMesesPage(props: {
  searchParams?: Promise<{
    q?: string;
    ubigeo?: string;
    year?: string;
    estado?: string;
    page?: string;
  }>;
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

  const sp = (await props.searchParams) ?? {};
  const q = String(sp.q ?? "").trim().toLowerCase();
  const filterUbigeo = String(sp.ubigeo ?? "").trim();
  const filterYear = String(sp.year ?? "").trim();
  const estado = String(sp.estado ?? "").trim();
  const pageSize = 30;
  const pageNumRaw = Number(sp.page ?? 1);
  const pageNum = Number.isFinite(pageNumRaw) && pageNumRaw >= 1 ? Math.floor(pageNumRaw) : 1;
  const offset = (pageNum - 1) * pageSize;

  const scopedUbigeo =
    user.tipo === "SUPER ADMIN" || user.tipo === "SUPERVISOR"
      ? filterUbigeo
      : String(ubigeo ?? "");

  const yearNum = filterYear ? Number(filterYear) : NaN;
  const pageRes = await listMesesPage({
    ubigeo: scopedUbigeo ? scopedUbigeo : undefined,
    q: q ? q : undefined,
    year: Number.isFinite(yearNum) ? yearNum : undefined,
    estado: estado === "selected" || estado === "unselected" ? (estado as any) : undefined,
    limit: pageSize,
    offset,
  });
  const rows = pageRes.rows;
  const total = pageRes.total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? offset + 1 : 0;
  const to = Math.min(total, offset + rows.length);

  const selected =
    user.tipo === "SUPER ADMIN" || user.tipo === "SUPERVISOR"
      ? null
      : await findMesSeleccionadoByUbigeo(ubigeo as number);

  const ubigeos = Array.from(
    new Set(rows.map((r) => Number(r.ubigeo ?? NaN)).filter((n) => Number.isFinite(n))),
  );
  const countsMap = await countPadronPorUbigeoEtapaTipovd({ ubigeos, tipovd: "1" });
  const [ubigeoOptions, yearOptions] = await Promise.all([
    user.tipo === "SUPER ADMIN" || user.tipo === "SUPERVISOR"
      ? listMesesUbigeoOptions()
      : [Number(ubigeo)],
    user.tipo === "SUPER ADMIN" || user.tipo === "SUPERVISOR"
      ? listMesesYearOptions(scopedUbigeo ? scopedUbigeo : undefined)
      : listMesesYearOptions(ubigeo as number),
  ]);

  function hrefWithPage(n: number) {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", String(sp.q));
    if (sp.ubigeo) params.set("ubigeo", String(sp.ubigeo));
    if (sp.year) params.set("year", String(sp.year));
    if (sp.estado) params.set("estado", String(sp.estado));
    params.set("page", String(n));
    return `/admin/meses?${params.toString()}`;
  }

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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-zinc-700">
          <div>
            Mostrando <span className="font-semibold">{from}</span>–<span className="font-semibold">{to}</span>{" "}
            de <span className="font-semibold">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={hrefWithPage(Math.max(1, pageNum - 1))}
              aria-disabled={pageNum <= 1}
              className={
                "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 " +
                (pageNum <= 1 ? "pointer-events-none opacity-50" : "")
              }
            >
              Anterior
            </Link>
            <div className="text-xs text-zinc-600">
              Página <span className="font-semibold">{pageNum}</span> /{" "}
              <span className="font-semibold">{totalPages}</span>
            </div>
            <Link
              href={hrefWithPage(Math.min(totalPages, pageNum + 1))}
              aria-disabled={pageNum >= totalPages}
              className={
                "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 " +
                (pageNum >= totalPages ? "pointer-events-none opacity-50" : "")
              }
            >
              Siguiente
            </Link>
          </div>
        </div>

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
                {rows.map((r) => {
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
                {rows.length === 0 ? (
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

