import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export type Tone = "neutral" | "accent" | "positive" | "negative" | "warning";

const toneClass: Record<Tone, string> = {
  neutral: "bg-raised text-pill-neutral",
  accent: "bg-accent-soft text-accent-ink",
  positive: "bg-positive-soft text-positive-ink",
  negative: "bg-negative-soft text-negative-ink",
  warning: "bg-notice-soft text-notice-ink",
};

export function Pill({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex h-6 flex-none items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ${toneClass[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Panel({ children, className = "", as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <As className={`rounded-[var(--radius-card)] border border-border bg-surface ${className}`}>{children}</As>;
}

export function PanelHeader({ title, action, sub }: { title: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold leading-tight">{title}</h2>
        {sub && <p className="mt-1 text-[13px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

const noticeStyle = {
  info: { cls: "border-border bg-raised text-ink", Icon: Info },
  success: { cls: "border-positive-line bg-positive-soft text-positive-ink", Icon: CheckCircle2 },
  warning: { cls: "border-notice-line bg-notice-soft text-notice-ink", Icon: AlertCircle },
  error: { cls: "border-negative-line bg-negative-soft text-negative-ink", Icon: AlertCircle },
} as const;

export function Notice({ tone = "info", title, children, className = "" }: { tone?: keyof typeof noticeStyle; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { cls, Icon } = noticeStyle[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-[var(--radius-card)] border px-4 py-3 text-sm ${cls} ${className}`}>
      <Icon className="mt-0.5 size-4 flex-none" aria-hidden />
      <div className="min-w-0 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

/** A lone wristband, dropped at an angle: the empty-state mark. */
function LooseBand() {
  return (
    <div aria-hidden className="mx-auto mb-5 flex h-9 w-40 -rotate-6 gap-[3px] motion-safe:animate-[band-float_5s_ease-in-out_infinite]">
      <div className="flex-1 rounded-l-[var(--radius-card)] bg-accent-track" />
      <div className="relative w-12 rounded-r-full bg-accent-field">
        <span className="absolute top-1/2 right-2.5 size-2.5 -translate-y-1/2 rounded-full border-2 border-accent-ink/50" />
      </div>
    </div>
  );
}

/** An empty block keeps its frame and says what to do next. */
export function EmptyState({ title, children, action, className = "" }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[var(--radius-card)] border border-border bg-surface px-5 py-10 text-center ${className}`}>
      <LooseBand />
      <p className="text-lg font-semibold tracking-[-0.01em]">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageTitle({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.035em] text-balance [overflow-wrap:anywhere] sm:text-[44px] sm:leading-[1]">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-[15px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-rule">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
          <dt className="text-muted">{it.label}</dt>
          <dd className="text-right font-medium">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
