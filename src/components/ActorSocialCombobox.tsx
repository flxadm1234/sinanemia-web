"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = {
  idpersona: number;
  dni: string;
  nombre: string;
  ubigeo: number | null;
};

export function ActorSocialCombobox(props: {
  name: string;
  defaultValue?: string;
  ubigeo?: number | null;
  disabled?: boolean;
}) {
  const { name, defaultValue, ubigeo, disabled } = props;
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [value, setValue] = useState(defaultValue ?? "");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (typeof ubigeo === "number" && Number.isFinite(ubigeo))
      params.set("ubigeo", String(ubigeo));

    fetch(`/api/actores-sociales?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) return [];
        return (await r.json()) as Option[];
      })
      .then((data) => setOptions(Array.isArray(data) ? data : []))
      .catch(() => {});

    return () => controller.abort();
  }, [ubigeo]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selected = useMemo(
    () => options.find((o) => o.dni === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      return (
        o.dni.toLowerCase().includes(q) || o.nombre.toLowerCase().includes(q)
      );
    });
  }, [options, query]);

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-left text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
      >
        {selected ? `${selected.nombre} (${selected.dni})` : "Seleccionar actor social"}
      </button>

      {open ? (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-zinc-200 bg-white shadow-lg">
          <div className="p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por DNI o nombre..."
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="max-h-64 overflow-auto px-2 pb-2">
            {filtered.map((o) => (
              <button
                key={o.idpersona}
                type="button"
                onClick={() => {
                  setValue(o.dni);
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-zinc-50"
              >
                <div className="font-medium text-zinc-900">{o.nombre}</div>
                <div className="text-xs text-zinc-600">
                  DNI: {o.dni} · Ubigeo: {o.ubigeo ?? "-"}
                </div>
              </button>
            ))}
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-zinc-500">
                Sin resultados.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

