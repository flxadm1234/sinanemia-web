"use client";

import { useMemo, useState } from "react";

type Result = {
  ok: true;
  inserted: number;
  skippedDuplicates: Array<{
    rowNumber: number;
    ubigeo: string;
    numero_mes: number;
    year: number;
  }>;
  duplicatesInFile: Array<{
    rowNumber: number;
    ubigeo: string;
    numero_mes: number;
    year: number;
  }>;
  invalid: Array<{ rowNumber: number; reason: string }>;
};

export function MesesExcelImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const requiredCols = useMemo(
    () => ["ubigeo", "mes", "nro", "año"],
    [],
  );

  const upload = async () => {
    if (!file) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/meses/import-excel", {
        method: "POST",
        body: fd,
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        setError(
          (data && typeof data.error === "string" && data.error) ||
            "No se pudo procesar el Excel.",
        );
        return;
      }
      setResult(data as Result);
    } catch {
      setError("No se pudo subir el archivo. Intenta nuevamente.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">
          Formato del Excel
        </div>
        <div className="mt-1 text-sm text-zinc-600">
          La primera hoja será importada. Encabezados recomendados:
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
          Duplicados se detectan por <span className="font-semibold">ubigeo + año + nro</span>.
        </div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-black/5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-900">
              Archivo Excel (.xlsx)
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
            {pending ? "Importando..." : "Importar Excel"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Importación terminada. Insertados:{" "}
              <span className="font-semibold">{result.inserted}</span>
              {" · "}
              Duplicados BD:{" "}
              <span className="font-semibold">{result.skippedDuplicates.length}</span>
              {" · "}
              Duplicados en Excel:{" "}
              <span className="font-semibold">{result.duplicatesInFile.length}</span>
              {" · "}
              Inválidos:{" "}
              <span className="font-semibold">{result.invalid.length}</span>
            </div>

            {result.skippedDuplicates.length ? (
              <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
                <div className="text-sm font-semibold text-zinc-900">
                  Duplicados en BD (no se registraron)
                </div>
                <div className="mt-3 overflow-auto">
                  <table className="min-w-[620px] text-sm">
                    <thead className="bg-zinc-50 text-left text-zinc-600">
                      <tr>
                        <th className="px-3 py-2">Fila</th>
                        <th className="px-3 py-2">Ubigeo</th>
                        <th className="px-3 py-2">Año</th>
                        <th className="px-3 py-2">Nro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {result.skippedDuplicates.slice(0, 50).map((r) => (
                        <tr key={`${r.rowNumber}-${r.ubigeo}-${r.year}-${r.numero_mes}`}>
                          <td className="px-3 py-2 text-zinc-700">{r.rowNumber}</td>
                          <td className="px-3 py-2 text-zinc-700">{r.ubigeo}</td>
                          <td className="px-3 py-2 text-zinc-700">{r.year}</td>
                          <td className="px-3 py-2 text-zinc-700">{r.numero_mes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {result.invalid.length ? (
              <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
                <div className="text-sm font-semibold text-zinc-900">
                  Filas inválidas (no se registraron)
                </div>
                <div className="mt-3 overflow-auto">
                  <table className="min-w-[520px] text-sm">
                    <thead className="bg-zinc-50 text-left text-zinc-600">
                      <tr>
                        <th className="px-3 py-2">Fila</th>
                        <th className="px-3 py-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {result.invalid.slice(0, 50).map((r) => (
                        <tr key={`${r.rowNumber}-${r.reason}`}>
                          <td className="px-3 py-2 text-zinc-700">{r.rowNumber}</td>
                          <td className="px-3 py-2 text-zinc-700">{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

