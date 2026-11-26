import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SurveyForm } from "@/components/survey/survey-form";
import { SetupNotice } from "@/components/site/setup-notice";
import { ApplicationWindowNotice } from "@/components/site/application-window-notice";
import { getApplicationAvailability } from "@/lib/survey/application-window-server";
import { Logo } from "@/components/brand/logo";
import { surveySource } from "@/lib/survey/source";

export const metadata: Metadata = {
  title: "PLP application",
};

export const dynamic = "force-dynamic";

export default async function SurveyPage() {
  const applicationStatus = await getApplicationAvailability();

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Slim header — the survey itself is the focus */}
      <div className="border-b border-border/70 bg-paper-warm/70 backdrop-blur-sm">
        <div className="container flex items-center justify-between gap-4 py-4">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:bg-plp-50 hover:text-plp-700"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Exit
          </Link>
        </div>
      </div>

      <main id="main" className="container max-w-6xl pb-24 pt-8">
        <SetupNotice context="submit" />

        <div className="mb-6">
          <ApplicationWindowNotice status={applicationStatus} />
        </div>

        {/* The exact form title, carried through from the source */}
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-plp-500">
          {surveySource.form_title}
        </p>
        <div className="rule-accent mt-3 max-w-[6rem]" />

        <div className="mt-8">
          <SurveyForm
            previewStatus={applicationStatus === "open" ? undefined : applicationStatus}
          />
        </div>
      </main>
    </div>
  );
}
