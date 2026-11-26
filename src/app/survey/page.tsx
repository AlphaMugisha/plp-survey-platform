import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SurveyForm } from "@/components/survey/survey-form";
import { SetupNotice } from "@/components/site/setup-notice";
import { Logo } from "@/components/brand/logo";
import { surveySource } from "@/lib/survey/source";

export const metadata: Metadata = {
  title: "Baseline survey",
};

export default function SurveyPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      {/* Slim header — the survey itself is the focus */}
      <div className="border-b border-border/70 bg-cream-warm/70 backdrop-blur-sm">
        <div className="container flex items-center justify-between gap-4 py-4">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:bg-forest-50 hover:text-forest-700"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Exit
          </Link>
        </div>
      </div>

      <main id="main" className="container max-w-3xl pb-24 pt-8">
        <SetupNotice context="submit" />

        {/* The exact form title, carried through from the source */}
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-forest-500">
          {surveySource.form_title}
        </p>
        <div className="rule-gold mt-3 max-w-[6rem]" />

        <div className="mt-8">
          <SurveyForm />
        </div>
      </main>
    </div>
  );
}
