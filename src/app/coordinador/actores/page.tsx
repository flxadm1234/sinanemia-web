import { requireCoordinador } from "@/lib/auth";
import { listActoresPorCoordinador } from "@/lib/persona";
import { AppShell } from "@/components/AppShell";

export default async function CoordinadorActoresPage() {
  const user = await requireCoordinador();
  const rows = await listActoresPorCoordinador(user.dni);

  return (
    <AppShell user={user} title="Actores sociales">
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-lg font-semibold text-zinc-900">
            Tus actores sociales
          </div>
          <div className="mt-1 text-sm text-zinc-600">
            Listado según CDR = tu DNI ({user.dni})
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3">DNI</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Ubigeo</th>
                  <th className="px-4 py-3">Estado</th>
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
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-zinc-500" colSpan={4}>
                      No tienes actores sociales asociados.
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

