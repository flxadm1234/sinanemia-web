"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function MesesFiltersClient(props: {
  ubigeos: number[];
  years: number[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const initial = useMemo(() => {
    return {
      q: sp.get("q") ?? "",
      ubigeo: sp.get("ubigeo") ?? "",
      year: sp.get("year") ?? "",
      estado: sp.get("estado") ?? "",
    };
  }, [sp]);

  const [q, setQ] = useState(initial.q);
  const [ubigeo, setUbigeo] = useState(initial.ubigeo);
  const [year, setYear] = useState(initial.year);
  const [estado, setEstado] = useState(initial.estado);

  useEffect(() => {
    setQ(initial.q);
    setUbigeo(initial.ubigeo);
    setYear(initial.year);
    setEstado(initial.estado);
  }, [initial.estado, initial.q, initial.ubigeo, initial.year]);

  const apply = (next: { q?: string; ubigeo?: string; year?: string; estado?: string }) => {
    const params = new URLSearchParams(sp.toString());
    const nq = next.q ?? q;
    const nu = next.ubigeo ?? ubigeo;
    const ny = next.year ?? year;
    const ne = next.estado ?? estado;

    const setOrDelete = (k: string, v: string) => {
      if (v && v.trim()) params.set(k, v.trim());
      else params.delete(k);
    };

    setOrDelete("q", nq);
    setOrDelete("ubigeo", nu);
    setOrDelete("year", ny);
    setOrDelete("estado", ne);

    router.push(`/admin/meses?${params.toString()}`);
  };

  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-zinc-900">Buscar</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply({ q });
              }
            }}
            placeholder="Ubigeo / Mes / Año / N°"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900">Ubigeo</label>
          <select
            value={ubigeo}
            onChange={(e) => {
              setUbigeo(e.target.value);
              apply({ ubigeo: e.target.value });
            }}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">Todos</option>
            {props.ubigeos.map((u) => (
              <option key={u} value={String(u)}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900">Año</label>
          <select
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              apply({ year: e.target.value });
            }}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">Todos</option>
            {props.years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:w-72">
          <label className="block text-sm font-medium text-zinc-900">Estado</label>
          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value);
              apply({ estado: e.target.value });
            }}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">Todos</option>
            <option value="selected">Seleccionado</option>
            <option value="unselected">No seleccionado</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => apply({ q })}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Aplicar
          </button>
          <a
            href="/admin/meses"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Limpiar
          </a>
        </div>
      </div>
    </div>
  );
}

