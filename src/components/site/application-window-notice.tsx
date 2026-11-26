import type { ApplicationWindowStatus } from "@/lib/survey/application-window";

export function ApplicationWindowNotice({ status }: { status: ApplicationWindowStatus }) {
  const message =
    status === "upcoming"
      ? "Applications open at midnight (12:00 AM) on Friday, November 27, 2026. You can apply until 11:59 PM on Thursday, January 7, 2027."
      : status === "open"
        ? "Applications are open now. Please apply by 11:59 PM on Thursday, January 7, 2027."
        : "Applications are closed. The application period ended at 11:59 PM on Thursday, January 7, 2027.";

  return (
    <aside
      aria-label="Application dates"
      className="rounded-2xl border border-plp-200 bg-plp-50/70 p-4 sm:p-5"
    >
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-plp-700">
        {status === "upcoming"
          ? "Applications open soon"
          : status === "open"
            ? "Applications are open"
            : "Applications are closed"}
      </p>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
        {message} Times are in Johannesburg time.
      </p>
    </aside>
  );
}
