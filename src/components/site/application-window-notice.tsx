export function ApplicationWindowNotice() {
  return (
    <aside
      aria-label="Application dates"
      className="rounded-2xl border border-plp-200 bg-plp-50/70 p-4 sm:p-5"
    >
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-plp-700">
        Application dates
      </p>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
        Applications open at midnight (12:00 AM) on Friday, November 27, 2026, and close at
        11:59 PM on Thursday, January 7, 2027. Times are in Johannesburg time.
      </p>
    </aside>
  );
}
