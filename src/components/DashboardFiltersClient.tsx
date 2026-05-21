"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FullScreenLoader } from "@/components/FullScreenLoader";
import { DashboardPdfButton } from "@/components/DashboardPdfButton";

type DashboardMonth = {
  ubigeo: string;
  year: number;
  numero_mes: number;
  meses: string;
  seleccion?: number | null;
  etapa: string;
};

export function DashboardFiltersClient(props: {
  ubigeos: string[];
  initialUbigeo?: string;
  initialYm?: string;
  pdfPayload?: any;
}) {
  const router = useRouter();
  const [ubigeo, setUbigeo] = useState(String(props.initialUbigeo ?? ""));
  const [ym, setYm] = useState(String(props.initialYm ?? ""));
  const [months, setMonths] = useState<DashboardMonth[]>([]);
  const [loading, setLoading] = useState(false);
  const [navLoading, setNavLoading] = useState(false);
  const [info, setInfo] = useState("");

  const monthOptions = useMemo(() => {
    return months
      .slice()
      .sort((a, b) => (b.year - a.year) * 100 + (b.numero_mes - a.numero_mes))
      .map((m) => ({
        value: `${m.year}-${m.numero_mes}`,
        label: `${m.meses} ${m.year} (N° ${m.numero_mes})`,
      }));
  }, [months]);

  async function loadMonths(u: string, preserveYm: boolean) {
    setInfo("");
    setMonths([]);
    if (!preserveYm) setYm("");
    const clean = u.trim();
    if (!clean) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/months?ubigeo=${encodeURIComponent(clean)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(data?.error ?? "No se pudo cargar meses."));
      const list = (data?.months ?? []) as DashboardMonth[];
      setMonths(Array.isArray(list) ? list : []);
      if (!list?.length) {
        setInfo("No hay meses registrados para este ubigeo.");
        setYm("");
      } else if (preserveYm) {
        const ymCurrent = String(ym ?? "").trim();
        if (ymCurrent && !list.some((m) => `${m.year}-${m.numero_mes}` === ymCurrent)) {
          setYm("");
          setInfo("El mes seleccionado no corresponde al ubigeo. Selecciona un mes válido.");
        }
      }
    } catch (e: any) {
      setInfo(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!ubigeo.trim()) return;
    loadMonths(ubigeo, true);
  }, []);

  const canSubmit = Boolean(ubigeo.trim()) && Boolean(ym.trim());

  return (
    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
      {loading ? <FullScreenLoader label="Cargando meses..." /> : null}
      {navLoading ? <FullScreenLoader label="Cargando dashboard..." /> : null}
      <div className="flex-1">
        <label className="block text-sm font-medium text-zinc-900">Ubigeo</label>
        <select
          value={ubigeo}
          onChange={(e) => {
            const v = e.target.value;
            setUbigeo(v);
            loadMonths(v, false);
          }}
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        >
          <option value="">Seleccionar ubigeo</option>
          {props.ubigeos.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <label className="block text-sm font-medium text-zinc-900">Mes</label>
        <select
          value={ym}
          onChange={(e) => setYm(e.target.value)}
          disabled={!ubigeo.trim() || !monthOptions.length}
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-zinc-50"
        >
          <option value="">
            {!ubigeo.trim()
              ? "Selecciona un ubigeo primero"
              : monthOptions.length
                ? "Seleccionar mes"
                : "Sin meses"}
          </option>
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {info ? <div className="mt-1 text-xs text-zinc-600">{info}</div> : null}
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-end md:ml-auto">
        <button
          type="button"
          disabled={!canSubmit || loading || navLoading}
          onClick={() => {
            if (!canSubmit) return;
            setNavLoading(true);
            router.push(
              `/dashboard?ubigeo=${encodeURIComponent(ubigeo)}&ym=${encodeURIComponent(ym)}`,
            );
          }}
          className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Ver
        </button>
        {props.pdfPayload ? <DashboardPdfButton payload={props.pdfPayload} /> : null}
      </div>
    </div>
  );
}
