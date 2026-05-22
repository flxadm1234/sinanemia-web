"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { FormSubmitButton } from "@/components/FormSubmitButton";

type State = { ok: false; message: string } | null;

const MONTHS = [
  { n: 1, name: "ENERO" },
  { n: 2, name: "FEBRERO" },
  { n: 3, name: "MARZO" },
  { n: 4, name: "ABRIL" },
  { n: 5, name: "MAYO" },
  { n: 6, name: "JUNIO" },
  { n: 7, name: "JULIO" },
  { n: 8, name: "AGOSTO" },
  { n: 9, name: "SETIEMBRE" },
  { n: 10, name: "OCTUBRE" },
  { n: 11, name: "NOVIEMBRE" },
  { n: 12, name: "DICIEMBRE" },
];

function monthName(n: number) {
  return MONTHS.find((m) => m.n === n)?.name ?? "";
}

export function MesForm(props: {
  action: any;
  allowUbigeo?: boolean;
  defaultUbigeo?: string;
  allowSelect?: boolean;
  initial?: {
    idmeses?: number;
    numero_mes?: number;
    meses?: string;
    year?: number;
    seleccion?: number | null;
  };
}) {
  const { action, initial, allowUbigeo, defaultUbigeo, allowSelect } = props;
  const [state, formAction] = useActionState<State, FormData>(action, null);
  const isEdit = typeof initial?.idmeses === "number";

  const [ubigeo, setUbigeo] = useState(defaultUbigeo ?? "");
  const [year, setYear] = useState(String(initial?.year ?? ""));
  const [numeroMes, setNumeroMes] = useState(String(initial?.numero_mes ?? ""));
  const [meses, setMeses] = useState(
    initial?.meses ? String(initial.meses) : monthName(Number(initial?.numero_mes ?? 0)),
  );
  const [existing, setExisting] = useState<number[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const existingSet = useMemo(() => new Set(existing), [existing]);
  const selectedNumeroMes = Number(numeroMes);
  const isDuplicateSelected =
    !isEdit && Number.isFinite(selectedNumeroMes) && existingSet.has(selectedNumeroMes);

  useEffect(() => {
    if (isEdit) return;
    if (!allowUbigeo && defaultUbigeo) setUbigeo(defaultUbigeo);
  }, [allowUbigeo, defaultUbigeo, isEdit]);

  useEffect(() => {
    if (isEdit) return;
    const u = String(ubigeo ?? "").trim();
    const y = Number(year);
    if (!/^\d{6}$/.test(u) || !Number.isFinite(y)) {
      setExisting([]);
      return;
    }
    let cancelled = false;
    setLoadingExisting(true);
    fetch(`/api/meses/existing?ubigeo=${encodeURIComponent(u)}&year=${encodeURIComponent(String(y))}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const arr = Array.isArray(j?.existing) ? j.existing : [];
        setExisting(
          arr
            .map((n: any) => Number(n))
            .filter((n: number) => Number.isFinite(n) && n >= 1 && n <= 12),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setExisting([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowUbigeo, isEdit, ubigeo, year]);

  useEffect(() => {
    if (isEdit) return;
    const n = Number(numeroMes);
    if (!Number.isFinite(n)) return;
    const nm = monthName(n);
    if (nm) setMeses(nm);
  }, [isEdit, numeroMes]);

  return (
    <form action={formAction as any} className="flex flex-col gap-4">
      {state && !state.ok ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {state.message}
        </div>
      ) : null}

      {isDuplicateSelected ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ese mes ya existe para este ubigeo y año.
        </div>
      ) : null}

      {typeof initial?.idmeses === "number" ? (
        <input type="hidden" name="idmeses" value={String(initial.idmeses)} />
      ) : null}

      {allowUbigeo ? (
        <div>
          <label className="block text-sm font-medium text-zinc-900">
            Ubigeo
          </label>
          <input
            name="ubigeo"
            maxLength={6}
            value={ubigeo}
            onChange={(e) => setUbigeo(e.currentTarget.value)}
            placeholder="Ej: 160101"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
      ) : defaultUbigeo ? (
        <input type="hidden" name="ubigeo" value={defaultUbigeo} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-zinc-900">
            Número de mes
          </label>
          {isEdit ? (
            <input
              name="numero_mes"
              type="number"
              min={1}
              max={12}
              defaultValue={initial?.numero_mes ?? ""}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          ) : (
            <select
              name="numero_mes"
              value={numeroMes}
              onChange={(e) => setNumeroMes(e.currentTarget.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-zinc-50"
              disabled={loadingExisting}
            >
              <option value="">Selecciona…</option>
              {MONTHS.map((m) => (
                <option key={m.n} value={String(m.n)} disabled={existingSet.has(m.n)}>
                  {String(m.n).padStart(2, "0")} · {m.name}
                </option>
              ))}
            </select>
          )}
          {!isEdit && loadingExisting ? (
            <div className="mt-1 text-xs text-zinc-500">Cargando meses existentes…</div>
          ) : null}
          {!isEdit && !loadingExisting && /^\d{6}$/.test(String(ubigeo).trim()) && year.trim() ? (
            <div className="mt-1 text-xs text-zinc-500">
              Meses ya creados:{" "}
              <span className="font-semibold">
                {existing.length ? existing.map((n) => String(n).padStart(2, "0")).join(", ") : "—"}
              </span>
            </div>
          ) : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900">Año</label>
          <input
            name="year"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.currentTarget.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-zinc-900">
            Nombre del mes
          </label>
          <input
            name="meses"
            value={meses}
            onChange={(e) => setMeses(e.currentTarget.value)}
            placeholder="Ej: Enero"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            readOnly={!isEdit}
          />
        </div>
      </div>

      {typeof initial?.idmeses !== "number" && allowSelect !== false ? (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="seleccion"
            value="1"
            defaultChecked={Number(initial?.seleccion ?? 0) === 1}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Marcar como mes seleccionado
        </label>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <FormSubmitButton
          label="Guardar"
          pendingLabel="Guardando..."
          className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          disabled={isDuplicateSelected}
        />
      </div>
    </form>
  );
}

