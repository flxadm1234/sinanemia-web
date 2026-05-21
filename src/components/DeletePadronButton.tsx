"use client";

import { useActionState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

export function DeletePadronButton(props: {
  action: any;
  ubigeo: string;
  etapa: string;
  count: number;
}) {
  const { action, ubigeo, etapa, count } = props;
  const router = useRouter();
  const [state, act, pending] = useActionState<any, FormData>(action as any, null);
  const msg = useMemo(() => String(state?.message ?? ""), [state]);
  const ok = state?.ok === true;

  useEffect(() => {
    if (!ok) return;
    router.refresh();
  }, [ok, router]);

  return (
    <form action={act} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="ubigeo" value={ubigeo} />
      <input type="hidden" name="etapa" value={etapa} />
      <button
        type="submit"
        disabled={pending || count <= 0}
        onClick={(e) => {
          const ok = window.confirm(
            `¿Eliminar el padrón del ubigeo ${ubigeo} en la etapa ${etapa}? Se borrarán ${count} registros.`,
          );
          if (!ok) e.preventDefault();
        }}
        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Eliminando..." : "Eliminar"}
      </button>
      {msg ? (
        <div
          className={
            "text-xs " + (ok ? "text-emerald-700" : "text-red-700")
          }
        >
          {msg}
        </div>
      ) : null}
    </form>
  );
}

