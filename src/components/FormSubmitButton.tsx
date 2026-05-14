"use client";

import { useFormStatus } from "react-dom";

export function FormSubmitButton(props: {
  label: string;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const { label, pendingLabel, className } = props;

  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      aria-disabled={pending}
    >
      {pending ? pendingLabel ?? label : label}
    </button>
  );
}

