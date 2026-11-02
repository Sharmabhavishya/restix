import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { PublicHeader } from "@/components/shell/public-header";
import { SiteFooter } from "@/components/site-footer";
import { EventPoster } from "@/components/event-poster";
import { ButtonLink } from "@/components/ui/button";
import { getViewer } from "@/server/auth/viewer";
import { publicEventBySlug } from "@/server/events";
import { formatDateTime } from "@/lib/format";

// The page behind a shared event link: what the event is and how many tickets are up, nothing
// about who is selling. Signed-in students go straight to the real event page.
export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await publicEventBySlug(slug);
  if (!event) return { title: "Event", robots: { index: false } };
  return {
    title: `${event.name} tickets`,
    description: `${event.name}, ${formatDateTime(event.startsAt)}. Student-to-student tickets on ResTix.`,
    robots: { index: false, follow: false },
  };
}

export default async function SharedEventPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  const [event, viewer] = await Promise.all([publicEventBySlug(slug), getViewer().catch(() => null)]);
  if (viewer && (viewer.access === "ok" || viewer.access === "restricted")) redirect(`/events/${slug}`);
  if (!event) notFound();

  return (
    <div className="overflow-x-clip">
      <PublicHeader />
      <main id="main" className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6">
        <EventPoster event={event} size="hero" />
        <div className="mx-auto mt-8 max-w-xl text-center">
          <p className="flex items-center justify-center gap-2 text-sm text-muted">
            <LockKeyhole className="size-4" aria-hidden />
            Sellers and prices are for verified students only.
          </p>
          <p className="mt-3 text-balance text-[17px]">
            Sign in with your college email to see who&apos;s selling {event.name}, and to ask for a ticket.
          </p>
          <div className="mt-5 flex justify-center">
            <ButtonLink href={`/sign-in?next=${encodeURIComponent(`/events/${slug}`)}`} size="lg" variant="dark">
              Sign in with your college email
            </ButtonLink>
          </div>
        </div>
      </main>
      <SiteFooter year={new Date().getFullYear()} />
    </div>
  );
}
