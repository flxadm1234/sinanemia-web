import { requireAdminOrCoordinador } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";
import { searchPadronNominal } from "@/lib/padronnominal";
import { AsignacionClient } from "@/components/AsignacionClient";
import { asignarAction } from "./actions";

export default async function AsignacionPage(props: {
  searchParams: Promise<{
    q?: string;
    na?: string | string[];
    a?: string | string[];
  }>;
}) {
  const user = await requireAdminOrCoordinador();
  const { q, na, a } = await props.searchParams;

  const ubigeo = user.ubigeo ?? null;
  if (!ubigeo) {
    return (
      <AppShell user={user} title="Asignación">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tu usuario no tiene ubigeo configurado.
        </div>
      </AppShell>
    );
  }

  const sel = await getEtapaSeleccionadaPorUbigeo(ubigeo);
  const etapa = sel?.etapa ?? "";

  const naVal = Array.isArray(na) ? na[na.length - 1] : na;
  const aVal = Array.isArray(a) ? a[a.length - 1] : a;
  const includeNoAsignados = naVal == null ? true : naVal !== "0";
  const includeAsignados = aVal == null ? true : aVal !== "0";
  const asignadosFilter =
    includeAsignados && !includeNoAsignados
      ? ("assigned" as const)
      : includeNoAsignados && !includeAsignados
        ? ("unassigned" as const)
        : ("all" as const);

  const rows = etapa
    ? await searchPadronNominal({
        ubigeo,
        etapa,
        q: q ?? "",
        asignados: asignadosFilter,
        limit: 250,
      })
    : [];

  return (
    <AppShell user={user} title="Asignación">
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          <div className="text-lg font-semibold text-zinc-900">
            Asignación de niños
          </div>
          <div className="mt-1 text-sm text-zinc-600">
            Busca por DNI, dirección, referencia o EESS. Se filtra por ubigeo y
            etapa del mes seleccionado.
          </div>

          <form className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Buscar..."
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <button className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800">
              Buscar
            </button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <input type="hidden" name="na" value="0" />
              <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  name="na"
                  value="1"
                  defaultChecked={includeNoAsignados}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                No asignados
              </label>
              <input type="hidden" name="a" value="0" />
              <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  name="a"
                  value="1"
                  defaultChecked={includeAsignados}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                Asignados
              </label>
              <div className="text-xs text-zinc-500">
                No asignados = actor social 0 o vacío.
              </div>
            </div>
          </form>

          <div className="mt-4 text-sm text-zinc-700">
            Ubigeo: <span className="font-semibold">{ubigeo}</span> · Etapa:{" "}
            <span className="font-semibold">{etapa || "—"}</span>
          </div>

          {!etapa ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No hay mes seleccionado en la tabla meses para este ubigeo
              (seleccion=1).
            </div>
          ) : null}
        </div>

        <AsignacionClient
          rows={rows}
          etapa={etapa}
          ubigeo={ubigeo}
          isCoordinador={user.tipo === "COORDINADOR"}
          action={asignarAction}
        />
      </div>
    </AppShell>
  );
}

