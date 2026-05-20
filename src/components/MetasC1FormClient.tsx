"use client";

import { useActionState, useMemo } from "react";

type State = { ok: true; message: string } | { ok: false; message: string } | null;

export function MetasC1FormClient(props: {
  userTipo: string;
  ubigeo: string;
  items: Array<{ tipo: number; descripcion_meta: string; valla_min: number }>;
  action: any;
}) {
  const [state, act, pending] = useActionState<State, FormData>(props.action as any, null);
  const msg = useMemo(() => state?.message ?? "", [state]);

  return (
    <form action={act} className="mt-6 space-y-5">
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

      {props.userTipo === "SUPER ADMIN" || props.userTipo === "SUPERVISOR" ? (
        <div>
          <label className="block text-sm font-medium text-zinc-900">Ubigeo</label>
          <input
            name="ubigeo"
            defaultValue={props.ubigeo}
            maxLength={6}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
      ) : (
        <input type="hidden" name="ubigeo" value={props.ubigeo} />
      )}

      {props.items.map((it) => (
        <div key={it.tipo} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="text-sm font-semibold text-zinc-900">Tipo {it.tipo}</div>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-zinc-700">Descripción</label>
              <input
                name={`descripcion_${it.tipo}`}
                defaultValue={it.descripcion_meta}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-zinc-700">Meta (%)</label>
              <input
                name={`valla_${it.tipo}`}
                type="number"
                min={0}
                max={100}
                required
                defaultValue={it.valla_min}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-end">
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

