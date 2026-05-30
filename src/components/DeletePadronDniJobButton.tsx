"use client";

import { useState } from "react";
import { deletePadronDniJobAction } from "@/app/admin/padron-dni/actions";

export function DeletePadronDniJobButton(props: { jobId: string }) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      action={deletePadronDniJobAction}
      onSubmit={(e) => {
        const ok = confirm("¿Eliminar esta carga? Se eliminarán todos los registros asociados.");
        if (!ok) {
          e.preventDefault();
          return;
        }
        setSubmitting(true);
      }}
    >
      <input type="hidden" name="jobId" value={props.jobId} />
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
      >
        Eliminar
      </button>
    </form>
  );
}
