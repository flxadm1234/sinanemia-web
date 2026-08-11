"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Job = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  total_rows: number;
  processed_rows: number;
  inserted_rows: number;
  message: string | null;
};

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function monthStartFromYYYYMM(ym: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) return "";
  return `${m[1]}-${m[2]}-01`;
}

export function PadronDniExcelImportClient() {
  const today = useMemo(() => isoDate(new Date()), []);
  const defaultMonth = useMemo(() => today.slice(0, 7), [today]);

  const [month, setMonth] = useState<string>(defaultMonth);
  const [modo, setModo] = useState<"inicio" | "avance">("inicio");
  const [fechaCorte, setFechaCorte] = useState<string>(() => monthStartFromYYYYMM(defaultMonth));

  const [fileActivo, setFileActivo] = useState<File | null>(null);
  const [fileObs, setFileObs] = useState<File | null>(null);
  const [fileTran, setFileTran] = useState<File | null>(null);
  const [updatePadron, setUpdatePadron] = useState(false);

  const [jobId, setJobId] = useState<string>("");
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const timer = useRef<any>(null);

  const monthStart = useMemo(() => monthStartFromYYYYMM(month), [month]);

  useEffect(() => {
    if (modo === "inicio") {
      setFechaCorte(monthStart);
      return;
    }
    if (!fechaCorte) {
      setFechaCorte(today);
      return;
    }
    if (fechaCorte.slice(0, 7) !== month) setFechaCorte(today.slice(0, 7) === month ? today : monthStart);
  }, [modo, month, monthStart, today]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/padron-dni/jobs/${encodeURIComponent(jobId)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Error consultando job");
        const j = data?.job as Job;
        if (!cancelled) setJob(j);
        if (j.status === "done" || j.status === "failed") return;
        timer.current = setTimeout(poll, 1500);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      }
    };
    poll();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [jobId]);

  const progressText = useMemo(() => {
    if (!job) return "";
    const total = job.total_rows || 0;
    const processed = job.processed_rows || 0;
    const inserted = job.inserted_rows || 0;
    return `${processed} / ${total} · Insertados: ${inserted}`;
  }, [job]);

  const onStart = async () => {
    setError("");
    setJob(null);
    if (!monthStart) {
      setError("Selecciona el mes.");
      return;
    }
    if (!fechaCorte) {
      setError("Selecciona la fecha de corte.");
      return;
    }
    if (fechaCorte.slice(0, 7) !== month) {
      setError("La fecha de corte debe pertenecer al mes seleccionado.");
      return;
    }
    if (modo === "inicio" && fechaCorte !== monthStart) {
      setError("Para inicio de mes, la fecha de corte debe ser el día 01 del mes seleccionado.");
      return;
    }
    if (modo === "avance" && fechaCorte === monthStart) {
      setError("Para avance, la fecha de corte no puede ser el día 01 del mes.");
      return;
    }
    if (updatePadron && modo !== "inicio") {
      setError("La opción de actualizar padrón nominal solo está disponible para Inicio de mes.");
      return;
    }
    if (!fileActivo) {
      setError("Debes adjuntar el archivo Activo.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("modo", modo);
      fd.append("fecha_corte", fechaCorte);
      fd.append("update_padron", updatePadron ? "1" : "0");
      fd.append("file_activo", fileActivo);
      if (fileObs) fd.append("file_activo_observado", fileObs);
      if (fileTran) fd.append("file_transito", fileTran);
      const res = await fetch("/api/padron-dni/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo iniciar la carga");
      setJobId(String(data.jobId || ""));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mt-1 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-900">Mes</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-900">Fecha de corte</label>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="radio"
                name="modo"
                checked={modo === "inicio"}
                onChange={() => setModo("inicio")}
              />
              Inicio de mes (día 01)
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="radio"
                name="modo"
                checked={modo === "avance"}
                onChange={() => setModo("avance")}
              />
              Avance / final
            </label>
          </div>
          <input
            type="date"
            value={fechaCorte}
            onChange={(e) => setFechaCorte(e.target.value)}
            disabled={modo === "inicio"}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-zinc-100"
          />
          <div className="mt-1 text-xs text-zinc-500">
            Se permite máximo 2 cortes por mes y ubigeo: día 01 e 1 fecha de avance.
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-zinc-900">Activo (obligatorio)</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFileActivo(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-xl file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800"
          />
          {fileActivo ? (
            <div className="mt-1 text-xs text-zinc-500">Seleccionado: {fileActivo.name}</div>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-900">Activo - Observado (opcional)</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFileObs(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-xl file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800"
          />
          {fileObs ? (
            <div className="mt-1 text-xs text-zinc-500">Seleccionado: {fileObs.name}</div>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-900">Tránsito (opcional)</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFileTran(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-xl file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800"
          />
          {fileTran ? (
            <div className="mt-1 text-xs text-zinc-500">Seleccionado: {fileTran.name}</div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <label className="inline-flex items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={updatePadron}
            onChange={(e) => setUpdatePadron(e.target.checked)}
            disabled={modo !== "inicio"}
          />
          Actualizar nómina del mes seleccionado (padronnominal)
        </label>
        <div className="mt-1 text-xs text-zinc-500">
          Solo disponible para Inicio de mes. Completa nombres/madre/padre y teléfono en padronnominal cuando estén vacíos.
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end">
        <button
          type="button"
          disabled={loading}
          onClick={onStart}
          className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {loading ? "Iniciando..." : "Guardar"}
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
        <div className="text-sm font-semibold text-zinc-900">
          Progreso:{" "}
          <span className="font-semibold">
            {job?.status === "queued"
              ? "En cola"
              : job?.status === "running"
                ? "Procesando"
                : job?.status === "done"
                  ? "Completado"
                  : job?.status === "failed"
                    ? "Fallido"
                    : "—"}
          </span>
        </div>
        <div className="mt-1 text-xs text-zinc-600">
          Job: <span className="font-mono">{jobId || "—"}</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full bg-emerald-600"
            style={{ width: `${Math.min(100, Math.max(0, job?.progress ?? 0))}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-zinc-600">
          <div>{progressText}</div>
          <div>{job ? `${job.progress}%` : ""}</div>
        </div>
        {job?.message ? (
          <div className="mt-3 text-xs text-zinc-600">{job.message}</div>
        ) : null}
      </div>
    </div>
  );
}
