import { requireAdminOrCoordinador } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";
import { searchPadronNominal } from "@/lib/padronnominal";
import { AsignacionClient } from "@/components/AsignacionClient";
import { asignarAction } from "./actions";

export default async function AsignacionPage(props: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAdminOrCoordinador();
  const { q } = await props.searchParams;

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

  const rows = etapa
    ? await searchPadronNominal({
        ubigeo,
        etapa,
        q: q ?? "",
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

          <form className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Buscar..."
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <button className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800">
              Buscar
            </button>
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

