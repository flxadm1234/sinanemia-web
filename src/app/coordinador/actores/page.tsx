import { requireCoordinador } from "@/lib/auth";
import { listActoresPorCoordinador } from "@/lib/persona";
import { AppShell } from "@/components/AppShell";
import Link from "next/link";
import { getEtapaSeleccionadaPorUbigeo } from "@/lib/meses";
import { countAsignadosPorActores } from "@/lib/padronnominal";
import { CoordinadorActoresClient } from "@/components/CoordinadorActoresClient";

export default async function CoordinadorActoresPage() {
  const user = await requireCoordinador();
  const rows = await listActoresPorCoordinador(user.dni);
  const ubigeo = user.ubigeo ?? null;
  const sel = ubigeo ? await getEtapaSeleccionadaPorUbigeo(ubigeo) : null;
  const etapa = sel?.etapa ?? null;
  const counts =
    ubigeo && etapa
      ? await countAsignadosPorActores({
          ubigeo,
          etapa,
          actores: rows.map((r) => r.dni),
        })
      : new Map<string, number>();
  const clientRows = rows.map((r) => {
    const nombre = `${r.nombrecompleto ?? ""} ${r.apellidos ?? ""}`.trim() || r.dni;
    return {
      idpersona: r.idpersona,
      dni: r.dni,
      nombre,
      ubigeo: r.ubigeo ?? null,
      telefono: (r as any).telefono ?? null,
      estado: r.estado ?? null,
      sectorizacion: (r as any).sectorizacion ?? null,
      ninos: counts.get(r.dni) ?? 0,
    };
  });

  return (
    <AppShell user={user} title="Actores sociales" fullWidth>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              Tus actores sociales
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Listado según CDR = tu DNI ({user.dni})
              {ubigeo ? (
                <>
                  {" "}
                  · Ubigeo: <span className="font-semibold">{ubigeo}</span>
                </>
              ) : null}
              {etapa ? (
                <>
                  {" "}
                  · Etapa: <span className="font-semibold">{etapa}</span>
                </>
              ) : null}
            </div>
          </div>
          <Link
            href="/coordinador/actores/nuevo"
            className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Nuevo actor social
          </Link>
        </div>

        <CoordinadorActoresClient rows={clientRows} etapa={etapa} />
      </div>
    </AppShell>
  );
}

