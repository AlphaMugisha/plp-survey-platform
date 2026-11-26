import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  ListChecks,
  Lock,
  MessagesSquare,
  School,
  Sparkles,
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
    <div className="relative overflow-hidden">
      {/* ================= HERO ================= */}
      <section className="container pt-4">
        <div className="relative overflow-hidden rounded-panel bg-forest-panel shadow-float">
          {/* layered lighting */}
          <GlowBlob
            color="radial-gradient(circle, rgba(63,208,138,0.42), transparent 70%)"
            className="-left-24 -top-32 size-[30rem]"
          />
          <GlowBlob
            color="radial-gradient(circle, rgba(213,168,75,0.30), transparent 70%)"
            className="-right-20 top-10 size-[26rem]"
            drift={false}
          />
          <span
            aria-hidden="true"
            className="bg-dotgrid absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]"
          />
          {/* hairline top light */}
          <span
            aria-hidden="true"
            className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cream/25 to-transparent"
          />

          <div className="relative px-6 sm:px-10 lg:px-14">
            <SiteHeader tone="dark" />

            <div className="grid gap-12 pb-14 pt-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16 lg:pb-20 lg:pt-12">
              {/* ---- left: the ask ---- */}
              <div>
                <Reveal>
                  <Badge variant="onDark" size="lg" className="mb-7">
                    <Sparkles className="size-3.5 text-gold-300" aria-hidden="true" />
                    {curriculumLine}
                  </Badge>
                </Reveal>

                <Reveal delay={0.06}>
                  <h1 className="max-w-2xl text-balance font-display text-display-sm font-semibold text-cream-warm sm:text-display-md lg:text-display-lg">
                    {surveySource.form_title}
                  </h1>
                </Reveal>

                <Reveal delay={0.12}>
                  <p className="mt-7 max-w-xl text-pretty text-[1.0625rem] leading-relaxed text-cream/75">
                    {introBody}
                  </p>
                </Reveal>

                <Reveal delay={0.18}>
                  <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Button asChild variant="accent" size="xl" className="group w-full sm:w-auto">
                      <Link href="/survey">
                        Start survey
                        <ArrowRight
                          className="transition-transform duration-300 ease-premium group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </Link>
                    </Button>

                    <p className="text-sm text-cream/55">
                      {surveyStats.questionCount} questions across{" "}
                      {surveyStats.sectionCount} sections
                    </p>
                  </div>
                </Reveal>
              </div>

              {/* ---- right: at-a-glance facts ---- */}
              <Reveal delay={0.24} className="lg:pt-6">
                <div className="rounded-card border border-cream/15 bg-cream/[0.07] p-6 backdrop-blur-sm sm:p-7">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-gold-300">
                    Before you begin
                  </p>
                  <div className="rule-gold mt-3" />

                  <dl className="mt-6 space-y-6">
                    <GlanceItem
                      icon={<Clock3 className="size-[1.125rem]" aria-hidden="true" />}
                      label="Estimated time"
                      /* Explicitly an estimate — never presented as a limit. */
                      value={`About ${estimatedMinutes} minutes`}
                      note="This is only an estimate. Take as long as you need — there is no timer."
                    />
                    <GlanceItem
                      icon={<ListChecks className="size-[1.125rem]" aria-hidden="true" />}
                      label="What it covers"
                      value={`${surveyStats.questionCount} questions`}
                      note={`${surveyStats.requiredCount} required, ${surveyStats.optionalCount} optional. You can move back and forth before submitting.`}
                    />
                    <GlanceItem
                      icon={<School className="size-[1.125rem]" aria-hidden="true" />}
                      label="Your school"
                      value={`${surveyStats.schoolCount} schools listed`}
                      note="Search the list to find yours quickly."
                    />
                  </dl>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <main id="main" className="container">
        {/* ================= PURPOSE ================= */}
        <section className="pt-20 sm:pt-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <Reveal>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-forest-500">
                Why we ask
              </p>
              <div className="rule-gold mt-3 max-w-[6rem]" />
              <h2 className="mt-5 text-balance font-display text-display-sm font-semibold tracking-tight text-forest-800">
                A starting point, not a test
              </h2>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="space-y-5 text-[1.0625rem] leading-relaxed text-ink-soft">
                <p>
                  This baseline survey is filled in <strong>before</strong> the PLP programme
                  begins. It records where you are today — how you see yourself as a leader, which
                  skills you already have, and what you value.
                </p>
                <p>
                  You will answer a similar survey at the end of each term and again at the end of
                  the year. Comparing those answers is how we measure growth: yours, your
                  school&apos;s, and the programme&apos;s. That only works if today&apos;s answers
                  are honest rather than impressive.
                </p>
                <p className="font-medium text-forest-700">
                  There are no right or wrong answers, and nothing here affects your grades.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ================= SECTION OVERVIEW ================= */}
        <section className="pt-20 sm:pt-24">
          <Reveal>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-forest-500">
                  The journey
                </p>
                <div className="rule-gold mt-3 max-w-[6rem]" />
                <h2 className="mt-5 font-display text-display-sm font-semibold tracking-tight text-forest-800">
                  What you will be asked
                </h2>
              </div>
              <p className="max-w-sm text-[0.9375rem] leading-relaxed text-ink-muted">
                Five sections, shown one at a time so you can focus. Your answers are kept as you
                move between them.
              </p>
            </div>
          </Reveal>

          <RevealGroup
            as="ul"
            className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {surveySections.map((section) => (
              <RevealItem as="li" key={section.index}>
                <article className="card-lux card-interactive group h-full p-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Section code in a glowing forest chip */}
                    <span
                      className={[
                        "inline-flex size-11 items-center justify-center rounded-xl",
                        "bg-forest-sheen font-display text-[0.9375rem] font-semibold text-cream-warm",
                        "shadow-button transition-shadow duration-300 ease-premium",
                        "group-hover:shadow-glow-emerald",
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      {section.shortLabel}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {section.questions.length}{" "}
                      {section.questions.length === 1 ? "question" : "questions"}
                    </Badge>
                  </div>

                  <h3 className="mt-5 font-display text-lg font-semibold leading-snug tracking-tight text-forest-800">
                    {section.plainTitle}
                  </h3>

                  {/* Most section descriptions are just the scale legend — showing it
                      on a marketing card would be noise, so show it only when it is
                      actual prose. The full original text always appears in the survey. */}
                  {section.description && !isScaleLegend(section.description) ? (
                    <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
                      {section.description.split(/\n{2,}/u)[0]}
                    </p>
                  ) : (
                    <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
                      {section.questions.length === 5 || section.questions.length === 6
                        ? "Rated on a five-point scale, from Strongly Disagree to Strongly Agree."
                        : "Written answers in your own words."}
                    </p>
                  )}
                </article>
              </RevealItem>
            ))}

            {/* The participant-details step, so the count on screen matches reality */}
            <RevealItem as="li">
              <article className="card-lux h-full border-dashed p-6">
                <span
                  className="inline-flex size-11 items-center justify-center rounded-xl border border-forest-700/15 bg-forest-50 text-forest-700"
                  aria-hidden="true"
                >
                  <MessagesSquare className="size-5" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold leading-snug tracking-tight text-forest-800">
                  Your details first
                </h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
                  Your email, name, school and year level — so we can match this survey to the ones
                  you fill in later.
                </p>
              </article>
            </RevealItem>
          </RevealGroup>
        </section>

        {/* ================= PRIVACY ================= */}
        <section className="pt-20 sm:pt-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-panel bg-forest-panel px-6 py-10 shadow-raised sm:px-10 sm:py-12">
              <GlowBlob
                color="radial-gradient(circle, rgba(63,208,138,0.30), transparent 70%)"
                className="-right-16 -top-24 size-[22rem]"
                drift={false}
              />
              <div className="relative grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-12">
                <span
                  className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl border border-gold-400/25 bg-gold-400/10 text-gold-300"
                  aria-hidden="true"
                >
                  <Lock className="size-6" />
                </span>

                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-cream-warm sm:text-[1.75rem]">
                    Your privacy
                  </h2>

                  {/* The original privacy sentence, verbatim */}
                  <p className="mt-4 max-w-2xl text-pretty text-[1.0625rem] leading-relaxed text-cream/80">
                    {privacyNote}
                  </p>

                  <ul className="mt-7 grid gap-3 text-[0.9375rem] text-cream/70 sm:grid-cols-2">
                    {[
                      "Only PLP programme staff can see individual answers.",
                      "Your answers are never shown publicly or to other students.",
                      "Results are reported as school and programme averages.",
                      "Your email is collected so later surveys can be matched to this one.",
                    ].map((item) => (
                      <li key={item} className="flex gap-2.5">
                        <span
                          aria-hidden="true"
                          className="mt-[0.5rem] size-1.5 shrink-0 rounded-full bg-emerald-glow"
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

        {/* ================= CLOSING CTA ================= */}
        <section className="pt-20 sm:pt-24">
          <Reveal>
            <div className="card-lux flex flex-col items-start gap-7 p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-balance font-display text-2xl font-semibold tracking-tight text-forest-800 sm:text-[1.75rem]">
                  Ready when you are
                </h2>
                <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-ink-muted">
                  Answer honestly, at your own pace. You will see a review of everything before it
                  is submitted.
                </p>
              </div>
              <Button asChild size="xl" className="group w-full shrink-0 lg:w-auto">
                <Link href="/survey">
                  Begin the baseline survey
                  <ArrowRight
                    className="transition-transform duration-300 ease-premium group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            </div>
          </Reveal>
        </section>

        <SiteFooter />
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function GlanceItem({
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
    <div className="flex gap-4">
      <span
        className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-cream/15 bg-cream/10 text-gold-300"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div>
        <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-cream/50">
          {label}
        </dt>
        <dd className="mt-1 font-medium text-cream-warm">{value}</dd>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-cream/55">{note}</p>
      </div>
    </div>
  );
}
