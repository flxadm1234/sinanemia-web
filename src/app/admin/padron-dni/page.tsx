import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth";
import { ensurePadronDniTables, listPadronDniJobs } from "@/lib/padronDniImport";
import { DeletePadronDniJobButton } from "@/components/DeletePadronDniJobButton";

function fmtDate(v: unknown) {
  const s = String(v ?? "").slice(0, 10);
  if (!s) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export default async function PadronDniPage(props: {
  searchParams?: Promise<{ page?: string; ok?: string; err?: string }>;
}) {
  const user = await requireSession();
  if (user.tipo === "COORDINADOR" || user.tipo === "ACTOR SOCIAL") {
    return (
      <AppShell user={user} title="Carga DNI">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No tienes permisos para acceder a esta sección.
        </div>
      </AppShell>
    );
  }

  await ensurePadronDniTables();
  const sp = (await props.searchParams) ?? {};
  const pageSize = 30;
  const pageNumRaw = Number(sp.page ?? 1);
  const pageNum = Number.isFinite(pageNumRaw) && pageNumRaw >= 1 ? Math.floor(pageNumRaw) : 1;
  const offset = (pageNum - 1) * pageSize;

  const ubigeoFilter = user.tipo === "SUPER ADMIN" ? null : user.ubigeo;
  const res = await listPadronDniJobs({ limit: pageSize, offset, ubigeo: ubigeoFilter });
  const rows = res.rows;
  const total = res.total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? offset + 1 : 0;
  const to = Math.min(total, offset + rows.length);

  function hrefWithPage(n: number) {
    const params = new URLSearchParams();
    params.set("page", String(n));
    return `/admin/padron-dni?${params.toString()}`;
  }

  return (
    <AppShell user={user} title="Carga DNI">
      <div className="flex flex-col gap-4">
        {sp.ok ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Operación realizada.
          </div>
        ) : null}
        {sp.err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            No se pudo completar la operación.
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-zinc-900">Cargas realizadas</div>
            <div className="mt-1 text-sm text-zinc-600">
              Mostrando {from}–{to} de {total}
            </div>
          </div>
          <Link
            href="/admin/padron-dni/nuevo"
            className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Nueva carga
          </Link>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/5">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Fecha de corte</th>
                {user.tipo === "SUPER ADMIN" ? (
                  <th className="px-4 py-3 text-left font-semibold">Ubigeo</th>
                ) : null}
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Cantidad</th>
                <th className="px-4 py-3 text-left font-semibold">Descargar</th>
                <th className="px-4 py-3 text-left font-semibold">Eliminar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.length ? (
                rows.map((r) => (
                  <tr key={r.id} className="text-zinc-900">
                    <td className="px-4 py-3">{fmtDate(r.fecha_corte)}</td>
                    {user.tipo === "SUPER ADMIN" ? (
                      <td className="px-4 py-3">{r.ubigeo ?? "—"}</td>
                    ) : null}
                    <td className="px-4 py-3">
                      {r.status === "queued"
                        ? "En cola"
                        : r.status === "running"
                          ? "Procesando"
                          : r.status === "done"
                            ? "Archivo cargado"
                            : r.status === "failed"
                              ? "Fallido"
                              : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{Number(r.inserted_rows ?? 0)}</td>
                    <td className="px-4 py-3">
                      {r.status === "done" ? (
                        <a
                          href={`/api/padron-dni/jobs/${encodeURIComponent(r.id)}/excel`}
                          className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                        >
                          Descargar
                        </a>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DeletePadronDniJobButton jobId={r.id} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-zinc-500" colSpan={user.tipo === "SUPER ADMIN" ? 6 : 5}>
                    No hay registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-600">
            Página {pageNum} de {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={hrefWithPage(Math.max(1, pageNum - 1))}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                pageNum <= 1
                  ? "border-zinc-200 bg-zinc-50 text-zinc-400 pointer-events-none"
                  : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              Anterior
            </Link>
            <Link
              href={hrefWithPage(Math.min(totalPages, pageNum + 1))}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                pageNum >= totalPages
                  ? "border-zinc-200 bg-zinc-50 text-zinc-400 pointer-events-none"
                  : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              Siguiente
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
