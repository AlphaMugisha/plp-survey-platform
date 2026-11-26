import type { Metadata } from "next";
import Link from "next/link";
import { Lock, ShieldCheck } from "lucide-react";
import { SuccessSeal } from "@/components/survey/success-seal";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { GlowBlob } from "@/components/motion/reveal";
import { surveySource, headerParagraphs } from "@/lib/survey/source";

export const metadata: Metadata = {
  title: "Thank you",
};

export default function ThankYouPage() {
  const privacyNote = headerParagraphs[2] ?? "";

  return (
    <main id="main" className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-14">
      {/* layered lighting */}
      <GlowBlob
        color="radial-gradient(circle, rgba(47,163,107,0.20), transparent 70%)"
        className="-top-20 left-1/2 size-[32rem] -translate-x-1/2"
      />
      <GlowBlob
        color="radial-gradient(circle, rgba(213,168,75,0.16), transparent 70%)"
        className="bottom-0 right-0 size-[24rem]"
        drift={false}
      />

      <div className="relative w-full max-w-xl">
        <div className="card-lux overflow-hidden text-center">
          {/* Forest crest */}
          <div className="relative overflow-hidden bg-plp-panel px-6 pb-10 pt-12">
            <span
              aria-hidden="true"
              className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-paper/25 to-transparent"
            />
            <SuccessSeal />
            <h1 className="mt-7 text-balance font-display text-[1.875rem] font-semibold leading-tight tracking-tight text-paper-warm sm:text-[2.125rem]">
              Your survey is in
            </h1>
          </div>

          <div className="px-6 py-9 sm:px-9">
            {/* The original form's confirmation message, verbatim */}
            <p className="text-pretty text-[1.0625rem] leading-relaxed text-ink-soft">
              {surveySource.confirmation_message}
            </p>

            <div className="mt-8 space-y-3 text-left">
              <Assurance
                icon={<ShieldCheck className="size-[1.125rem]" aria-hidden="true" />}
                title="Response received"
                body="Your answers have been saved. You do not need to do anything else."
              />
              <Assurance
                icon={<Lock className="size-[1.125rem]" aria-hidden="true" />}
                title="Kept private"
                body={privacyNote}
              />
            </div>

            <div className="mt-9 flex flex-col items-center gap-4">
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/">Back to the start</Link>
              </Button>
              <p className="flex items-center gap-2 text-[0.8125rem] text-ink-faint">
                <LogoMark className="size-4" />
                {surveySource.owner}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Assurance({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3.5 rounded-2xl border border-border/70 bg-paper/50 p-4">
      <span
        className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-plp-50 text-plp-600"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[0.9375rem] font-medium text-plp-800">{title}</p>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">{body}</p>
      </div>
    </div>
  );
}
