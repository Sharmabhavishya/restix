"use client";

import { useEffect, useRef } from "react";
import type { ActionState } from "./action-state";

const revisions = new WeakMap<object, number>();
let counter = 0;

/**
 * What a form should do after each result from its action:
 *
 * - `ref`: put it on the `<form>`. When a submit comes back with a problem, the first invalid field
 *   (or else the error notice) is scrolled into the middle of the screen and focused. Without this a
 *   phone user at the bottom of a long form sees nothing happen.
 * - `rev`: a number that changes with every result. React 19 resets a form after its action, which
 *   un-checks radios and checkboxes in the page while React still thinks they're checked. Use `rev`
 *   as the `key` of a controlled radio group or checkbox so it is rebuilt in step with its state.
 */
export function useFormFeedback(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);

  let rev = revisions.get(state);
  if (rev === undefined) {
    rev = ++counter;
    revisions.set(state, rev);
  }

  useEffect(() => {
    if (!state.error && !state.fieldErrors) return;
    const root = ref.current;
    if (!root) return;
    const target =
      root.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      root.querySelector<HTMLElement>('[role="alert"]');
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    // A notice isn't focusable by itself; make it so, only to move the screen reader's cursor there.
    if (!target.matches("input, select, textarea, button, a[href]")) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }, [state]);

  return { ref, rev };
}
