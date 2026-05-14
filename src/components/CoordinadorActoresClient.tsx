"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ActorRow = {
  idpersona: number;
  dni: string;
  nombre: string;
  ubigeo: number | null;
  telefono: string | null | undefined;
  estado: number | null;
  sectorizacion: number | null | undefined;
  ninos: number;
};

type AsignadosPayload = {
  ubigeo: number;
  etapa: string;
  actor: { dni: string; nombre: string; cdr: string | null };
  rows: Array<{
    idpn: number;
    dni: string | null;
    nombres: string | null;
    fecha_nac: string | null;
    direccion: string | null;
    referencia: string | null;
    eess_ua: string | null;
    dnimadre: string | null;
    appatmadre: string | null;
    apmatmadre: string | null;
    nombresmadre: string | null;
    dni_padre: string | null;
    nombre_padre: string | null;
    telefonopn: string | null;
    telefono: string | null;
    primera_vd: string | null;
    segunda_vd: string | null;
    tercera_vd: string | null;
    fecha_fin_vd: string | null;
    fechamodificacion: string | null;
    fechamodificacion2: string | null;
  }>;
};

function fmtDate(v: string | null) {
  if (!v) return "-";
  const s = String(v);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

export function CoordinadorActoresClient(props: {
  rows: ActorRow[];
  etapa: string | null;
}) {
  const { rows, etapa } = props;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<AsignadosPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actorDni, setActorDni] = useState<string | null>(null);

  const selectedActor = useMemo(() => {
    if (!actorDni) return null;
    return rows.find((r) => r.dni === actorDni) ?? null;
  }, [actorDni, rows]);

  useEffect(() => {
    if (!open || !actorDni) return;
    setLoading(true);
    setError(null);
    setPayload(null);
    const controller = new AbortController();
    fetch(`/api/padronnominal/asignados?actor=${encodeURIComponent(actorDni)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) {
          const msg =
            typeof data?.error === "string"
              ? data.error
              : "No se pudo cargar la asignación.";
          throw new Error(msg);
        }
        return data as AsignadosPayload;
      })
      .then((d) => setPayload(d))
      .catch((e) => setError(e?.message ?? "Error inesperado."))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [open, actorDni]);

  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">DNI</th>
                <th className="px-4 py-3">Nombre</th>
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
                const activo = (r.estado ?? 0) === 1;
                const hasSector = (r.sectorizacion ?? null) === 1;
                return (
                  <tr key={r.idpersona} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-zinc-700">{r.idpersona}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {r.dni}
                    </td>
                    <td className="px-4 py-3 text-zinc-800">{r.nombre}</td>
                    <td className="px-4 py-3 text-zinc-700">{r.ubigeo ?? "-"}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      {r.telefono ?? "-"}
                    </td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setActorDni(r.dni);
                          setOpen(true);
                        }}
                        className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                      >
                        {r.ninos}
                      </button>
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
                          href={`/coordinador/actores/${r.idpersona}`}
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                        >
                          Editar
                        </Link>
                        <Link
                          href={`/coordinador/sectorizacion/${r.idpersona}`}
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                        >
                          Sectorizar
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-zinc-500" colSpan={9}>
                    No tienes actores sociales asociados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-zinc-900">
                  Niños asignados
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  Actor social:{" "}
                  <span className="font-semibold">
                    {selectedActor?.nombre ?? actorDni}
                  </span>
                  {etapa ? (
                    <>
                      {" "}
                      · Etapa: <span className="font-semibold">{etapa}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="text-sm text-zinc-600">
                {loading
                  ? "Cargando..."
                  : payload
                    ? `Registros: ${payload.rows.length}`
                    : error
                      ? "No se pudo cargar"
                      : ""}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={
                    actorDni
                      ? `/api/padronnominal/asignados/pdf?actor=${encodeURIComponent(actorDni)}`
                      : "#"
                  }
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  Descargar PDF
                </a>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {error}
              </div>
            ) : null}

            <div className="mt-4 max-h-[70vh] overflow-auto rounded-2xl border border-zinc-200">
              <table className="w-full min-w-[1200px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-3 py-3">DNI</th>
                    <th className="px-3 py-3">Niño</th>
                    <th className="px-3 py-3">F. nac</th>
                    <th className="px-3 py-3">Madre</th>
                    <th className="px-3 py-3">Padre</th>
                    <th className="px-3 py-3">EESS</th>
                    <th className="px-3 py-3">Dirección</th>
                    <th className="px-3 py-3">Referencia</th>
                    <th className="px-3 py-3">Últ. atención</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(payload?.rows ?? []).map((r) => {
                    const madre = `${r.nombresmadre ?? ""} ${r.appatmadre ?? ""} ${r.apmatmadre ?? ""}`.trim();
                    const padre = `${r.nombre_padre ?? ""}`.trim();
                    const ultima =
                      r.fechamodificacion2 ||
                      r.fechamodificacion ||
                      r.fecha_fin_vd ||
                      r.tercera_vd ||
                      r.segunda_vd ||
                      r.primera_vd ||
                      null;
                    return (
                      <tr key={r.idpn} className="hover:bg-zinc-50/50">
                        <td className="px-3 py-3 font-medium text-zinc-900">
                          {r.dni ?? "-"}
                        </td>
                        <td className="px-3 py-3 text-zinc-800">
                          {r.nombres ?? "-"}
                        </td>
                        <td className="px-3 py-3 text-zinc-700">
                          {fmtDate(r.fecha_nac)}
                        </td>
                        <td className="px-3 py-3 text-zinc-700">
                          <div className="text-zinc-800">{madre || "-"}</div>
                          <div className="text-xs text-zinc-500">
                            {r.dnimadre ?? "-"}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-zinc-700">
                          <div className="text-zinc-800">{padre || "-"}</div>
                          <div className="text-xs text-zinc-500">
                            {r.dni_padre ?? "-"}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-zinc-700">
                          {r.eess_ua ?? "-"}
                        </td>
                        <td className="px-3 py-3 text-zinc-700">
                          {r.direccion ?? "-"}
                        </td>
                        <td className="px-3 py-3 text-zinc-700">
                          {r.referencia ?? "-"}
                        </td>
                        <td className="px-3 py-3 text-zinc-700">
                          {fmtDate(ultima)}
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && (payload?.rows?.length ?? 0) === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-10 text-center text-zinc-500"
                        colSpan={9}
                      >
                        Sin registros asignados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

