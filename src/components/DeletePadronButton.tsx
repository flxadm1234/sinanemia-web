"use client";

import { useRef, useState } from "react";

export function DeletePadronButton(props: {
  action: any;
  ubigeo: string;
  etapa: string;
  count: number;
}) {
  const { action, ubigeo, etapa, count } = props;
  const ref = useRef<HTMLFormElement | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      ref={ref}
      action={action}
      onSubmit={() => setPending(true)}
      className="inline-flex"
    >
      <input type="hidden" name="ubigeo" value={ubigeo} />
      <input type="hidden" name="etapa" value={etapa} />
      <button
        type="button"
        disabled={pending || count <= 0}
        onClick={() => {
          const ok = window.confirm(
            `¿Eliminar el padrón del ubigeo ${ubigeo} en la etapa ${etapa}? Se borrarán ${count} registros.`,
          );
          if (!ok) return;
          ref.current?.requestSubmit();
        }}
        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Eliminando..." : "Eliminar"}
      </button>
    </form>
  );
}

