import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { Wordmark } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import stagePurple from "@/assets/photos/own-stage-purple.jpg";

export default async function NotFound() {
  // Rendered per request so the CSP nonce reaches its scripts.
  await connection();
  return (
    <main className="grid min-h-dvh grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div className="mx-auto flex w-full max-w-xl flex-col justify-center px-4 py-16 sm:px-6">
        <Link href="/" className="mb-12 inline-flex">
          <Wordmark className="text-[28px]" />
        </Link>
        <p className="num text-[13px] text-muted">404</p>
        <h1 className="mt-2 text-[clamp(2.25rem,6vw,3.5rem)] leading-[1] font-bold tracking-[-0.035em]">this page isn&apos;t on the list</h1>
        <p className="mt-4 text-[17px] text-muted">
          It might have been taken down, sold, or never existed. If you followed a link to a listing, it may only be visible to signed-in students.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/tickets" variant="dark">Find tickets</ButtonLink>
          <ButtonLink href="/" variant="secondary">Home</ButtonLink>
        </div>
      </div>
      {/* The party's still going, just not on this URL. */}
      <div className="relative hidden overflow-hidden rounded-l-[48px] md:block">
        <Image src={stagePurple} alt="" placeholder="blur" sizes="45vw" className="size-full object-cover" style={{ objectPosition: "100% 100%" }} />
      </div>
    </main>
  );
}
