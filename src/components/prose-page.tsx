import type { ReactNode } from "react";
import { connection } from "next/server";
import { PublicFooter, PublicHeader } from "./shell/public-header";

/** Layout for public reading pages (safety, privacy, terms): one readable column. */
export async function ProsePage({ title, intro, updated, children }: { title: string; intro?: ReactNode; updated?: string; children: ReactNode }) {
  // Rendered per request so the CSP nonce reaches its scripts.
  await connection();
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-[760px] flex-1 px-4 pt-10 pb-20 sm:px-6 md:pt-16">
        <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] leading-[1] font-bold tracking-[-0.035em]">{title}</h1>
        {intro && <div className="mt-5 text-lg leading-relaxed text-[#2b2f38]">{intro}</div>}
        {updated && <p className="mt-3 text-sm text-muted">Last updated {updated}</p>}
        <div className="prose-restix mt-10">{children}</div>
      </main>
      <PublicFooter />
    </div>
  );
}

/** A plain callout for the one thing a reader must not miss. */
export function Callout({ children }: { children: ReactNode }) {
  return <div className="my-8 rounded-[var(--radius-card)] bg-accent-soft px-5 py-4 text-[16px] leading-relaxed text-accent-ink">{children}</div>;
}
