import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SurveyForm } from "@/components/survey/survey-form";
import { SetupNotice } from "@/components/site/setup-notice";
import { ApplicationWindowNotice } from "@/components/site/application-window-notice";
import { getApplicationWindowStatus } from "@/lib/survey/application-window";
import { Logo } from "@/components/brand/logo";
import { surveySource } from "@/lib/survey/source";

export const metadata: Metadata = {
  title: "PLP application",
};

export const dynamic = "force-dynamic";

export default function SurveyPage() {
  const applicationStatus = getApplicationWindowStatus();

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

        {applicationStatus === "open" ? (
          <div className="mt-8">
            <SurveyForm />
          </div>
        ) : (
          <div
            role="status"
            className="mt-8 rounded-2xl border border-plp-200 bg-white p-6 sm:p-8"
          >
            <h1 className="font-display text-[1.5rem] font-semibold tracking-tight text-plp-800">
              {applicationStatus === "upcoming"
                ? "Applications are not open yet"
                : "Applications are closed"}
            </h1>
            <p className="mt-3 max-w-2xl text-[1rem] leading-relaxed text-ink-soft">
              {applicationStatus === "upcoming"
                ? "Please come back at midnight on Friday, November 27, 2026 (Johannesburg time) to apply."
                : "The application period ended on Thursday, January 7, 2027."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
