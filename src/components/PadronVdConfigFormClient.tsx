"use client";

import { useActionState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

type State =
  | { ok: true; message: string; newId?: number }
  | { ok: false; message: string }
  | null;

export function PadronVdConfigFormClient(props: {
  cfgId: number;
  cfg: Record<string, any>;
  configs: { id: number; name: string }[];
  action: any;
}) {
  const router = useRouter();
  const [state, act, pending] = useActionState<State, FormData>(props.action as any, null);
  const msg = useMemo(() => state?.message ?? "", [state]);

  useEffect(() => {
    if (!state || !("newId" in state)) return;
    const nid = Number((state as any).newId ?? 0);
    if (!Number.isFinite(nid) || nid <= 0) return;
    router.push(`/admin/carga-vd/config?id=${nid}`);
    router.refresh();
  }, [router, state]);

  return (
    <form action={act} className="mt-6 space-y-6">
      <input type="hidden" name="config_id" value={String(props.cfgId)} />
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
          <label className="block text-sm font-medium text-zinc-900">Configuración</label>
          <select
            value={String(props.cfgId)}
            onChange={(e) => {
              const id = Number(e.target.value);
              if (!Number.isFinite(id) || id <= 0) return;
              router.push(`/admin/carga-vd/config?id=${id}`);
            }}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            {props.configs.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-zinc-900">Nombre</label>
          <input
            name="name"
            required
            defaultValue={props.cfg.name}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-zinc-900">Ubigeo</label>
          <input
            name="col_ubigeo"
            required
            defaultValue={props.cfg.col_ubigeo}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900">DNI niño</label>
          <input
            name="col_dni"
            required
            defaultValue={props.cfg.col_dni}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900">Fecha nacimiento</label>
          <input
            name="col_fecha_nac"
            required
            defaultValue={props.cfg.col_fecha_nac}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      {[
        ["col_departamento", "Departamento"],
        ["col_provincia", "Provincia"],
        ["col_distrito", "Distrito"],
        ["col_actorsocial", "Actor social (DNI)"],
        ["col_responsable", "Responsable (DNI)"],
        ["col_dnimadre", "DNI madre"],
        ["col_telefono", "Teléfono"],
        ["col_rango", "Rango"],
        ["col_direccion", "Dirección"],
        ["col_ccpp", "CCPP"],
        ["col_eess_ua", "EESS UA"],
        ["col_nrovd", "Nro VD"],
        ["col_fecha_inicio_vd", "Fecha inicio VD"],
        ["col_fecha_fin_vd", "Fecha fin VD"],
        ["col_etapa", "Etapa"],
      ].map(([name, label]) => (
        <div key={name} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-zinc-900">{label}</label>
            <input
              name={name}
              defaultValue={props.cfg[name]}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            {name === "col_etapa" ? (
              <div className="mt-1 text-xs text-zinc-500">
                Si no se indica, se deriva del mes de Fecha inicio VD (día 01).
              </div>
            ) : null}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-end gap-2">
        <a
          href="/admin/carga-vd"
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
        >
          Volver
        </a>
        <button
          disabled={pending}
          name="op"
          value="create"
          className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar como nueva"}
        </button>
        <button
          disabled={pending}
          name="op"
          value="update"
          className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

