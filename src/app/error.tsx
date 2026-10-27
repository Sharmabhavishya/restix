"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

// Shown when a page fails to render (for example, the database is unreachable). Nothing
// the person did is assumed to have succeeded; they can retry or go elsewhere.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-xl flex-col justify-center px-4 py-16">
      <h1 className="text-[clamp(2rem,5vw,3rem)] leading-[1.05] font-bold tracking-[-0.03em]">something broke on our side</h1>
      <p className="mt-4 text-[17px] text-muted">
        This page couldn&apos;t load, usually because a service we depend on is briefly unavailable. If you were saving something, it may not have gone through, so check before trying again.
      </p>
      {error.digest && <p className="num mt-3 text-[13px] text-muted">Reference: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={buttonClass("dark")}>Try again</button>
        <Link href="/" className={buttonClass("secondary")}>Home</Link>
      </div>
    </main>
  );
}
