"use client";

import { useFormStatus } from "react-dom";
import { FullScreenLoader } from "@/components/FullScreenLoader";

export function FormSubmitButton(props: {
  label: string;
  pendingLabel?: string;
  className?: string;
  overlayLabel?: string;
}) {
  const { pending } = useFormStatus();
  const { label, pendingLabel, className, overlayLabel } = props;

  return (
    <>
      {pending ? <FullScreenLoader label={overlayLabel ?? pendingLabel ?? label} /> : null}
      <button
        type="submit"
        disabled={pending}
        className={className}
        aria-disabled={pending}
      >
        {pending ? pendingLabel ?? label : label}
      </button>
    </>
  );
}

