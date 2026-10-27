/**
 * Shown the instant someone moves between pages, while the server prepares the next one. It also
 * lets Next prefetch every page up to this point, so navigation feels immediate.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto w-full max-w-[860px]">
      <span className="sr-only">Loading…</span>
      <div className="mb-8 flex items-end justify-between gap-6">
        <div className="flex flex-col gap-3">
          <span className="skeleton h-10 w-56 rounded-[10px] sm:h-12 sm:w-72" />
          <span className="skeleton h-4 w-64 rounded-full sm:w-96" />
        </div>
        <span className="skeleton hidden h-10 w-32 rounded-[var(--radius-control)] sm:block" />
      </div>
      <span className="skeleton mb-4 block h-13 w-full rounded-full" />
      <div className="mb-8 flex gap-2">
        {[24, 20, 28, 22].map((w, i) => <span key={i} className="skeleton h-9 rounded-full" style={{ width: `${w * 4}px` }} />)}
      </div>
      <div className="flex flex-col gap-6">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="skeleton block h-[5.5rem] rounded-[14px]" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    </div>
  );
}
