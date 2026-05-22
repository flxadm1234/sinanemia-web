"use client";

import { useActionState } from "react";
import { FormSubmitButton } from "@/components/FormSubmitButton";

type State = { ok: false; message: string } | null;

export function DeletePersonaButton(props: {
  action: any;
  idpersona: number;
  label?: string;
}) {
  const { action, idpersona, label } = props;
  const [state, formAction] = useActionState<State, FormData>(action, null);

  return (
    <form
      action={formAction as any}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar usuario? Esta acción no se puede deshacer.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="idpersona" value={String(idpersona)} />
      {state && !state.ok ? (
        <div className="mb-2 text-xs text-red-700">{state.message}</div>
      ) : null}
      <FormSubmitButton
        label={label ?? "Eliminar"}
        pendingLabel="Eliminando..."
        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      />
    </form>
  );
}

