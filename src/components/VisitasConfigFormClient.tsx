"use client";

import { useActionState, useMemo } from "react";

type State = { ok: true; message: string } | { ok: false; message: string } | null;

export function VisitasConfigFormClient(props: { cfg: Record<string, any>; action: any }) {
  const [state, act, pending] = useActionState<State, FormData>(props.action as any, null);
  const msg = useMemo(() => state?.message ?? "", [state]);

  const cols: Array<[string, string, boolean]> = [
    ["col_ubigeo", "Ubigeo", true],
    ["col_dni_nino", "DNI niño", true],
    ["col_fecha_intervencion", "Fecha intervención", true],
    ["col_visitas_completas", "Visitas completas para la edad", false],
    ["col_etapa_text", "Etapa (texto)", false],
    ["col_dispositivo", "Dispositivo intervención", false],
    ["col_estado_intervencion", "Estado intervención", false],
    ["col_latitud", "Latitud intervención", false],
    ["col_longitud", "Longitud intervención", false],
  ];

  return (
    <form action={act} className="mt-6 space-y-6">
      {msg ? (
        <div
          className={
            "rounded-xl px-4 py-3 text-sm " +
            (state?.ok
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border border-red-200 bg-red-50 text-red-800")
          }
        >
          {msg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-zinc-900">Hoja (índice)</label>
          <input
            name="sheet_index"
            type="number"
            min={0}
            max={50}
            required
            defaultValue={props.cfg.sheet_index}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900">Fila inicio</label>
          <input
            name="start_row"
            type="number"
            min={1}
            max={5000}
            required
            defaultValue={props.cfg.start_row}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      <div className="text-xs text-zinc-600">
        Columnas en número (A=1, B=2, ...). Si una columna no existe, déjala vacía.
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cols.map(([name, label, required]) => (
          <div key={name}>
            <label className="block text-sm font-medium text-zinc-900">{label}</label>
            <input
              name={name}
              defaultValue={props.cfg[name] ?? ""}
              required={required}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2">
        <a
          href="/admin/visitas"
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
        >
          Volver
        </a>
        <button
          disabled={pending}
          className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}

