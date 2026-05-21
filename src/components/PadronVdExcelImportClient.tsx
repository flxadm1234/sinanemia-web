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

export function PadronVdExcelImportClient(props: {
  canEditConfig: boolean;
  configs: { id: number; name: string }[];
  defaultConfigId: number;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [configId, setConfigId] = useState<number>(() => props.defaultConfigId);
  const [jobId, setJobId] = useState<string>("");
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const timer = useRef<any>(null);

  const progressText = useMemo(() => {
    if (!job) return "";
    const total = job.total_rows || 0;
    const processed = job.processed_rows || 0;
    const inserted = job.inserted_rows || 0;
    return `${processed} / ${total} · Insertados: ${inserted}`;
  }, [job]);

  useEffect(() => {
    if (!props.configs?.length) return;
    if (props.configs.some((c) => c.id === configId)) return;
    setConfigId(props.defaultConfigId || props.configs[0]!.id);
  }, [configId, props.configs, props.defaultConfigId]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/padron/vd-jobs/${encodeURIComponent(jobId)}`, {
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

  const onStart = async () => {
    setError("");
    setJob(null);
    if (!props.configs?.length) {
      setError("No hay configuraciones registradas. Solicita al SUPER ADMIN crear una configuración.");
      return;
    }
    if (!file) {
      setError("Selecciona un archivo Excel.");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("config_id", String(configId || props.defaultConfigId || props.configs[0]?.id || ""));
      const res = await fetch("/api/padron/vd-import", { method: "POST", body: fd });
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-900">Carga de Excel (Padrón VD)</div>
          <div className="mt-1 text-xs text-zinc-500">
            El archivo se procesa en segundo plano en el servidor. Puedes cerrar la pestaña.
          </div>
        </div>
        {props.canEditConfig ? (
          <a
            href="/admin/carga-vd/config"
            className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Configurar columnas
          </a>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-72">
          <label className="block text-sm font-medium text-zinc-900">Configuración</label>
          <select
            value={String(configId)}
            onChange={(e) => setConfigId(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            {props.configs.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-zinc-900">
            Archivo Excel (.xlsx/.xls)
          </label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-xl file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800"
          />
          {file ? (
            <div className="mt-1 text-xs text-zinc-500">Seleccionado: {file.name}</div>
          ) : null}
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={onStart}
          className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {loading ? "Iniciando..." : "Iniciar carga"}
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

