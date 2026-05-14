"use client";

import { useActionState } from "react";
import { FormSubmitButton } from "@/components/FormSubmitButton";

type State = { ok: false; message: string } | null;

export function MesForm(props: {
  action: any;
  initial?: {
    idmeses?: number;
    numero_mes?: number;
    meses?: string;
    year?: number;
    seleccion?: number | null;
  };
}) {
  const { action, initial } = props;
  const [state, formAction] = useActionState<State, FormData>(action, null);

  return (
    <form action={formAction as any} className="flex flex-col gap-4">
      {state && !state.ok ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {state.message}
        </div>
      ) : null}

      {typeof initial?.idmeses === "number" ? (
        <input type="hidden" name="idmeses" value={String(initial.idmeses)} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-zinc-900">
            Número de mes
          </label>
          <input
            name="numero_mes"
            type="number"
            min={1}
            max={12}
            defaultValue={initial?.numero_mes ?? ""}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900">Año</label>
          <input
            name="year"
            type="number"
            min={2000}
            max={2100}
            defaultValue={initial?.year ?? ""}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-zinc-900">
            Nombre del mes
          </label>
          <input
            name="meses"
            defaultValue={initial?.meses ?? ""}
            placeholder="Ej: Enero"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      {typeof initial?.idmeses !== "number" ? (
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
        />
      </div>
    </form>
  );
}

