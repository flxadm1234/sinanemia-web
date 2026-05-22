"use client";

import { useFormStatus } from "react-dom";
import { FullScreenLoader } from "@/components/FullScreenLoader";

export function FormSubmitButton(props: {
  label: string;
  pendingLabel?: string;
  className?: string;
  overlayLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const { label, pendingLabel, className, overlayLabel, disabled } = props;
  const isDisabled = pending || !!disabled;

  return (
    <>
      {pending ? <FullScreenLoader label={overlayLabel ?? pendingLabel ?? label} /> : null}
      <button
        type="submit"
        disabled={isDisabled}
        className={className}
        aria-disabled={isDisabled}
      >
        {pending ? pendingLabel ?? label : label}
      </button>
    </>
  );
}

