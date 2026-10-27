import type { ComponentProps } from "react";
import { controlClass } from "./field";

/**
 * A WhatsApp number field that assumes India: "+91" sits in front, so people type just the ten
 * digits. Anyone abroad types their own "+country" number instead (normalizeWhatsapp accepts both).
 */
export function PhoneInput({ className = "", ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <div className={`relative ${className}`}>
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 border-r border-border pr-2.5 text-[15px] font-medium text-muted">
        +91
      </span>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="98765 43210"
        className={`${controlClass} h-11 pl-[3.6rem] sm:h-10`}
        {...props}
      />
    </div>
  );
}
