import type { ComponentProps, ReactNode } from "react";

export const controlClass =
  "block w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 text-[15px] text-ink " +
  "placeholder:text-[#6b6b6b] transition-[border-color,box-shadow] duration-150 " +
  "hover:border-[#b9bdc4] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent-track " +
  "aria-[invalid=true]:border-negative disabled:bg-raised disabled:text-muted";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-[13px] font-medium text-negative" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** aria-* props that tie a control to its hint or error. */
export function describedBy(id: string, error?: string, hint?: boolean) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${controlClass} h-10 ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${controlClass} min-h-24 py-2.5 leading-relaxed ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <select className={`${controlClass} h-10 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235f6672%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_12px_center] bg-no-repeat pr-9 ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, hint, id, ...props }: ComponentProps<"input"> & { label: string; hint?: string; id: string }) {
  return (
    <div className="flex items-start gap-3">
      <input type="checkbox" id={id} className="mt-0.5 size-[18px] shrink-0 rounded border-control accent-accent" {...props} />
      <label htmlFor={id} className="text-sm leading-snug">
        <span className="font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>}
      </label>
    </div>
  );
}
