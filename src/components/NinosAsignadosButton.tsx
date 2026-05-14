"use client";

import { useEffect, useMemo, useState } from "react";

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
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function NinosAsignadosButton(props: {
  actorDni: string;
  actorNombre?: string;
  count: number;
}) {
  const { actorDni, actorNombre, count } = props;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<AsignadosPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    const n = (actorNombre ?? "").trim();
    return n ? n : actorDni;
  }, [actorNombre, actorDni]);

  useEffect(() => {
    if (!open) return;
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
      >
        {count}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-zinc-900">
                  Hoja de ruta - niños asignados
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  Actor social: <span className="font-semibold">{title}</span>
                  {payload?.etapa ? (
                    <>
                      {" "}
                      · Etapa: <span className="font-semibold">{payload.etapa}</span>
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
                  href={`/api/padronnominal/asignados/pdf?actor=${encodeURIComponent(actorDni)}`}
                  target="_blank"
                  rel="noreferrer"
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
                        <td className="px-3 py-3 text-zinc-800">{r.nombres ?? "-"}</td>
                        <td className="px-3 py-3 text-zinc-700">{fmtDate(r.fecha_nac)}</td>
                        <td className="px-3 py-3 text-zinc-700">
                          <div className="text-zinc-800">{madre || "-"}</div>
                          <div className="text-xs text-zinc-500">{r.dnimadre ?? "-"}</div>
                        </td>
                        <td className="px-3 py-3 text-zinc-700">
                          <div className="text-zinc-800">{padre || "-"}</div>
                          <div className="text-xs text-zinc-500">{r.dni_padre ?? "-"}</div>
                        </td>
                        <td className="px-3 py-3 text-zinc-700">{r.eess_ua ?? "-"}</td>
                        <td className="px-3 py-3 text-zinc-700">{r.direccion ?? "-"}</td>
                        <td className="px-3 py-3 text-zinc-700">{r.referencia ?? "-"}</td>
                        <td className="px-3 py-3 text-zinc-700">{fmtDate(ultima)}</td>
                      </tr>
                    );
                  })}
                  {!loading && (payload?.rows?.length ?? 0) === 0 ? (
                    <tr>
                      <td className="px-3 py-10 text-center text-zinc-500" colSpan={9}>
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

