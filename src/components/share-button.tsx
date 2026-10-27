"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { buttonClass } from "./ui/button";

/**
 * Shares a ResTix page (the native share sheet on phones, otherwise copies the link).
 * Only the URL travels; anyone opening it still has to sign in with a campus account.
 */
export function ShareButton({ path, title, text }: { path: string; title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // they closed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copy this link", url);
    }
  }
  return (
    <button type="button" onClick={share} className={buttonClass("secondary", "md")} aria-live="polite">
      {copied ? <Check className="size-4 text-positive" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
