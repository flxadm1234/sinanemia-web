"use client";

import { useMemo, useState } from "react";

type ConsultaTamizajePadronRow = {
  idpn: number;
  dni: string;
  nombres: string | null;
  fecha_nac: string | null;
  etapa: string | null;
  ubigeo: number | null;
  eess_ua: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  actorsocial_dni: string | null;
  actorsocial_nombre: string | null;
  responsable_dni: string | null;
  responsable_nombre: string | null;
};

type ConsultaTamizajeRegistroRow = {
  id: number;
  fecha_atencion: string | null;
  fecha_registro: string | null;
  hemoglobina: string | null;
  cie_10: string | null;
  diagnostico: string | null;
  lab1: string | null;
  lab2: string | null;
  lab3: string | null;
  resultado: string | null;
  nombre_establecimiento: string | null;
  provincia: string | null;
  distrito: string | null;
  nombre_registrador: string | null;
  nombre_personal: string | null;
  ups: string | null;
  renaes: string | null;
  total: number | null;
};

type ConsultaTamizajeResult = {
  dni: string;
  padron: ConsultaTamizajePadronRow[];
  tamizajes: ConsultaTamizajeRegistroRow[];
};

function fmt(v: unknown) {
  const s = String(v ?? "").trim();
  return s || "-";
}

function small(v: unknown) {
  const s = String(v ?? "").trim();
  return s || "";
}

export function ConsultaTamizajeClient() {
  const [dni, setDni] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ConsultaTamizajeResult | null>(null);

  const padronLatest = useMemo(() => {
    if (!data?.padron?.length) return null;
    return data.padron[0];
  }, [data]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = dni.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/consulta-tamizaje?dni=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ? String(json.error) : "error");
        return;
      }
      setData(json.data as ConsultaTamizajeResult);
    } catch (err: any) {
      setError(err?.message ? String(err.message) : "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
        <div className="text-sm font-semibold text-zinc-900">Consulta de tamizaje</div>
        <div className="mt-1 text-xs text-zinc-500">
          Ingresa el DNI y revisa el padrón (meses) + historial de HIS (tamizajes).
        </div>

        <form onSubmit={onSearch} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-zinc-700">DNI</label>
            <input
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Ej: 12345678"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500"
              inputMode="numeric"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !dni.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </form>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {error === "not_found"
              ? "No se encontró el DNI en el padrón de tu ubigeo."
              : error === "forbidden"
                ? "No tienes permisos para usar esta consulta."
                : "No se pudo completar la consulta."}
          </div>
        ) : null}
      </div>

      {padronLatest ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5 lg:col-span-1">
            <div className="text-sm font-semibold text-zinc-900">Niño</div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="text-zinc-600">DNI</div>
                <div className="font-semibold text-zinc-900">{fmt(padronLatest.dni)}</div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="text-zinc-600">Nombres</div>
                <div className="text-right font-semibold text-zinc-900">{fmt(padronLatest.nombres)}</div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="text-zinc-600">F. Nac.</div>
                <div className="font-semibold text-zinc-900">{fmt(padronLatest.fecha_nac)}</div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="text-zinc-600">Ubigeo</div>
                <div className="font-semibold text-zinc-900">{fmt(padronLatest.ubigeo)}</div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="text-zinc-600">Última etapa</div>
                <div className="font-semibold text-zinc-900">{fmt(padronLatest.etapa)}</div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="text-zinc-600">EESS</div>
                <div className="text-right font-semibold text-zinc-900">{fmt(padronLatest.eess_ua)}</div>
              </div>
              <div className="pt-2 border-t border-zinc-100">
                <div className="text-xs font-semibold text-zinc-900">Actor social</div>
                <div className="mt-1 text-sm text-zinc-800">
                  {fmt(padronLatest.actorsocial_nombre)}{" "}
                  <span className="text-zinc-500">{small(padronLatest.actorsocial_dni)}</span>
                </div>
                <div className="mt-3 text-xs font-semibold text-zinc-900">Responsable</div>
                <div className="mt-1 text-sm text-zinc-800">
                  {fmt(padronLatest.responsable_nombre)}{" "}
                  <span className="text-zinc-500">{small(padronLatest.responsable_dni)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">Historial en padrón</div>
                <div className="mt-1 text-xs text-zinc-500">
                  Muestra en qué meses (etapa) estuvo cargado y con qué asignación.
                </div>
              </div>
              <div className="text-xs text-zinc-600">
                Registros: <span className="font-semibold text-zinc-900">{data?.padron?.length ?? 0}</span>
              </div>
            </div>

            <div className="mt-4 overflow-auto">
              <table className="min-w-[900px] text-sm">
                <thead className="bg-zinc-50 text-left text-zinc-600">
                  <tr>
                    <th className="px-3 py-2">Etapa</th>
                    <th className="px-3 py-2">Ubigeo</th>
                    <th className="px-3 py-2">EESS</th>
                    <th className="px-3 py-2">Actor social</th>
                    <th className="px-3 py-2">Responsable</th>
                    <th className="px-3 py-2">Distrito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data?.padron?.map((p) => (
                    <tr key={`${p.idpn}-${p.etapa}`}>
                      <td className="px-3 py-2 font-semibold text-zinc-900">{fmt(p.etapa)}</td>
                      <td className="px-3 py-2 text-zinc-700">{fmt(p.ubigeo)}</td>
                      <td className="px-3 py-2 text-zinc-700">{fmt(p.eess_ua)}</td>
                      <td className="px-3 py-2 text-zinc-700">
                        {fmt(p.actorsocial_nombre)}{" "}
                        <span className="text-xs text-zinc-500">{small(p.actorsocial_dni)}</span>
                      </td>
                      <td className="px-3 py-2 text-zinc-700">
                        {fmt(p.responsable_nombre)}{" "}
                        <span className="text-xs text-zinc-500">{small(p.responsable_dni)}</span>
                      </td>
                      <td className="px-3 py-2 text-zinc-700">{fmt(p.distrito)}</td>
                    </tr>
                  ))}
                  {!data?.padron?.length ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-zinc-500" colSpan={6}>
                        Sin datos del padrón.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900">Historial de tamizajes (HIS)</div>
              <div className="mt-1 text-xs text-zinc-500">
                Se listan todos los registros encontrados en la tabla registro_tamizaje para el DNI consultado.
              </div>
            </div>
            <div className="text-xs text-zinc-600">
              Registros: <span className="font-semibold text-zinc-900">{data.tamizajes.length}</span>
            </div>
          </div>

          <div className="mt-4 overflow-auto">
            <table className="min-w-[1400px] text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-600">
                <tr>
                  <th className="px-3 py-2">F. atención</th>
                  <th className="px-3 py-2">F. registro</th>
                  <th className="px-3 py-2">Hb</th>
                  <th className="px-3 py-2">CIE10</th>
                  <th className="px-3 py-2">Diagnóstico</th>
                  <th className="px-3 py-2">Resultado</th>
                  <th className="px-3 py-2">LAB1</th>
                  <th className="px-3 py-2">LAB2</th>
                  <th className="px-3 py-2">LAB3</th>
                  <th className="px-3 py-2">Establecimiento</th>
                  <th className="px-3 py-2">Registrador</th>
                  <th className="px-3 py-2">Personal</th>
                  <th className="px-3 py-2">UPS</th>
                  <th className="px-3 py-2">RENAES</th>
                  <th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.tamizajes.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 font-semibold text-zinc-900">{fmt(t.fecha_atencion)}</td>
                    <td className="px-3 py-2 text-zinc-700">{fmt(t.fecha_registro)}</td>
                    <td className="px-3 py-2 text-zinc-700">{fmt(t.hemoglobina)}</td>
                    <td className="px-3 py-2 text-zinc-700">{fmt(t.cie_10)}</td>
                    <td className="px-3 py-2 text-zinc-700">{fmt(t.diagnostico)}</td>
                    <td className="px-3 py-2 text-zinc-700">{fmt(t.resultado)}</td>
                    <td className="px-3 py-2 text-zinc-700">{fmt(t.lab1)}</td>
                    <td className="px-3 py-2 text-zinc-700">{fmt(t.lab2)}</td>
                    <td className="px-3 py-2 text-zinc-700">{fmt(t.lab3)}</td>
                    <td className="px-3 py-2 text-zinc-700">{fmt(t.nombre_establecimiento)}</td>
                    <td className="px-3 py-2 text-zinc-700">{fmt(t.nombre_registrador)}</td>
                    <td className="px-3 py-2 text-zinc-700">{fmt(t.nombre_personal)}</td>
                    <td className="px-3 py-2 text-zinc-700">{fmt(t.ups)}</td>
                    <td className="px-3 py-2 text-zinc-700">{fmt(t.renaes)}</td>
                    <td className="px-3 py-2 text-zinc-700">{t.total == null ? "-" : String(t.total)}</td>
                  </tr>
                ))}
                {!data.tamizajes.length ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-zinc-500" colSpan={15}>
                      No se encontraron registros de tamizaje para este DNI.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

