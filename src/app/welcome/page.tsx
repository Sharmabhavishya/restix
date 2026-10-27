import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-redirect";
import { requireViewer } from "@/server/auth/viewer";
import { privateProfile } from "@/server/profile";
import { ProfileForm } from "../(app)/account/profile-form";
import { Wordmark } from "@/components/logo";
import { VerifiedEmail } from "@/components/listing-bits";
import { Panel } from "@/components/ui/bits";
import Image from "next/image";
import co2Jets from "@/assets/photos/own-co2-jets-wide.jpg";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  const viewer = await requireViewer("/welcome");
  if (viewer.onboarded) redirect(next);
  const priv = await privateProfile(viewer.id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-12">
      <Wordmark className="mb-8 text-[28px]" />
      {/* The band you just got: a slice of the night, cut like a wristband. */}
      <div className="relative mb-8 aspect-[16/7] overflow-hidden rounded-[var(--radius-card)] bg-raised">
        <Image src={co2Jets} alt="" placeholder="blur" priority sizes="(min-width: 512px) 480px, 100vw" className="size-full object-cover" />
      </div>
      <h1 className="text-[clamp(2rem,6vw,2.75rem)] leading-[1.05] font-bold tracking-[-0.03em]">you&apos;re in. one sec.</h1>
      <p className="mt-3 text-[17px] text-muted">
        Add your WhatsApp if you like (it stays hidden until you accept a buyer), and agree to the house rules.
      </p>
      <div className="mt-4">
        <VerifiedEmail />
      </div>
      <Panel className="mt-8 p-6">
        <ProfileForm displayName={viewer.displayName} whatsapp={priv?.whatsappNumber ?? null} onboarding next={next} />
      </Panel>
    </main>
  );
}
