"use client";

import { useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  total_rows: number;
  processed_rows: number;
  inserted_rows: number;
  file_name: string | null;
  started_at: string | null;
  finished_at: string | null;
  message: string | null;
};

function formatNum(n: number) {
  return new Intl.NumberFormat("es-PE").format(n);
}

export function TamizajeExcelImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);

  const requiredCols = useMemo(
    () => [
      "Id_Cita",
      "Lote",
      "UPS",
      "NOMBRE_PERSONAL",
      "Nombre_Registrador",
      "periodo",
      "renaes",
      "Red",
      "MicroRed",
      "Provincia",
      "Distrito",
      "Tipo_documento",
      "dni",
      "sexo",
      "fecha_nacimiento",
      "Fecha_Atencion",
      "PESO",
      "TALLA",
      "HEMOGLOBINA",
      "gruporiesgo_desc",
      "condicion_gestante",
      "Tipo_Edad_PAC",
      "ANIO_ACTUAL_PAC",
      "MES_ACTUAL_PAC",
      "DIA_ACTUAL_PAC",
      "Nombre_Establecimiento",
      "CIE_10",
      "Diagnostico",
      "LAB1",
      "LAB2",
      "LAB3",
      "RESULTADO",
      "TOTAL",
    ],
    [],
  );

  const upload = async () => {
    if (!file) return;
    setPending(true);
    setError(null);
    setJob(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/tamizaje/import", { method: "POST", body: fd });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        setError((data && data.error) || "No se pudo iniciar la importación.");
        return;
      }
      setJobId(String(data.jobId));
    } catch {
      setError("No se pudo subir el archivo. Intenta nuevamente.");
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/tamizaje/jobs/${encodeURIComponent(jobId)}`, {
          cache: "no-store",
        });
        const data = await r.json().catch(() => null);
        if (!alive) return;
        if (r.ok && data?.job) setJob(data.job as Job);
      } catch {}
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [jobId]);

  const pct = Math.max(0, Math.min(100, Number(job?.progress ?? 0)));
  const statusLabel =
    job?.status === "queued"
      ? "En cola"
      : job?.status === "running"
        ? "Procesando"
        : job?.status === "done"
          ? "Finalizado"
          : job?.status === "failed"
            ? "Fallido"
            : "-";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">Plantilla requerida</div>
        <div className="mt-1 text-sm text-zinc-600">
          El importador valida encabezados. Si no coinciden, la carga se detiene.
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {requiredCols.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800 ring-1 ring-zinc-200"
            >
              {c}
            </span>
          ))}
        </div>
        <div className="mt-3 text-xs text-zinc-500">
          Importación en segundo plano: reemplaza toda la data previa (limpia la tabla y carga
          la nueva).
        </div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-900">
              Archivo Excel (.xlsx/.xls)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              disabled={pending}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm"
            />
          </div>
          <button
            type="button"
            disabled={!file || pending}
            onClick={upload}
            className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {pending ? "Iniciando..." : "Iniciar carga"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        {jobId ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  Progreso: {statusLabel}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Job: <span className="font-mono">{jobId}</span>
                </div>
              </div>
              <div className="text-sm text-zinc-700">
                {job ? (
                  <>
                    {formatNum(job.processed_rows)} / {formatNum(job.total_rows)} · Insertados:{" "}
                    <span className="font-semibold">{formatNum(job.inserted_rows)}</span>
                  </>
                ) : (
                  "Cargando estado..."
                )}
              </div>
            </div>

            <div className="mt-3 h-3 w-full rounded-full bg-zinc-100 overflow-hidden">
              <div
                className={
                  "h-3 " +
                  (job?.status === "failed"
                    ? "bg-rose-600"
                    : job?.status === "done"
                      ? "bg-emerald-600"
                      : "bg-blue-600")
                }
                style={{ width: `${pct}%` }}
              />
            </div>

            {job?.message ? (
              <div className="mt-3 text-sm text-zinc-700">{job.message}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

