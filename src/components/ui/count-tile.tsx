import Link from "next/link";

/** A count that filters the list below it. The selected one is filled with the accent. */
export function CountTile({ href, label, count, selected, className = "" }: { href: string; label: string; count: number; selected: boolean; className?: string }) {
  return (
    <Link
      href={href}
      aria-current={selected ? "page" : undefined}
      className={`flex min-w-28 flex-none flex-col justify-center gap-1 rounded-[var(--radius-card)] border px-4 py-3 transition-[background-color,border-color,transform] duration-200 ease-[var(--ease-out-expo)] motion-safe:active:scale-[0.97] sm:min-w-0 ${
        selected ? "border-accent bg-accent text-white" : "border-border bg-surface hover:border-control motion-safe:hover:-translate-y-0.5"
      } ${className}`}
    >
      <span className={`text-[13px] ${selected ? "text-white" : "text-muted"}`}>{label}</span>
      <span className="num text-2xl leading-none font-bold tracking-[-0.02em]">{count.toLocaleString("en-IN")}</span>
    </Link>
  );
}
