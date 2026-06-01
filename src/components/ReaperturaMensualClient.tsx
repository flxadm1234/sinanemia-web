"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FullScreenLoader } from "@/components/FullScreenLoader";

type VolRow = {
  dni: string;
  nombre: string;
  cdr: string | null;
  coordinadorNombre: string | null;
  ubigeo: number | null;
};

function monthStartFromYYYYMM(ym: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) return "";
  return `${m[1]}-${m[2]}-01`;
}

export function ReaperturaMensualClient(props: {
  isSuperAdmin: boolean;
  ubigeoDefault: number | null;
  etapaDefault: string;
  action: (formData: FormData) => void;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const etapaYmDefault = props.etapaDefault?.slice(0, 7) || "";

  const [ubigeo, setUbigeo] = useState(props.ubigeoDefault ? String(props.ubigeoDefault) : "");
  const [month, setMonth] = useState<string>(etapaYmDefault);
  const [etapa, setEtapa] = useState<string>(() => (etapaYmDefault ? monthStartFromYYYYMM(etapaYmDefault) : ""));
  const [overwrite, setOverwrite] = useState(false);

  const [vols, setVols] = useState<VolRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState("");

  const ubigeoReady = props.isSuperAdmin ? ubigeo.trim() : String(props.ubigeoDefault ?? "");

  useEffect(() => {
    if (!month) {
      setEtapa("");
      return;
    }
    setEtapa(monthStartFromYYYYMM(month));
  }, [month]);

  const volsFiltered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return vols;
    return vols.filter((a) => {
      const name = String(a.nombre ?? "").toLowerCase();
      const dni = String(a.dni ?? "").toLowerCase();
      const coord = String(a.coordinadorNombre ?? "").toLowerCase();
      return name.includes(term) || dni.includes(term) || coord.includes(term);
    });
  }, [vols, q]);

  const selectedDnis = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  async function loadVols(forUbigeo: string) {
    setError("");
    setLoading(true);
    try {
      const qp = forUbigeo.trim() ? `?ubigeo=${encodeURIComponent(forUbigeo.trim())}` : "";
      const res = await fetch(`/api/actores-sociales/voluntarios${qp}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(data?.error ?? "No se pudo cargar voluntarios."));
      setVols(Array.isArray(data) ? (data as VolRow[]) : []);
      setSelected({});
      setQ("");
    } catch (e: any) {
      setVols([]);
      setSelected({});
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  function toggleAll(value: boolean) {
    const next: Record<string, boolean> = {};
    for (const a of volsFiltered) next[a.dni] = value;
    setSelected((prev) => ({ ...prev, ...next }));
  }

  async function openModal() {
    setError("");
    if (props.isSuperAdmin && !ubigeoReady) {
      setError("Ingresa un ubigeo y carga la lista de voluntarios.");
      return;
    }
    if (!etapa) {
      setError("Selecciona el mes que deseas reaperturar.");
      return;
    }
    if (!vols.length) {
      setError("Primero carga la lista de actores sociales voluntarios.");
      return;
    }
    if (!selectedDnis.length) {
      setError("Selecciona al menos un voluntario.");
      return;
    }
    setModal(true);
  }

  function confirm() {
    setError("");
    const f = formRef.current;
    if (!f) return;
    const voluntariosInput = f.querySelector<HTMLInputElement>('input[name="voluntarios"]');
    const overwriteInput = f.querySelector<HTMLInputElement>('input[name="overwrite"]');
    const etapaInput = f.querySelector<HTMLInputElement>('input[name="etapa"]');
    if (voluntariosInput) voluntariosInput.value = JSON.stringify(selectedDnis);
    if (overwriteInput) overwriteInput.value = overwrite ? "1" : "0";
    if (etapaInput) etapaInput.value = etapa;
    setModal(false);
    f.requestSubmit();
  }

  return (
    <form ref={formRef} action={props.action} className="mt-5 flex flex-col gap-4">
      {loading ? <FullScreenLoader label="Cargando..." /> : null}

      {props.isSuperAdmin ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end">
          <div>
            <label className="block text-sm font-medium text-zinc-900">Ubigeo</label>
            <input
              name="ubigeo"
              inputMode="numeric"
              value={ubigeo}
              onChange={(e) => setUbigeo(e.target.value)}
              placeholder="Ej: 160101"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900">Mes a reaperturar</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadVols(ubigeoReady)}
              disabled={!ubigeoReady}
              className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              Cargar voluntarios
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end">
          <div className="text-sm text-zinc-700">
            Ubigeo: <span className="font-semibold">{props.ubigeoDefault ?? "-"}</span>
            <input type="hidden" name="ubigeo" value={props.ubigeoDefault ?? ""} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900">Mes a reaperturar</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadVols(ubigeoReady)}
              disabled={!ubigeoReady}
              className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              Cargar voluntarios
            </button>
          </div>
        </div>
      )}

      <input type="hidden" name="etapa" defaultValue={etapa} />
      <input type="hidden" name="overwrite" defaultValue="0" />
      <input type="hidden" name="voluntarios" defaultValue="[]" />

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
        <div className="text-sm font-semibold text-zinc-900">Reapertura Mensual</div>
        <div className="mt-1 text-sm text-zinc-600">
          Copia <span className="font-semibold">actorsocial</span> y <span className="font-semibold">responsable</span>{" "}
          desde el mes anterior. Si no existe en el mes anterior, busca hacia atrás hasta 6 meses. Si en el mes anterior
          el niño tiene idocurrencia 2/6/7/8/10, se asigna a un voluntario (seleccionado) de manera equitativa.
        </div>

        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, DNI o coordinador..."
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 md:max-w-md"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleAll(true)}
              disabled={!volsFiltered.length}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
            >
              Seleccionar todo
            </button>
            <button
              type="button"
              onClick={() => toggleAll(false)}
              disabled={!volsFiltered.length}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
            >
              Quitar selección
            </button>
            <button
              type="button"
              onClick={openModal}
              disabled={!vols.length}
              className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              Ejecutar reapertura
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-zinc-200 bg-white">
          <div className="max-h-[420px] overflow-auto">
            {volsFiltered.length ? (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-zinc-200 text-xs text-zinc-600">
                    <th className="w-10 px-3 py-2"></th>
                    <th className="px-3 py-2">Voluntario</th>
                    <th className="px-3 py-2">DNI</th>
                    <th className="px-3 py-2">Coordinador</th>
                  </tr>
                </thead>
                <tbody>
                  {volsFiltered.map((a) => (
                    <tr key={a.dni} className="border-b border-zinc-100 last:border-b-0">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!selected[a.dni]}
                          onChange={(e) => setSelected((prev) => ({ ...prev, [a.dni]: e.target.checked }))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-zinc-900">{a.nombre}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-700">{a.dni}</td>
                      <td className="px-3 py-2 text-sm text-zinc-700">{a.coordinadorNombre ?? a.cdr ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-zinc-600">
                No hay voluntarios para mostrar. Usa “Cargar voluntarios”.
              </div>
            )}
          </div>
        </div>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white ring-1 ring-black/10">
            <div className="p-5">
              <div className="text-base font-semibold text-zinc-900">Confirmar reapertura</div>
              <div className="mt-1 text-sm text-zinc-600">
                Etapa: <span className="font-semibold">{etapa}</span> · Voluntarios seleccionados:{" "}
                <span className="font-semibold">{selectedDnis.length}</span>
              </div>

              <label className="mt-4 flex items-start gap-3 text-sm text-zinc-800">
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                <span>
                  Sobrescribir asignaciones existentes en la etapa seleccionada.
                  <div className="mt-1 text-xs text-zinc-500">
                    Si no está marcado, solo completa los niños que están sin asignar.
                  </div>
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirm}
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

