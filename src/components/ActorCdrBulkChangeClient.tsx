"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FullScreenLoader } from "@/components/FullScreenLoader";

type ActorRow = {
  dni: string;
  nombre: string;
  ubigeo: number | null;
  cdr: string | null;
  coordinadorNombre: string | null;
};

type CoordRow = {
  dni: string;
  nombre: string;
  ubigeo: number | null;
};

export function ActorCdrBulkChangeClient(props: {
  isSuperAdmin: boolean;
  ubigeoDefault: number | null;
  action: (formData: FormData) => void;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [ubigeo, setUbigeo] = useState(props.ubigeoDefault ? String(props.ubigeoDefault) : "");
  const [loadedUbigeo, setLoadedUbigeo] = useState<string>("");
  const [actors, setActors] = useState<ActorRow[]>([]);
  const [coords, setCoords] = useState<CoordRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [selectedCoord, setSelectedCoord] = useState("");
  const [error, setError] = useState("");

  const selectedDnis = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const actorsFiltered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return actors;
    return actors.filter((a) => {
      const name = String(a.nombre ?? "").toLowerCase();
      const dni = String(a.dni ?? "").toLowerCase();
      const coord = String(a.coordinadorNombre ?? "").toLowerCase();
      return name.includes(term) || dni.includes(term) || coord.includes(term);
    });
  }, [actors, q]);

  async function loadActors(forUbigeo: string) {
    setError("");
    setLoading(true);
    try {
      const qp = forUbigeo.trim() ? `?ubigeo=${encodeURIComponent(forUbigeo.trim())}` : "";
      const res = await fetch(`/api/actores-sociales${qp}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(data?.error ?? "No se pudo cargar actores sociales."));
      setActors(Array.isArray(data) ? (data as ActorRow[]) : []);
      setSelected({});
      setQ("");
      setLoadedUbigeo(forUbigeo.trim());
    } catch (e: any) {
      setActors([]);
      setSelected({});
      setLoadedUbigeo("");
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function loadCoords(forUbigeo: string) {
    const qp = forUbigeo.trim() ? `?ubigeo=${encodeURIComponent(forUbigeo.trim())}` : "";
    const res = await fetch(`/api/coordinadores${qp}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(String(data?.error ?? "No se pudo cargar coordinadores."));
    setCoords(Array.isArray(data) ? (data as CoordRow[]) : []);
  }

  useEffect(() => {
    if (!props.isSuperAdmin && props.ubigeoDefault) {
      loadActors(String(props.ubigeoDefault));
    }
  }, [props.isSuperAdmin, props.ubigeoDefault]);

  function toggleAll(value: boolean) {
    const next: Record<string, boolean> = {};
    for (const a of actorsFiltered) next[a.dni] = value;
    setSelected((prev) => ({ ...prev, ...next }));
  }

  async function openModal() {
    setError("");
    const u = props.isSuperAdmin ? ubigeo.trim() : String(props.ubigeoDefault ?? "");
    if (props.isSuperAdmin && !u) {
      setError("Ingresa un ubigeo y carga la lista de actores.");
      return;
    }
    if (!loadedUbigeo || loadedUbigeo !== u) {
      setError("Primero carga la lista de actores para este ubigeo.");
      return;
    }
    if (!selectedDnis.length) {
      setError("Selecciona al menos un actor social.");
      return;
    }
    setLoading(true);
    try {
      await loadCoords(u);
      setSelectedCoord("");
      setModal(true);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    setError("");
    if (!selectedCoord) {
      setError("Selecciona un coordinador.");
      return;
    }
    const f = formRef.current;
    if (!f) return;
    const actoresInput = f.querySelector<HTMLInputElement>('input[name="actores"]');
    const coordInput = f.querySelector<HTMLInputElement>('input[name="coordinador"]');
    if (actoresInput) actoresInput.value = JSON.stringify(selectedDnis);
    if (coordInput) coordInput.value = selectedCoord;
    setModal(false);
    f.requestSubmit();
  }

  const ubigeoReady = props.isSuperAdmin ? ubigeo.trim() : String(props.ubigeoDefault ?? "");

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
          <div className="md:col-span-2 flex gap-2">
            <button
              type="button"
              onClick={() => loadActors(ubigeoReady)}
              disabled={!ubigeoReady}
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              Cargar actores
            </button>
            <button
              type="button"
              onClick={() => {
                setActors([]);
                setSelected({});
                setLoadedUbigeo("");
                setQ("");
              }}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Limpiar
            </button>
          </div>
        </div>
      ) : (
        <>
          <input type="hidden" name="ubigeo" value={props.ubigeoDefault ?? ""} />
          <div className="text-sm text-zinc-700">
            Ubigeo: <span className="font-semibold">{props.ubigeoDefault ?? "-"}</span>
          </div>
        </>
      )}

      <input type="hidden" name="actores" defaultValue="[]" />
      <input type="hidden" name="coordinador" defaultValue="" />

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
        <div className="text-sm font-semibold text-zinc-900">Actores sociales</div>
        <div className="mt-1 text-sm text-zinc-600">
          Selecciona uno o varios actores y luego asigna un nuevo coordinador (CDR). También se actualizará el{" "}
          <span className="font-semibold">responsable</span> del padrón del mes seleccionado para este ubigeo.
        </div>

        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, apellidos, DNI o coordinador..."
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 md:max-w-md"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleAll(true)}
              disabled={!actorsFiltered.length}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
            >
              Seleccionar todo
            </button>
            <button
              type="button"
              onClick={() => toggleAll(false)}
              disabled={!actorsFiltered.length}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
            >
              Quitar selección
            </button>
            <button
              type="button"
              onClick={openModal}
              disabled={!actors.length}
              className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              Cambiar coordinador
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-zinc-200 bg-white">
          <div className="max-h-[420px] overflow-auto">
            {actorsFiltered.length ? (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-zinc-200 text-xs text-zinc-600">
                    <th className="w-10 px-3 py-2"></th>
                    <th className="px-3 py-2">Actor social</th>
                    <th className="px-3 py-2">DNI</th>
                    <th className="px-3 py-2">Coordinador actual</th>
                  </tr>
                </thead>
                <tbody>
                  {actorsFiltered.map((a) => (
                    <tr key={a.dni} className="border-b border-zinc-100 last:border-b-0">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!selected[a.dni]}
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [a.dni]: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-zinc-900">{a.nombre || a.dni}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-700">{a.dni}</td>
                      <td className="px-3 py-2 text-zinc-700">{a.coordinadorNombre || a.cdr || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-4 py-6 text-sm text-zinc-600">
                {actors.length ? "Sin resultados para la búsqueda." : "Carga la lista de actores para empezar."}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 text-xs text-zinc-600">
          Seleccionados: <span className="font-semibold">{selectedDnis.length}</span>
        </div>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-[100000] grid place-items-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.5)] ring-1 ring-black/10">
            <div className="text-sm font-semibold text-zinc-900">Asignar coordinador</div>
            <div className="mt-1 text-sm text-zinc-600">
              Se aplicará el cambio a <span className="font-semibold">{selectedDnis.length}</span> actores sociales.
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-zinc-900">Coordinador (CDR)</label>
              <select
                value={selectedCoord}
                onChange={(e) => setSelectedCoord(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Seleccionar coordinador</option>
                {coords.map((c) => (
                  <option key={c.dni} value={c.dni}>
                    {c.nombre} ({c.dni})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirm}
                className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Aplicar cambios
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
