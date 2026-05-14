"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { PadronRow } from "@/lib/padronnominal";
import { ActorSocialCombobox } from "@/components/ActorSocialCombobox";
import type { AsignacionResult } from "@/app/asignacion/actions";

export function AsignacionClient(props: {
  rows: PadronRow[];
  etapa: string;
  ubigeo: number;
  isCoordinador: boolean;
  action: any;
}) {
  const { rows, etapa, ubigeo, isCoordinador, action } = props;
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<{
    ok: boolean;
    message: string;
    detail?: number;
  } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [actorInfo, setActorInfo] = useState<{
    dni: string;
    nombre: string;
    cdr: string | null;
    coordinadorNombre: string | null;
  } | null>(null);

  const ids = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k)),
    [selected],
  );

  const [state, formAction, pending] = useActionState<AsignacionResult | null, FormData>(
    action,
    null,
  );

  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!state) return;

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    if (state.ok) {
      setModalError(null);
      setSelected({});
      setActorInfo(null);
      setOpen(false);
      setToast({
        ok: true,
        message: "Asignación completada. Registros actualizados:",
        detail: state.affected,
      });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 3500);
    } else {
      setToast(null);
      setModalError(state.message);
    }
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [state]);

  const toggleAll = (v: boolean) => {
    const next: Record<number, boolean> = {};
    for (const r of rows) next[r.idpn] = v;
    setSelected(next);
  };

  return (
    <div className="flex flex-col gap-4">
      {toast ? (
        <div className="fixed inset-x-0 top-3 z-[100] px-4">
          <div
            className={
              "mx-auto w-full max-w-2xl rounded-2xl border px-4 py-3 text-sm shadow-lg " +
              (toast.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-900")
            }
          >
            {toast.ok ? (
              <>
                {toast.message} <span className="font-semibold">{toast.detail}</span>
              </>
            ) : (
              toast.message
            )}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              Resultados ({rows.length})
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Ubigeo: <span className="font-semibold">{ubigeo}</span> · Etapa:{" "}
              <span className="font-semibold">{etapa}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleAll(true)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Marcar todo
            </button>
            <button
              type="button"
              onClick={() => toggleAll(false)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Limpiar
            </button>
            <button
              type="button"
              disabled={ids.length === 0}
              onClick={() => {
                setModalError(null);
                setOpen(true);
              }}
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              Asignar ({ids.length})
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-3 py-3 w-10"></th>
                <th className="px-3 py-3">ID</th>
                <th className="px-3 py-3">DNI</th>
                <th className="px-3 py-3">Nombres</th>
                <th className="px-3 py-3">Dirección</th>
                <th className="px-3 py-3">Referencia</th>
                <th className="px-3 py-3">EESS</th>
                <th className="px-3 py-3">Actor</th>
                <th className="px-3 py-3">Responsable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <tr key={r.idpn} className="hover:bg-zinc-50/50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={!!selected[r.idpn]}
                      onChange={(e) =>
                        setSelected((s) => ({ ...s, [r.idpn]: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                  </td>
                  <td className="px-3 py-3 text-zinc-700">{r.idpn}</td>
                  <td className="px-3 py-3 font-medium text-zinc-900">
                    {r.dni ?? "-"}
                  </td>
                  <td className="px-3 py-3 text-zinc-700">{r.nombres ?? "-"}</td>
                  <td className="px-3 py-3 text-zinc-700">
                    {r.direccion ?? "-"}
                  </td>
                  <td className="px-3 py-3 text-zinc-700">
                    {r.referencia ?? "-"}
                  </td>
                  <td className="px-3 py-3 text-zinc-700">{r.eess_ua ?? "-"}</td>
                  <td className="px-3 py-3 text-zinc-700">
                    {r.actorsocial ?? "-"}
                  </td>
                  <td className="px-3 py-3 text-zinc-700">
                    {r.responsable ?? "-"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center text-zinc-500" colSpan={9}>
                    Sin resultados con el filtro actual.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-zinc-900">
                  Asignar niños
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  Seleccionados: <span className="font-semibold">{ids.length}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setOpen(false);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>

            {modalError ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {modalError}
              </div>
            ) : null}

            <form action={formAction as any} className="mt-5 flex flex-col gap-4">
              <input type="hidden" name="ids" value={JSON.stringify(ids)} />

              <div>
                <label className="block text-sm font-medium text-zinc-900">
                  Actor social
                </label>
                <div className="mt-1">
                  <ActorSocialCombobox
                    name="actor"
                    disabled={pending}
                    onSelect={(opt) =>
                      setActorInfo(
                        opt
                          ? {
                              dni: opt.dni,
                              nombre: opt.nombre,
                              cdr: opt.cdr ?? null,
                              coordinadorNombre: opt.coordinadorNombre ?? null,
                            }
                          : null,
                      )
                    }
                  />
                </div>
                {isCoordinador ? (
                  <div className="mt-2 text-xs text-zinc-500">
                    Solo aparecen tus actores sociales.
                  </div>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-900">
                  Responsable (coordinador)
                </label>
                <div className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700">
                  {actorInfo?.cdr
                    ? `${actorInfo.coordinadorNombre ?? actorInfo.cdr} (${actorInfo.cdr})`
                    : "—"}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {pending ? "Guardando..." : "Asignar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

