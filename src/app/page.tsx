import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  ListChecks,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { SiteFooter } from "@/components/site/site-footer";
import { eyebrowFor, isApplication, labels, sentenceCase } from "@/lib/survey/framing";
import { ApplicationWindowNotice } from "@/components/site/application-window-notice";
import { getApplicationAvailability } from "@/lib/survey/application-window-server";
import { getApplicationQuestions } from "@/lib/survey/database-questions";
import { PhotoSlot } from "@/components/site/photo-slot";
import { ImigongoBand, ImigongoPanel, ImigongoPattern } from "@/components/brand/imigongo";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  estimatedMinutes,
  headerParagraphs,
  isScaleLegend,
  surveySections,
  surveySource,
  surveyStats,
} from "@/lib/survey/source";

export const dynamic = "force-dynamic";

/* The intro is one field in the original form containing three blocks:
   the curriculum line, the explanation, and the privacy note. We lay them out
   separately but never alter a character. */
const [curriculumLine, introBody, privacyNote] = [
  headerParagraphs[0] ?? "",
  headerParagraphs[1] ?? "",
  headerParagraphs[2] ?? "",
];

/**
 * Facts about Peace and Love Proclaimers.
 *
 * These are taken from published sources about the organisation, not written
 * as marketing copy. If any detail is out of date, correct it here — this is
 * the only place in the app that describes PLP itself.
 *
 * Sources: The New Times (Rwanda), PLP's own channels, LinkedIn.
 */
const ABOUT_PLP = {
  founded: "16 July 2007",
  foundedBy: "a group of seven Rwandan students",
  base: "Kigali, Rwanda",
  members: "200+",
  countries: "Rwanda, India, the USA and Malaysia",
  walkToRemember: 25,
} as const;

export default async function LandingPage() {
  const applicationStatus = await getApplicationAvailability();

  // The live form is the declared source questions PLUS whatever the admin has
  // added, so the only honest count comes from the same loader the form uses.
  const liveQuestions = await getApplicationQuestions();
  const liveCount = liveQuestions.length;
  const liveSections = surveySections.length;
  const liveRequired = liveQuestions.filter((q) => q.required).length;
  const liveOptional = liveCount - liveRequired;

  const questionSummary = {
    value:
      liveSections > 0
        ? `${liveCount} across ${liveSections} section${liveSections === 1 ? "" : "s"}`
        : `${liveCount} question${liveCount === 1 ? "" : "s"}`,
    note:
      liveOptional > 0
        ? `${liveRequired} required, ${liveOptional} optional.`
        : "All of them required.",
  };

  return (
    <div className="min-h-dvh bg-white">
      {/* ===================== HEADER ===================== */}
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur-sm">
        <div className="container flex items-center justify-between gap-4 py-3.5">
          <Link href="/" className="rounded-lg transition-opacity hover:opacity-80">
            <Logo showTagline />
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:bg-plp-50 hover:text-plp-700 sm:inline-flex"
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              Staff sign in
            </Link>
            <Button asChild size="sm" className="shrink-0">
              <Link href="/survey">{labels.cta}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ===================== HERO ===================== */}
        <section className="border-b border-border bg-paper">
          <div className="container grid gap-12 py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-16 lg:py-20">
            <div>
              <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-plp-600">
                {isApplication ? eyebrowFor(applicationStatus) : curriculumLine}
              </p>

              {/* In application mode the page is headed by what the reader is
                  doing. The instrument's own name — "PLP Survey 1 — Baseline
                  (Beginning of Term 1)" — means nothing to someone who has not
                  joined yet, and reads as the wrong thing entirely. It stays in
                  the database, the admin and the verification report. */}
              <h1 className="mt-4 text-balance font-display text-[2rem] font-bold leading-[1.15] tracking-tight text-plp-900 sm:text-[2.5rem] lg:text-[2.875rem]">
                {isApplication ? labels.headline : surveySource.form_title}
              </h1>

              <p className="mt-5 max-w-xl text-pretty text-[1.0625rem] leading-relaxed text-ink-soft">
                {/* The form's own intro when this IS the survey; the deployment's
                    own wording when it is being used as an application. */}
                {isApplication ? labels.lede : introBody}
              </p>

              <div className="mt-6 max-w-xl">
                <ApplicationWindowNotice status={applicationStatus} />
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="xl" className="group w-full sm:w-auto">
                  <Link href="/survey">
                    {labels.cta}
                    <ArrowRight
                      className="transition-transform duration-300 ease-premium group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>
                <p className="text-[0.875rem] text-ink-muted">
                  Takes about {estimatedMinutes} minutes · No account needed
                </p>
              </div>
            </div>

            {/* Lead visual — a real photo if one has been supplied, otherwise
                imigongo artwork. See public/images/README.md. */}
            <div className="space-y-5">
              <PhotoSlot
                name="hero"
                alt="Students taking part in a Peace and Love Proclaimers school session"
                width={1200}
                height={960}
                priority
                className="aspect-[5/4] rounded-card border border-border shadow-card"
                fallback={<ImigongoPanel className="size-full" />}
              />

              {/* At-a-glance card */}
              <div className="card-surface card-quiet p-6 sm:p-7">
              <h2 className="font-display text-[1.0625rem] font-bold text-plp-800">
                Before you begin
              </h2>
              <dl className="mt-5 divide-y divide-border">
                <Row
                  icon={<Clock3 className="size-[1.0625rem]" aria-hidden="true" />}
                  label="Estimated time"
                  value={`About ${estimatedMinutes} minutes`}
                  note="An estimate only. There is no timer."
                />
                <Row
                  icon={<ListChecks className="size-[1.0625rem]" aria-hidden="true" />}
                  label="Questions"
                  value={questionSummary.value}
                  note={questionSummary.note}
                />
                <Row
                  icon={<Lock className="size-[1.0625rem]" aria-hidden="true" />}
                  label="Privacy"
                  value="Seen only by PLP staff"
                  note="Never shown publicly or to other students."
                />
                </dl>
              </div>
            </div>
          </div>

          <ImigongoBand />
        </section>

        {/* ===================== ABOUT PLP ===================== */}
        <section className="border-b border-border bg-white">
          <div className="container py-14 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
              <div>
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-plp-600">
                  About us
                </p>
                <h2 className="mt-3 font-display text-[1.75rem] font-bold tracking-tight text-plp-900 sm:text-[2rem]">
                  Peace and Love Proclaimers
                </h2>

                <PhotoSlot
                  name="about"
                  alt="Members of Peace and Love Proclaimers at a community activity in Rwanda"
                  width={1000}
                  height={750}
                  className="mt-6 aspect-[4/3] rounded-card border border-border shadow-card"
                  fallback={
                    <ImigongoPattern id="imigongo-about" tone="light" scale={0.75} />
                  }
                />
              </div>

              <div className="space-y-4 text-[1.0625rem] leading-relaxed text-ink-soft">
                <p>
                  PLP is a youth-led Rwandan organisation founded on{" "}
                  <strong className="font-semibold text-plp-800">{ABOUT_PLP.founded}</strong> by{" "}
                  {ABOUT_PLP.foundedBy}, and based in {ABOUT_PLP.base}. It works for unity, peace
                  and development — run by young people, for young people.
                </p>
                <p>
                  PLP runs clubs in secondary schools and universities across Rwanda, and has
                  grown to {ABOUT_PLP.members} members across {ABOUT_PLP.countries}. Its
                  best-known initiative, <strong className="font-semibold text-plp-800">Walk
                  to Remember</strong>, began in Rwanda in 2009 and has since been held in{" "}
                  {ABOUT_PLP.walkToRemember} countries.
                </p>
                <p>
                  The <strong className="font-semibold text-plp-800">PLP Academy</strong> is its
                  educational programme, built to develop writing, public speaking,
                  entrepreneurship, critical thinking and peacebuilding.{" "}
                  {isApplication
                    ? "This club is part of the school curriculum that programme delivers."
                    : "This survey is part of the school curriculum that programme delivers."}
                </p>
              </div>
            </div>

            {/* Real figures only */}
            <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat value="2007" label="Founded in Kigali" />
              <Stat value={ABOUT_PLP.members} label="Members, in four countries" />
              <Stat
                value={String(ABOUT_PLP.walkToRemember)}
                label="Countries have held Walk to Remember"
              />
              <Stat
                value={String(surveyStats.schoolCount)}
                label="Schools listed in this survey"
              />
            </dl>
          </div>
        </section>

        {/* ===================== HOW IT WORKS ===================== */}
        <section className="border-b border-border bg-paper">
          <div className="container py-14 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-plp-600">
                How it works
              </p>
              <h2 className="mt-3 font-display text-[1.75rem] font-bold tracking-tight text-plp-900 sm:text-[2rem]">
                Three steps, start to finish
              </h2>
              <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-muted">
                There are no right or wrong answers, and nothing here affects your grades.
              </p>
            </div>

            <ol className="mt-10 grid gap-5 sm:grid-cols-3">
              {[
                {
                  n: 1,
                  title: "Your details",
                  body: "Your email, name, school and year level. The school list is searchable.",
                },
                {
                  n: 2,
                  title: liveSections > 0 ? "A few short sections" : "The questions",
                  body: `${liveCount} question${liveCount === 1 ? "" : "s"}, shown a few at a time. You can go back and change anything.`,
                },
                {
                  n: 3,
                  title: "Review and submit",
                  body: "Check everything on one screen, then send.",
                },
              ].map((step) => (
                <li key={step.n} className="card-surface card-interactive group p-6">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-10 items-center justify-center rounded-xl bg-plp-600 text-[1rem] font-bold text-white shadow-button transition-all duration-300 ease-premium group-hover:scale-105 group-hover:bg-plp-500 group-hover:shadow-glow-brand"
                  >
                    {step.n}
                  </span>
                  <h3 className="mt-4 font-display text-[1.0625rem] font-bold text-plp-800 transition-colors duration-300 group-hover:text-plp-600">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>

            <div className="mt-9">
              <Button asChild size="lg" className="group w-full sm:w-auto">
                <Link href="/survey">
                  {labels.cta}
                  <ArrowRight
                    className="transition-transform duration-300 ease-premium group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ===================== SECTIONS ===================== */}
        <section className="border-b border-border bg-white">
          <div className="container py-14 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-plp-600">
                {isApplication ? sentenceCase(labels.noun) : "The survey"}
              </p>
              <h2 className="mt-3 font-display text-[1.75rem] font-bold tracking-tight text-plp-900 sm:text-[2rem]">
                What you will be asked
              </h2>
              <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-muted">
                {liveSections > 0
                  ? `${liveSections} section${liveSections === 1 ? "" : "s"}, shown a few at a time. Your answers are kept as you move between them, so you can stop and come back.`
                  : "Shown a few at a time. Your answers are kept as you move between them, so you can stop and come back."}
              </p>
            </div>

            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {/* No sections means this deployment asks its own short set of
                  questions rather than the termly instrument, so the reader is
                  shown the questions themselves. */}
              {liveSections === 0 &&
                liveQuestions.map((question, i) => (
                  <li key={question.entry_id}>
                    <article className="card-surface card-interactive group h-full p-6">
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className="inline-flex size-10 items-center justify-center rounded-xl bg-plp-50 text-[0.875rem] font-bold text-plp-700 transition-all duration-300 ease-premium group-hover:bg-plp-600 group-hover:text-white group-hover:shadow-glow-brand"
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                        <Badge
                          variant="neutral"
                          size="sm"
                          className="transition-colors duration-300 group-hover:border-plp-200 group-hover:bg-plp-50 group-hover:text-plp-700"
                        >
                          {question.options?.length ? "Choose" : "Write"}
                        </Badge>
                      </div>

                      <h3 className="mt-4 font-display text-[1.0625rem] font-bold leading-snug text-plp-800 transition-colors duration-300 group-hover:text-plp-600">
                        {question.title}
                      </h3>

                      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
                        {question.description
                          ? question.description.split(/\n{2,}/u)[0]
                          : question.options?.length
                            ? `Pick one of ${question.options.length}.`
                            : "In your own words."}
                      </p>
                    </article>
                  </li>
                ))}

              {surveySections.map((section) => (
                <li key={section.index}>
                  <article className="card-surface card-interactive group h-full p-6">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="inline-flex size-10 items-center justify-center rounded-xl bg-plp-50 text-[0.875rem] font-bold text-plp-700 transition-all duration-300 ease-premium group-hover:bg-plp-600 group-hover:text-white group-hover:shadow-glow-brand"
                        aria-hidden="true"
                      >
                        {section.shortLabel}
                      </span>
                      <Badge
                        variant="neutral"
                        size="sm"
                        className="transition-colors duration-300 group-hover:border-plp-200 group-hover:bg-plp-50 group-hover:text-plp-700"
                      >
                        {section.questions.length}{" "}
                        {section.questions.length === 1 ? "question" : "questions"}
                      </Badge>
                    </div>

                    <h3 className="mt-4 font-display text-[1.0625rem] font-bold leading-snug text-plp-800 transition-colors duration-300 group-hover:text-plp-600">
                      {section.plainTitle}
                    </h3>

                    <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
                      {section.description && !isScaleLegend(section.description)
                        ? section.description.split(/\n{2,}/u)[0]
                        : section.questions.length >= 5
                          ? "Rated on a five-point scale, from Strongly Disagree to Strongly Agree."
                          : "Written answers in your own words."}
                    </p>
                  </article>
                </li>
              ))}

              {/* Sixth cell: completes the row, and puts the action where the
                  reader finishes scanning the list. */}
              <li>
                <article className="card-interactive group flex h-full flex-col justify-center rounded-card border border-plp-200 bg-plp-50 p-6 text-center">
                  <h3 className="font-display text-[1.0625rem] font-bold text-plp-800">
                    That&apos;s everything
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
                    You can stop part-way and come back — your answers are saved in this
                    browser.
                  </p>
                  <Button asChild size="md" className="mt-5 w-full">
                    <Link href="/survey">
                      {labels.cta}
                      <ArrowRight
                        className="transition-transform duration-300 ease-premium group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </Link>
                  </Button>
                </article>
              </li>
            </ul>
          </div>
        </section>

        {/* ===================== PRIVACY ===================== */}
        <section className="border-b border-border bg-paper">
          <div className="container py-14 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
              <div>
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-plp-600">
                  Privacy
                </p>
                <h2 className="mt-3 font-display text-[1.75rem] font-bold tracking-tight text-plp-900 sm:text-[2rem]">
                  Who sees your answers
                </h2>
              </div>

              <div>
                {/* The original privacy sentence, verbatim */}
                <p className="text-[1.0625rem] leading-relaxed text-ink-soft">{privacyNote}</p>

                <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                  {/* Ours, not the form's — so it has to describe what this
                      deployment actually does with the answers. */}
                  {(isApplication
                    ? [
                        "Only PLP programme staff can see individual applications.",
                        "Your answers are never shown publicly or to other students.",
                        "Your application is read by the people running the club.",
                        "Your email is collected so PLP can get back to you.",
                      ]
                    : [
                        "Only PLP programme staff can see individual answers.",
                        "Your answers are never shown publicly or to other students.",
                        "Results are reported as school and programme averages.",
                        "Your email is collected so later surveys can be matched to this one.",
                      ]
                  ).map((item) => (
                    <li
                      key={item}
                      className="card-quiet flex gap-3 rounded-xl border border-border bg-white p-4 text-[0.9375rem] leading-relaxed text-ink-soft"
                    >
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-plp-600"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== CLOSING ===================== */}
        <section className="bg-white">
          <div className="container py-14 lg:py-20">
            <div className="relative overflow-hidden rounded-card border border-plp-200 bg-plp-50 p-8 text-center sm:p-10">
              {/* Imigongo artwork, held well back so the text stays dominant */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
              >
                <ImigongoPattern id="imigongo-cta" tone="light" scale={0.6} />
              </div>

              <div className="relative">
              <h2 className="font-display text-[1.5rem] font-bold tracking-tight text-plp-900 sm:text-[1.75rem]">
                Ready when you are
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[1.0625rem] leading-relaxed text-ink-soft">
                Answer honestly, at your own pace. You will see a review of everything before it
                is submitted.
              </p>
              <Button asChild size="xl" className="group mt-7 w-full sm:w-auto">
                <Link href="/survey">
                  {labels.cta}
                  <ArrowRight
                    className="transition-transform duration-300 ease-premium group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
              </div>
            </div>

            <SiteFooter />
          </div>
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Row({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex gap-3.5 py-4 first:pt-0 last:pb-0">
      <span className="mt-0.5 shrink-0 text-plp-600" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-ink-muted">
          {label}
        </dt>
        <dd className="mt-1 text-[0.9375rem] font-medium text-plp-800">{value}</dd>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">{note}</p>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card-surface card-quiet group p-5">
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block font-display text-[1.875rem] font-bold leading-none tracking-tight text-plp-700 transition-colors duration-300 group-hover:text-plp-500">
          {value}
        </span>
        <span className="mt-2 block text-[0.875rem] leading-relaxed text-ink-muted">
          {label}
        </span>
      </dd>
    </div>
  );
}
