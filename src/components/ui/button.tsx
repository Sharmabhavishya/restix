import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-medium " +
  "transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out-quart)] " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 select-none";

const variants: Record<Variant, string> = {
  // The one filled style carries the full hue (docs/DESIGN.md).
  primary: "bg-accent text-white hover:bg-accent-hover",
  dark: "bg-primary text-white hover:bg-black",
  secondary: "border border-control bg-surface text-ink hover:border-[#b9bdc4] hover:bg-raised",
  ghost: "text-ink hover:bg-raised",
  danger: "border border-[#f1b8b4] bg-surface text-negative hover:bg-negative-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[15px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = ""): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Button({ variant, size, className = "", ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant, size, className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
