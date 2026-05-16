"use client";

import { useMemo, useState } from "react";

type MesOption = {
  key: string;
  etapa: string;
  label: string;
  seleccion: boolean;
};

export function PadronExcelReportClient(props: {
  role: string;
  meses: MesOption[];
  defaultEtapas: string[];
}) {
  const { role, meses, defaultEtapas } = props;
  const [tipo, setTipo] = useState<"1" | "2">("1");
  const [selectedEtapas, setSelectedEtapas] = useState<string[]>(
    defaultEtapas.length ? defaultEtapas : meses.slice(0, 1).map((m) => m.etapa),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byEtapa = useMemo(() => {
    const map = new Map<string, MesOption>();
    for (const m of meses) map.set(m.etapa, m);
    return map;
  }, [meses]);

  const toggleEtapa = (etapa: string) => {
    setSelectedEtapas((prev) => {
      const has = prev.includes(etapa);
      if (has) return prev.filter((e) => e !== etapa);
      return [...prev, etapa];
    });
  };

  const download = async () => {
    setError(null);
    const etapas = selectedEtapas
      .map((e) => String(e).trim())
      .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e));
    if (!etapas.length) {
      setError("Selecciona al menos un mes.");
      return;
    }
    setPending(true);
    try {
      const url = new URL("/api/reportes/padron-excel", window.location.origin);
      url.searchParams.set("tipo", tipo);
      url.searchParams.set("etapas", etapas.join(","));
      window.location.href = url.toString();
    } finally {
      setTimeout(() => setPending(false), 800);
    }
  };

  const tipoLabel = tipo === "1" ? "Niños" : "Gestantes";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">Filtros</div>
        <div className="mt-1 text-sm text-zinc-600">
          {role === "SUPER ADMIN"
            ? "Descarga registros de todos los ubigeos."
            : "Descarga registros del ubigeo de tu cuenta."}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
            <label className="block text-sm font-medium text-zinc-900">
              Tipo
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value === "2" ? "2" : "1")}
              disabled={pending}
              className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            >
              <option value="1">Niños (tipovd=1)</option>
              <option value="2">Gestantes (tipovd=2)</option>
            </select>
            <div className="mt-2 text-xs text-zinc-500">
              El reporte incluirá toda la información del padrón, más actor social,
              responsable y ocurrencias.
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl bg-white ring-1 ring-black/5 p-4">
            <div className="text-sm font-medium text-zinc-900">
              Meses (etapa)
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Seleccionados:{" "}
              <span className="font-semibold">{selectedEtapas.length}</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {meses.map((m) => {
                const checked = selectedEtapas.includes(m.etapa);
                return (
                  <label
                    key={m.key}
                    className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={pending}
                      onChange={() => toggleEtapa(m.etapa)}
                      className="h-4 w-4"
                    />
                    <span className="truncate">
                      {m.label}
                      {m.seleccion ? " (seleccionado)" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              Descargar reporte
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Tipo: <span className="font-semibold">{tipoLabel}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={download}
            disabled={pending}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {pending ? "Generando..." : "Descargar Excel"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        {selectedEtapas.length ? (
          <div className="mt-4 text-xs text-zinc-500">
            Etapas:{" "}
            {selectedEtapas
              .slice()
              .sort()
              .map((e) => byEtapa.get(e)?.label ?? e)
              .join(" · ")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

