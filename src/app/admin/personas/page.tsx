import Link from "next/link";
import { requireAdminOrSuperAdmin } from "@/lib/auth";
import { listPersonas } from "@/lib/persona";
import { AppShell } from "@/components/AppShell";
import { setEstadoAction } from "./actions";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";
import { countAsignadosPorActores } from "@/lib/padronnominal";
import { NinosAsignadosButton } from "@/components/NinosAsignadosButton";

export default async function AdminPersonasPage(props: {
  searchParams: Promise<{ estado?: string; q?: string; tipo?: string }>;
}) {
  const user = await requireAdminOrSuperAdmin();
  const { estado, q, tipo } = await props.searchParams;

  const estadoNum =
    estado === "1" ? 1 : estado === "0" ? 0 : undefined;

  const ubigeoFilter =
    user.tipo === "ADMINISTRADOR" ? user.ubigeo ?? undefined : undefined;

  const rows = await listPersonas({
    ubigeo: ubigeoFilter,
    estado: estadoNum,
    tipo: tipo ?? undefined,
    q: q ?? undefined,
  });

  const actorRows = rows.filter((r) =>
    String(r.tipo ?? "").toUpperCase().startsWith("ACTOR SOCIAL"),
  );
  const ninosMap = new Map<string, number>();
  if (actorRows.length) {
    const byUbigeo = new Map<number, string[]>();
    for (const r of actorRows) {
      const u = Number(r.ubigeo ?? NaN);
      if (!Number.isFinite(u)) continue;
      const dni = String(r.dni ?? "").trim();
      if (!dni) continue;
      const arr = byUbigeo.get(u) ?? [];
      arr.push(dni);
      byUbigeo.set(u, arr);
    }

    for (const [u, dnis] of byUbigeo.entries()) {
      const sel = await getEtapaSeleccionadaPorUbigeo(u);
      const etapa = sel?.etapa ?? "";
      if (!etapa) continue;
      const counts = await countAsignadosPorActores({ ubigeo: u, etapa, actores: dnis });
      for (const dni of dnis) {
        ninosMap.set(dni, counts.get(dni) ?? 0);
      }
    }
  }

  return (
    <AppShell user={user} title="Usuarios">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              Usuarios
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              {user.tipo === "SUPER ADMIN"
                ? "Vista global de todos los ubigeos"
                : `Vista por ubigeo: ${user.ubigeo ?? "-"}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/personas/importar"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Importar Excel
            </Link>
            <Link
              href="/admin/personas/nuevo"
              className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Nuevo usuario
            </Link>
          </div>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
          <form className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1">
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar por DNI, nombres, apellidos, CDR o teléfono..."
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="flex gap-2">
              <select
                name="tipo"
                defaultValue={tipo ?? ""}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Todos</option>
                <option value="ACTOR SOCIAL">ACTOR SOCIAL</option>
                <option value="COORDINADOR">COORDINADOR</option>
                <option value="ADMINISTRADOR">ADMINISTRADOR</option>
                {user.tipo === "SUPER ADMIN" ? (
                  <option value="SUPER ADMIN">SUPER ADMIN</option>
                ) : null}
              </select>
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
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">DNI</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">CDR</th>
                  <th className="px-4 py-3">Ubigeo</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Sectorización</th>
                  <th className="px-4 py-3">Niños</th>
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
                  const isActor =
                    String(r.tipo ?? "").toUpperCase().startsWith("ACTOR SOCIAL");
                  const hasSector = (r.sectorizacion ?? null) === 1;
                  const ninos = isActor ? ninosMap.get(r.dni) ?? 0 : 0;
                  return (
                    <tr key={r.idpersona} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-zinc-700">{r.idpersona}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {r.dni}
                      </td>
                      <td className="px-4 py-3 text-zinc-800">{nombre}</td>
                      <td className="px-4 py-3 text-zinc-700">{r.tipo ?? "-"}</td>
                      <td className="px-4 py-3 text-zinc-700">{r.cdr}</td>
                      <td className="px-4 py-3 text-zinc-700">
                        {r.ubigeo ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {r.telefono ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        {isActor ? (
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold " +
                              (hasSector
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                : "bg-amber-50 text-amber-800 ring-1 ring-amber-200")
                            }
                          >
                            {hasSector ? "Registrado" : "Pendiente"}
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isActor ? (
                          <NinosAsignadosButton
                            actorDni={r.dni}
                            actorNombre={nombre}
                            count={ninos}
                          />
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
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
                            href={`/admin/personas/${r.idpersona}`}
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                          >
                            Ver
                          </Link>
                          {isActor ? (
                            <Link
                              href={`/admin/sectorizacion/${r.idpersona}`}
                              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                            >
                              Sectorizar
                            </Link>
                          ) : null}
                          <form action={setEstadoAction}>
                            <input
                              type="hidden"
                              name="idpersona"
                              value={String(r.idpersona)}
                            />
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
                    <td className="px-4 py-10 text-center text-zinc-500" colSpan={11}>
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

