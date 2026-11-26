# PLP Survey Platform

Survey platform for the **Peace and Love Proclaimers** school curriculum,
replacing the original Google Form for *PLP Survey 1 — Baseline (Beginning of
Term 1)*.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS and Supabase.

---

## The one rule

**`data/survey-source.json` is the single source of truth for all survey
content**, extracted and verified against the original Google Form.

No question, section, description, answer option, school name or required flag
is ever typed by hand. The UI renders from it, the seed SQL is *generated* from
it, and `npm run verify:survey` fails the build if anything drifts.

The presentation is redesigned freely. The content is not.

| | |
|---|---|
| Sections | 5 |
| Questions | 28 (27 required, 1 optional) |
| Rating questions | 21, on a 5-point scale |
| Schools | 180 |
| Email collection | required (the form's built-in field) |

Scale answers are stored as the **exact original strings**
(`"3 — Neutral / Sometimes"`), never as numbers. Numeric values are derived at
read time, for analytics only.

See [`CONTENT-INVENTORY.md`](./CONTENT-INVENTORY.md) for the human-readable
verification record.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in your Supabase credentials
npm run dev                    # http://localhost:3000
```

The app runs without credentials — the survey renders from the verified source
and states plainly that submissions cannot be saved. Full instructions,
including migrations and creating the first administrator, are in
[`SETUP.md`](./SETUP.md).

> This folder sits inside `xampp/htdocs`, but **Apache/PHP is not used**. Start
> the app with `npm run dev`, not by browsing to `localhost/plp`.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Full test suite (214 tests) |
| `npm run verify:survey` | **Content verification** — exits non-zero on drift |
| `npm run generate:migrations` | Regenerate the seed SQL from the source file |

---

## Project layout

```
data/
  survey-source.json          SINGLE SOURCE OF TRUTH
  content-fingerprint.json    committed SHA-256 baseline of the content
CONTENT-INVENTORY.md          human-readable verification record

supabase/migrations/
  20260101000100_schema.sql             tables, constraints, indexes, integrity triggers
  20260101000200_rls.sql                Row Level Security
  20260101000300_seed_schools.sql       GENERATED — 180 schools
  20260101000400_seed_survey_baseline.sql  GENERATED — 5 sections, 28 questions
  20260101000500_admin_setup.sql        administrator bootstrap

scripts/
  generate-migrations.ts      source file -> seed SQL
  verify-survey.ts            source file -> app + SQL + fingerprint

src/lib/survey/               source loader, schemas, steps, scale maths
src/lib/supabase/             browser / server / service-role clients
src/lib/admin/                auth + dashboard queries
src/components/survey/        participant UI
src/components/admin/         dashboard UI
src/app/                      routes
tests/                        10 suites
```

---

## Architecture notes

**Participants never write to the database.** There is no insert policy for
`anon` on `survey_responses` or `answers`. Submissions go to
`/api/survey/submit`, which re-validates every answer against the source file on
the server and only then writes with the service-role key. That key is kept out
of the browser bundle by `import "server-only"`.

**`answers` is canonical.** `survey_responses` also carries denormalised
`email` / `full_name` / `school_id` / `year_level` columns, populated
server-side from the same validated answers, purely so the dashboard can filter
and index efficiently.

**Defence in depth.** Beyond the server-side checks, the database itself
rejects an answer that is not one of its question's original options, keeps
answers append-only, and refuses content edits to a survey that already has
responses.

**Future surveys are new rows.** The baseline is locked once live. Creating
next term's survey copies its sections and questions into a new record, so
historical submissions stay attached to the instrument they were answered on.

---

## Content verification

`npm run verify:survey` runs 256 checks in four layers:

1. **Source → application model.** Every section title, description, question
   wording, help text, entry id, type, required flag, option set and school
   name, plus original ordering. It also walks the guided step layout to prove
   the multi-step UI neither drops, duplicates nor reorders a question.
2. **Source → database seed.** The generated migrations must contain every
   section, question, entry id, option set and school.
3. **Content fingerprint.** A SHA-256 over the canonical content, compared with
   the committed baseline — so an unintended edit fails even if it is
   structurally valid.
4. **Real DOM rendering** (`npm test`). The actual React components are mounted
   and asserted to display every question's exact wording, every option string
   and all 180 school names.

---

## Accessibility

Semantic fieldsets and legends for rating groups, native radios (so arrow keys
work), labelled controls, visible focus rings, `role="alert"` validation
messages, a skip link, and full honouring of
`prefers-reduced-motion` — every animation collapses to a plain state change.
