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
  ubigeos?: number[];
}) {
  const { role, meses, defaultEtapas, ubigeos = [] } = props;
  const [tipo, setTipo] = useState<"1" | "2">("1");
  const [selectedEtapas, setSelectedEtapas] = useState<string[]>(
    defaultEtapas.length ? defaultEtapas : meses.slice(0, 1).map((m) => m.etapa),
  );
  const [selectedUbigeos, setSelectedUbigeos] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [jobMsg, setJobMsg] = useState<string>("");
  const [jobPct, setJobPct] = useState<number>(0);

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

  const toggleUbigeo = (u: number) => {
    setSelectedUbigeos((prev) => {
      const has = prev.includes(u);
      if (has) return prev.filter((x) => x !== u);
      return [...prev, u];
    });
  };

  const download = async () => {
    setError(null);
    setJobId(null);
    setJobMsg("");
    setJobPct(0);
    const etapas = selectedEtapas
      .map((e) => String(e).trim())
      .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e));
    if (!etapas.length) {
      setError("Selecciona al menos un mes.");
      return;
    }
    setPending(true);
    try {
      const payload: any = { tipo, etapas };
      if (role === "SUPER ADMIN" && selectedUbigeos.length) {
        payload.ubigeos = selectedUbigeos.slice().sort((a, b) => a - b);
      }

      const res = await fetch("/api/reportes/padron-excel-async/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "No se pudo iniciar la descarga"));
      const id = Number(data?.jobId ?? 0);
      if (!Number.isFinite(id) || id <= 0) throw new Error("No se pudo iniciar la descarga");
      setJobId(id);
      setJobMsg("Generando Excel...");
      setJobPct(1);

      const start = Date.now();
      let tries = 0;
      while (true) {
        tries += 1;
        const st = await fetch(`/api/reportes/padron-excel-async/jobs/${id}`, { cache: "no-store" });
        const js = await st.json();
        if (!st.ok) throw new Error(String(js?.error || "No se pudo obtener el estado del reporte"));
        const status = String(js?.status || "");
        const progress = Number(js?.progress ?? 0);
        const message = String(js?.message ?? "");
        setJobPct(Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0);
        setJobMsg(message || (status === "done" ? "Listo" : "Procesando..."));

        if (status === "done" && js?.ready) {
          const url = new URL(`/api/reportes/padron-excel-async/jobs/${id}/download`, window.location.origin);
          window.location.href = url.toString();
          break;
        }
        if (status === "failed") {
          throw new Error(message || "No se pudo generar el reporte");
        }
        if (Date.now() - start > 15 * 60 * 1000) {
          throw new Error("La generación está demorando demasiado. Inténtalo nuevamente.");
        }
        if (tries > 600) {
          throw new Error("La generación está demorando demasiado. Inténtalo nuevamente.");
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
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
            ? selectedUbigeos.length
              ? `Descarga registros de ${selectedUbigeos.length} ubigeo(s) seleccionado(s).`
              : "Descarga registros de todos los ubigeos."
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

        {role === "SUPER ADMIN" ? (
          <div className="mt-4 rounded-2xl bg-white ring-1 ring-black/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-zinc-900">Ubigeos</div>
              <button
                type="button"
                disabled={pending}
                onClick={() => setSelectedUbigeos([])}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
              >
                Todos
              </button>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Si no eliges ninguno, se descargan todos.
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {ubigeos.map((u) => {
                const checked = selectedUbigeos.includes(u);
                return (
                  <label
                    key={u}
                    className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={pending}
                      onChange={() => toggleUbigeo(u)}
                      className="h-4 w-4"
                    />
                    <span className="truncate">{String(u).padStart(6, "0")}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
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

        {pending && (jobId || jobMsg) ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <div className="text-sm font-semibold text-zinc-900">Generación en curso</div>
            <div className="mt-1 text-sm text-zinc-700">
              {jobMsg || "Procesando..."}
              {jobId ? <span className="ml-2 text-xs text-zinc-500">(Job #{jobId})</span> : null}
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full bg-blue-700" style={{ width: `${Math.max(1, Math.min(100, jobPct))}%` }} />
            </div>
          </div>
        ) : null}

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

