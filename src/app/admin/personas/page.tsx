import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listActoresSociales } from "@/lib/persona";
import { AppShell } from "@/components/AppShell";
import { setEstadoAction } from "./actions";

export default async function AdminPersonasPage(props: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const user = await requireAdmin();
  const { estado, q } = await props.searchParams;

  const estadoNum =
    estado === "1" ? 1 : estado === "0" ? 0 : undefined;

  const rows = await listActoresSociales({
    estado: estadoNum,
    q: q ?? undefined,
  });

  return (
    <AppShell user={user} title="Usuarios">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              Actores sociales
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Administra usuarios por estado y coordinador asignado
            </div>
          </div>
          <Link
            href="/admin/personas/nuevo"
            className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Nuevo usuario
          </Link>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
          <form className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1">
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar por DNI, nombres, apellidos o CDR..."
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="flex gap-2">
              <select
                name="estado"
                defaultValue={estado ?? ""}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Todos</option>
                <option value="1">Activos</option>
                <option value="0">Inactivos</option>
              </select>
              <button className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50">
                Filtrar
              </button>
            </div>
          </form>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3">DNI</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">CDR</th>
                  <th className="px-4 py-3">Ubigeo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => {
                  const nombre =
                    `${r.nombrecompleto ?? ""} ${r.apellidos ?? ""}`.trim() ||
                    r.dni;
                  const activo = (r.estado ?? 0) === 1;
                  return (
                    <tr key={r.dni} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {r.dni}
                      </td>
                      <td className="px-4 py-3 text-zinc-800">{nombre}</td>
                      <td className="px-4 py-3 text-zinc-700">{r.cdr}</td>
                      <td className="px-4 py-3 text-zinc-700">
                        {r.ubigeo ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold " +
                            (activo
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200")
                          }
                        >
                          {activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/personas/${r.dni}`}
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                          >
                            Ver
                          </Link>
                          <form action={setEstadoAction}>
                            <input type="hidden" name="dni" value={r.dni} />
                            <input
                              type="hidden"
                              name="estado"
                              value={activo ? "0" : "1"}
                            />
                            <button className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800">
                              {activo ? "Inhabilitar" : "Habilitar"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-zinc-500" colSpan={6}>
                      No hay resultados con los filtros actuales.
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

