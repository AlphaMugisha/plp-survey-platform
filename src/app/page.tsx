import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ListChecks,
  Lock,
  School,
} from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal, RevealGroup, RevealItem, GlowBlob } from "@/components/motion/reveal";
import {
  estimatedMinutes,
  headerParagraphs,
  isScaleLegend,
  surveySections,
  surveySource,
  surveyStats,
} from "@/lib/survey/source";

/* The intro is one field in the original form containing three blocks:
   the curriculum line, the explanation, and the privacy note. We lay them out
   separately but never alter a character. */
const [curriculumLine, introBody, privacyNote] = [
  headerParagraphs[0] ?? "",
  headerParagraphs[1] ?? "",
  headerParagraphs[2] ?? "",
];

export default function LandingPage() {
  return (
    <div className="relative">
      {/* ================= HERO — one job: get people started ================= */}
      <section className="relative overflow-hidden bg-plp-panel">
        <GlowBlob
          color="radial-gradient(circle, rgba(143,198,238,0.38), transparent 70%)"
          className="-left-28 -top-36 size-[34rem]"
        />
        <GlowBlob
          color="radial-gradient(circle, rgba(29,117,189,0.55), transparent 70%)"
          className="-right-24 top-4 size-[30rem]"
          drift={false}
        />
        <span
          aria-hidden="true"
          className="bg-dotgrid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]"
        />

        <div className="relative mx-auto flex min-h-[44rem] max-w-5xl flex-col px-5 sm:px-8">
          <SiteHeader tone="dark" />

          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <Reveal>
              <Badge variant="onDark" size="lg" className="mb-8">
                {curriculumLine}
              </Badge>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="max-w-3xl text-balance font-display text-display-sm font-bold text-white sm:text-display-md lg:text-display-lg">
                {surveySource.form_title}
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-6 max-w-xl text-pretty text-[1.0625rem] leading-relaxed text-accent-200/90">
                A short, honest snapshot of where you are today — before the PLP programme
                begins. No right answers. No marks.
              </p>
            </Reveal>

            {/* ---------- THE START ACTION ---------- */}
            <Reveal delay={0.16}>
              <div className="mt-10 flex flex-col items-center gap-5">
                <Button asChild variant="hero" size="hero" className="group w-full sm:w-auto">
                  <Link href="/survey">
                    Start the survey
                    <ArrowRight
                      className="transition-transform duration-300 ease-premium group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>

                {/* Answers the two questions that stop people clicking */}
                <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.875rem] text-accent-200/80">
                  {[
                    `About ${estimatedMinutes} minutes`,
                    "No account needed",
                    "Your answers stay private",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-accent-300" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          {/* scroll affordance */}
          <div className="flex justify-center pb-10">
            <a
              href="#how-it-works"
              className="group inline-flex flex-col items-center gap-1.5 rounded-xl px-4 py-2 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-white/55 transition-colors hover:text-white"
            >
              What you&apos;ll be asked
              <ChevronDown className="size-4 animate-nudge-down" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <main id="main">
        {/* ================= HOW IT WORKS ================= */}
        <section id="how-it-works" className="container scroll-mt-8 pt-20 sm:pt-24">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-plp-500">
                How it works
              </p>
              <h2 className="mt-4 text-balance font-display text-display-sm font-bold tracking-tight text-plp-800">
                Three steps, start to finish
              </h2>
            </div>
          </Reveal>

          <RevealGroup as="ol" className="mx-auto mt-12 grid max-w-4xl gap-5 sm:grid-cols-3">
            {[
              {
                n: 1,
                title: "Your details",
                body: "Your email, name, school and year level. The school list is searchable.",
              },
              {
                n: 2,
                title: "Five short sections",
                body: `${surveyStats.questionCount} questions, shown a few at a time. You can go back and change anything.`,
              },
              {
                n: 3,
                title: "Review and submit",
                body: "Check everything on one screen, then send. That's it.",
              },
            ].map((step) => (
              <RevealItem as="li" key={step.n}>
                <div className="card-lux h-full p-6">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-11 items-center justify-center rounded-xl bg-plp-sheen font-display text-[1.0625rem] font-bold text-white shadow-button"
                  >
                    {step.n}
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-plp-800">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink-muted">
                    {step.body}
                  </p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>

          {/* Second chance to start, right where the question is answered */}
          <Reveal delay={0.1}>
            <div className="mt-10 flex justify-center">
              <Button asChild size="xl" className="group">
                <Link href="/survey">
                  Start now
                  <ArrowRight
                    className="transition-transform duration-300 ease-premium group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            </div>
          </Reveal>
        </section>

        {/* ================= WHY ================= */}
        <section className="container pt-20 sm:pt-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
            <Reveal>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-plp-500">
                Why we ask
              </p>
              <div className="rule-accent mt-3 max-w-[6rem]" />
              <h2 className="mt-5 text-balance font-display text-display-sm font-bold tracking-tight text-plp-800">
                A starting point, not a test
              </h2>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="space-y-5 text-[1.0625rem] leading-relaxed text-ink-soft">
                {/* The original intro text, verbatim */}
                <p>{introBody}</p>
                <p>
                  You will answer a similar survey at the end of each term and again at the end
                  of the year. Comparing those answers is how we measure growth — yours, your
                  school&apos;s, and the programme&apos;s.
                </p>
                <p className="font-semibold text-plp-700">
                  There are no right or wrong answers, and nothing here affects your grades.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ================= SECTIONS ================= */}
        <section className="container pt-20 sm:pt-24">
          <Reveal>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-plp-500">
                  The sections
                </p>
                <div className="rule-accent mt-3 max-w-[6rem]" />
                <h2 className="mt-5 font-display text-display-sm font-bold tracking-tight text-plp-800">
                  What you will be asked
                </h2>
              </div>
              <p className="max-w-sm text-[0.9375rem] leading-relaxed text-ink-muted">
                Five sections, shown one at a time so you can focus. Your answers are kept as you
                move between them.
              </p>
            </div>
          </Reveal>

          <RevealGroup as="ul" className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {surveySections.map((section) => (
              <RevealItem as="li" key={section.index}>
                <article className="card-lux card-interactive group h-full p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className="inline-flex size-11 items-center justify-center rounded-xl bg-plp-sheen font-display text-[0.9375rem] font-bold text-white shadow-button transition-shadow duration-300 ease-premium group-hover:shadow-glow-brand"
                      aria-hidden="true"
                    >
                      {section.shortLabel}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {section.questions.length}{" "}
                      {section.questions.length === 1 ? "question" : "questions"}
                    </Badge>
                  </div>

                  <h3 className="mt-5 font-display text-lg font-bold leading-snug tracking-tight text-plp-800">
                    {section.plainTitle}
                  </h3>

                  <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
                    {section.description && !isScaleLegend(section.description)
                      ? section.description.split(/\n{2,}/u)[0]
                      : section.questions.length >= 5
                        ? "Rated on a five-point scale, from Strongly Disagree to Strongly Agree."
                        : "Written answers in your own words."}
                  </p>
                </article>
              </RevealItem>
            ))}

            <RevealItem as="li">
              <article className="card-lux flex h-full flex-col justify-center border-dashed p-6 text-center">
                <p className="font-display text-lg font-bold tracking-tight text-plp-800">
                  Ready?
                </p>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
                  You can stop and come back — your answers are saved in this browser.
                </p>
                <Button asChild size="md" className="mt-5 w-full">
                  <Link href="/survey">Start the survey</Link>
                </Button>
              </article>
            </RevealItem>
          </RevealGroup>
        </section>

        {/* ================= PRIVACY ================= */}
        <section className="container pt-20 sm:pt-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-panel bg-plp-panel px-6 py-10 shadow-raised sm:px-10 sm:py-12">
              <GlowBlob
                color="radial-gradient(circle, rgba(143,198,238,0.28), transparent 70%)"
                className="-right-16 -top-24 size-[22rem]"
                drift={false}
              />
              <div className="relative grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-12">
                <span
                  className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-accent-300"
                  aria-hidden="true"
                >
                  <Lock className="size-6" />
                </span>

                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
                    Your privacy
                  </h2>

                  {/* The original privacy sentence, verbatim */}
                  <p className="mt-4 max-w-2xl text-pretty text-[1.0625rem] leading-relaxed text-accent-200/90">
                    {privacyNote}
                  </p>

                  <ul className="mt-7 grid gap-3 text-[0.9375rem] text-accent-200/75 sm:grid-cols-2">
                    {[
                      "Only PLP programme staff can see individual answers.",
                      "Your answers are never shown publicly or to other students.",
                      "Results are reported as school and programme averages.",
                      "Your email is collected so later surveys can be matched to this one.",
                    ].map((item) => (
                      <li key={item} className="flex gap-2.5">
                        <span
                          aria-hidden="true"
                          className="mt-[0.5rem] size-1.5 shrink-0 rounded-full bg-accent-300"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ================= CLOSING ================= */}
        <section className="container pb-28 pt-20 sm:pb-24 sm:pt-24">
          <Reveal>
            <div className="card-lux flex flex-col items-center gap-6 p-10 text-center sm:p-12">
              <div>
                <h2 className="text-balance font-display text-display-sm font-bold tracking-tight text-plp-800">
                  Ready when you are
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-[1.0625rem] leading-relaxed text-ink-muted">
                  Answer honestly, at your own pace. You will see a review of everything before
                  it is submitted.
                </p>
              </div>
              <Button asChild variant="primary" size="hero" className="group w-full sm:w-auto">
                <Link href="/survey">
                  Start the survey
                  <ArrowRight
                    className="transition-transform duration-300 ease-premium group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </Button>

              <dl className="mt-2 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[0.875rem] text-ink-muted">
                <Fact
                  icon={<Clock3 className="size-4" />}
                  text={`About ${estimatedMinutes} minutes`}
                />
                <Fact
                  icon={<ListChecks className="size-4" />}
                  text={`${surveyStats.questionCount} questions`}
                />
                <Fact
                  icon={<School className="size-4" />}
                  text={`${surveyStats.schoolCount} schools listed`}
                />
              </dl>
            </div>
          </Reveal>

          <SiteFooter />
        </section>
      </main>

      {/* ============ Sticky start bar — mobile only, always reachable ============ */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 p-3 backdrop-blur-md sm:hidden">
        <Button asChild size="lg" className="w-full">
          <Link href="/survey">
            Start the survey
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Fact({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-plp-500" aria-hidden="true">
        {icon}
      </span>
      {text}
    </div>
  );
}
