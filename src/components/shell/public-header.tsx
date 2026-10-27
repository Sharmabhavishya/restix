import Link from "next/link";
import { Wordmark } from "../logo";
import { ButtonLink } from "../ui/button";
import { getViewer } from "@/server/auth/viewer";

export async function PublicHeader() {
  const viewer = await getViewer().catch(() => null);
  const signedIn = viewer && (viewer.access === "ok" || viewer.access === "restricted");
  return (
    <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
      <Link href="/" className="pt-1">
        <Wordmark className="text-[26px]" />
      </Link>
      <nav aria-label="Site" className="flex items-center gap-1 sm:gap-2">
        <Link href="/safety" className="hidden rounded-[var(--radius-control)] px-3 py-2 text-sm text-muted hover:text-ink sm:block">
          Safety
        </Link>
        {signedIn ? (
          <ButtonLink href="/tickets" variant="dark" size="sm">
            Open ResTix
          </ButtonLink>
        ) : (
          <ButtonLink href="/sign-in" variant="dark" size="sm">
            Sign in
          </ButtonLink>
        )}
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mx-auto w-full max-w-[1200px] px-4 py-10 text-sm text-muted sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <p>ResTix connects students. Payments and handovers happen between you, never through us.</p>
        <nav aria-label="Legal" className="flex gap-4">
          <Link href="/safety" className="hover:text-ink">Safety</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
