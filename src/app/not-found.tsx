import Link from "next/link";
import { Mark } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-16">
      <Link href="/" aria-label="ResTix home" className="mb-12 inline-flex">
        <Mark className="size-8" />
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
    </main>
  );
}
