"use client";

import { useActionState } from "react";
import { initialState } from "@/lib/action-state";
import { testEventsAction } from "../actions";
import { Notice, Panel } from "@/components/ui/bits";
import { SubmitButton } from "@/components/ui/submit-button";

/** Admin-only: add a few random sample events to try ResTix with, and clear them again. */
export function TestEvents({ count }: { count: number }) {
  const [state, action] = useActionState(testEventsAction, initialState);
  return (
    <Panel className="mb-6 p-5">
      <h2 className="text-[17px] font-semibold">Test events</h2>
      <p className="mt-1 max-w-2xl text-[13px] text-muted">
        Adds six made-up events with ticket types and a mix of resale rules, to try listing, requesting and moderating. They&apos;re
        labelled sample and left out of the real numbers, but students can see them until you remove them. Removing them also
        removes anything listed on them.
      </p>
      {state.error && <Notice tone="error" className="mt-3">{state.error}</Notice>}
      {state.ok && <Notice tone="success" className="mt-3">{state.message}</Notice>}
      <form action={action} className="mt-4 flex flex-wrap items-center gap-2">
        <SubmitButton name="op" value="add" variant="secondary" pendingLabel="Adding…">Add 6 test events</SubmitButton>
        {count > 0 && (
          <SubmitButton name="op" value="remove" variant="danger" pendingLabel="Removing…">Remove all {count} test {count === 1 ? "event" : "events"}</SubmitButton>
        )}
      </form>
    </Panel>
  );
}
