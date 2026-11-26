import { LogoMark } from "@/components/brand/logo";
import { surveySource } from "@/lib/survey/source";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border/70 py-10">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark className="size-6" />
          <p className="text-[0.8125rem] text-ink-muted">
            {surveySource.owner} — PLP School Curriculum
          </p>
        </div>
        <p className="max-w-md text-[0.8125rem] leading-relaxed text-ink-faint">
          Lead with peace. Create with purpose. Thrive with opportunity.
        </p>
      </div>
    </footer>
  );
}
