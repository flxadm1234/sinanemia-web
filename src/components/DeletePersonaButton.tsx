"use client";

import { FormSubmitButton } from "@/components/FormSubmitButton";

export function DeletePersonaButton(props: {
  action: any;
  idpersona: number;
  label?: string;
}) {
  const { action, idpersona, label } = props;

  return (
    <form
      action={action as any}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar usuario? Esta acción no se puede deshacer.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="idpersona" value={String(idpersona)} />
      <FormSubmitButton
        label={label ?? "Eliminar"}
        pendingLabel="Eliminando..."
        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      />
    </form>
  );
}
