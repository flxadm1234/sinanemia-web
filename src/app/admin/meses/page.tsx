import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { listMesesByUbigeo } from "@/lib/meses";
import { seleccionarMesAction } from "./actions";

export default async function AdminMesesPage() {
  const user = await requireAdmin();
  const ubigeo = user.ubigeo ?? null;

  if (!ubigeo) {
    return (
      <AppShell user={user} title="Meses">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tu usuario no tiene ubigeo configurado.
        </div>
      </AppShell>
    );
  }

  const rows = await listMesesByUbigeo(ubigeo);
  const selected = rows.find((r) => Number(r.seleccion ?? 0) === 1) ?? null;

  return (
    <AppShell user={user} title="Meses">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              Meses (ubigeo {ubigeo})
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Mes seleccionado:{" "}
              <span className="font-semibold">
                {selected
                  ? `${selected.meses} ${selected.year} (N° ${selected.numero_mes})`
                  : "—"}
              </span>
            </div>
          </div>
          <Link
            href="/admin/meses/nuevo"
            className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Nuevo mes
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Mes</th>
                  <th className="px-4 py-3">N°</th>
                  <th className="px-4 py-3">Año</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => {
                  const isSelected = Number(r.seleccion ?? 0) === 1;
                  return (
                    <tr key={r.idmeses} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-zinc-700">{r.idmeses}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {r.meses}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{r.numero_mes}</td>
                      <td className="px-4 py-3 text-zinc-700">{r.year}</td>
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
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/meses/${r.idmeses}`}
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                          >
                            Editar
                          </Link>
                          <form action={seleccionarMesAction}>
                            <input
                              type="hidden"
                              name="idmeses"
                              value={String(r.idmeses)}
                            />
                            <button
                              disabled={isSelected}
                              className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                            >
                              Seleccionar
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-zinc-500"
                      colSpan={6}
                    >
                      No hay meses registrados para tu ubigeo.
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

