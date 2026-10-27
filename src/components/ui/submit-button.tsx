"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { buttonClass } from "./button";

/** A submit button that disables itself while its form is sending, so slow connections can't double-submit. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { pendingLabel?: string; variant?: Parameters<typeof buttonClass>[0]; size?: Parameters<typeof buttonClass>[1] }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      {...props}
      disabled={pending || props.disabled}
      aria-disabled={pending || props.disabled}
      className={buttonClass(variant, size, className)}
    >
      {pending ? (
        <>
          <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
          {pendingLabel ?? "Saving…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}
