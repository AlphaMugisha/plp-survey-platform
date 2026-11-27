# Setup & deployment

Everything below is required to take the platform from "runs locally with no
database" to "collecting real responses".

---

## 1. Prerequisites

- **Node.js 20 or newer** (built and tested on Node 24)
- A **Supabase** project (the free tier is sufficient)

XAMPP/Apache is **not** used. This is a Next.js application — it does not run
under Apache's `htdocs` the way a PHP app would, even though it lives in that
folder. Start it with `npm run dev` / `npm start`, not by visiting
`localhost/plp`.

---

## 2. Install

```bash
cd C:\xampp\htdocs\plp
npm install
```

---

## 3. Create the Supabase project

1. Go to <https://supabase.com/dashboard> and create a project.
2. Open **Project Settings → API** and copy:
   - **Project URL**
   - **anon / public** key
   - **service_role** key

---

## 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Where it comes from | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API | Safe in the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API | Safe in the browser; gated by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API | **Server only — bypasses RLS.** Never prefix with `NEXT_PUBLIC_` |
| `IP_HASH_SALT` | generate yourself | Optional. Without it, no IP hash is stored at all |

Generate a salt with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`.env.local` is git-ignored. Never commit real keys.

Until these are set, the app still runs: the survey renders from the verified
source file and the UI says plainly that submissions cannot be saved. It never
pretends to have stored anything.

---

## 5. Run the migrations

Open **Supabase Dashboard → SQL Editor** and run these files **in order**,
one at a time, from `supabase/migrations/`:

| File | What it does |
|---|---|
| `20260101000100_schema.sql` | Tables, enums, constraints, indexes, integrity triggers |
| `20260101000200_rls.sql` | Row Level Security policies and the admin reporting view |
| `20260101000300_seed_schools.sql` | Seeds all **180** schools (generated from the source file) |
| `20260101000400_seed_survey_baseline.sql` | Seeds the survey, **5** sections and **28** questions (generated) |
| `20260101000500_admin_setup.sql` | `grant_admin()` / `set_admin_active()` and the admin bootstrap |

`0003` and `0004` each end with a self-check that **fails loudly** if the seeded
counts do not match the source file, so a partial paste cannot pass silently.
Both are safe to re-run: `0004` skips seeding if the survey already has
questions.

> If you prefer the Supabase CLI: `supabase db push` picks the same files up
> from `supabase/migrations/`.

---

## 6. Create the first administrator

There is **no public registration**. An administrator needs two things: a
Supabase Auth user, *and* an active row in `admin_profiles`.

1. **Supabase Dashboard → Authentication → Users → Add user**
   (or *Invite user* so they set their own password).
   Use a real address you control.

2. **SQL Editor:**

   ```sql
   select public.grant_admin('you@example.org', 'owner');
   ```

3. Sign in at <http://localhost:3000/admin/login>.

To add more staff later, an existing **owner** runs the same function with
`'admin'` (full management) or `'viewer'` (read-only):

```sql
select public.grant_admin('colleague@example.org', 'viewer');
```

To revoke access immediately:

```sql
select public.set_admin_active('colleague@example.org', false);
```

The function refuses to deactivate the last active owner.

> Set passwords through Supabase's own interface or an invite email. Do not
> share them over chat.
## 6b. Password resets (required for "Forgot password?")

The staff sign-in page has a **Forgot password?** link. It emails a one-hour,
single-use link that lands on `/auth/confirm`, which verifies the token and
forwards to `/auth/reset-password`.

Two things must be configured in Supabase, or the email link will fail.

### Allow the redirect URL

**Authentication -> URL Configuration**

| Field | Development | Production |
|---|---|---|
| Site URL | `http://localhost:3000` | your real URL |
| Redirect URLs | `http://localhost:3000/**` | `https://your-domain/**` |

Supabase refuses to redirect anywhere that is not on this allow-list. If the
list is wrong, the user lands on a Supabase error page instead of the reset
form.

### Email delivery

The built-in email service is for development only — a handful of messages per
hour, and on some plans it delivers only to members of your Supabase
organisation. **If the email never arrives, this is almost always why.**

Before real staff use it, configure your own SMTP under
**Project Settings -> Authentication -> SMTP Settings** (Resend, Postmark,
SendGrid, Amazon SES or your own mail server all work). Without it, resets fail
silently for most addresses.

### Testing it

1. Go to `/admin/login` and click **Forgot password?**
2. Enter the email of an existing staff account
3. Open the link in the email
4. Set a new password — at least 10 characters, with a letter, a number and a
   symbol

The page explains itself when a link is expired, already used, or tampered
with, rather than showing a form that cannot work.

> Resetting a password signs that account out everywhere else, since a reset
> usually means the old password is no longer trusted.
## 6c. Deployment overrides (this install: New Generation Academy)

`data/survey-source.json` is the verified extract of the original Google Form
and is **never** edited for one rollout. Where a rollout genuinely needs
different answer options, they are declared in **`data/deployment.json`**.

This install declares four:

| Override | Official form | This deployment | Why |
|---|---|---|---|
| School list | 180 schools | **New Generation Academy** | Recruitment drive at a school not yet on the official form |
| Year levels | S1–S6 | **Grade 7 – Grade 10, Year 1, Year 2** | The school grades its years that way |
| Questions | 28 questions | **none — all withheld** | This is a club application, not the termly baseline. The club writes its own questions in the admin dashboard. |
| Wording | a survey | **an application** | Applicants are applying to join a club, not filling in a baseline |

Everything else — question wording, help text, ordering, required flags, the
original Google entry ids — comes from the source file unchanged.

### Withholding questions

`overrides.questions.include` lists the entry ids a rollout asks. The rest are
**withheld, not deleted**:

* they stay in `data/survey-source.json`, and `npm run verify:survey` still
  checks all 28 of them against the original form on every run
* their rows stay in the database as an archive of the verified instrument —
  `npm run verify:db` reports them as "kept but not asked" rather than as an
  error
* an answer submitted to a withheld question is **rejected** by the server, so
  withholding is enforced and not merely cosmetic
* clearing the `include` list restores the whole form, all five sections, with
  no code change

An empty list is legal and is what this install uses: the admin writes every
question in **Admin → Surveys → Application questions**, and those appear on
the form immediately.

Because no question is asked, two things are filled in on the applicant's
behalf rather than left blank:

* the **school**, since the overlay declares exactly one — otherwise every
  response would be unattributed and the dashboard's school filter useless
* nothing else; the applicant's name now comes from a question the admin wrote,
  so `full_name` reads "Not provided" and the name lives with the answers

## 6d. The live application: PLP Ishami

The questions applicants actually answer are PLP's **Membership Application &
Family Questionnaire** — a different instrument from the Google Form baseline
survey. It lives in **`data/application-questions.json`**: 6 parts, 19
questions, transcribed verbatim.

That file is a **seed, not a source of truth**. Once applied, the database is
authoritative — every question is inserted with `is_custom = true`, so
administrators can edit, add and remove them from
**Admin → Surveys → Application questions**. `verify:survey` does not police
them; it only ever checks the Google Form extract.

### Applying it

Run these two migrations in the SQL Editor, in order:

| Migration | What it does |
|---|---|
| `20261127085000_admin_added_sections.sql` | Adds `survey_sections.is_custom` and replaces the section guard, so admin-created question GROUPS are possible at all. Also makes `questions.section_id` `ON DELETE SET NULL`, so deleting a group cannot delete its questions. |
| `20261127090000_seed_plp_ishami_application.sql` | Seeds the 6 parts and 19 questions. Refuses to run once there are responses. |

Then:

```bash
npm run verify:db
```

### Editing the questions

Day to day, edit them in the dashboard. If you want to change the *seed* — so a
fresh database starts from the new text — edit the JSON and regenerate:

```bash
node scripts/generate-application-seed.mjs
```

Never hand-edit the generated migration. `tests/application-questions.test.ts`
asserts every title and option appears in the SQL, so the two cannot drift.

### How an applicant sees it

One step per part, in PLP's order, with the part title as the heading and the
final agreement text shown above the Name / Signature / Date fields. A question
an admin adds without a part still appears, in a trailing "Additional
questions" step — never silently dropped.

### Two things worth knowing

* **"Other: __________" is filled in, not just chosen.** The option is stored
  exactly as supplied, and the underscores are treated as what they are on
  paper — a blank. Picking it reveals a text box, and the answer is stored as
  the option with its blank filled: `Other: Debate club`. One answer in one
  column, reads correctly in a CSV export, and no extra question.

  Validation accepts an exact option or a filled-in one and nothing else.
  Choosing "Other" and writing nothing is not a valid answer, on the client or
  the server, and does not count towards progress. The rule is generic: any
  option ending in two or more underscores behaves this way, so a question an
  admin writes later needs no code change. See
  `src/lib/survey/fill-in-option.ts`.
* **The leading list numbers are not stored.** The form renders its own
  question numbering per step, so storing "2. How would you describe…" would
  number everything twice. The question text itself is untouched.

---

### Wording

`framing` changes only the chrome — headings, button labels, the word used for
a submission — and can never touch a question, an option, the form title or the
confirmation message. Defaults live in `src/lib/survey/framing.ts`, so clearing
`framing` returns every label to its survey wording.

### Applying it to the database

Run **`supabase/migrations/20260101000800_deployment_overrides.sql`** in the SQL
Editor. It adds the school, narrows the two option lists, and **deactivates**
(never deletes) the other 179 schools so they can be restored later. It refuses
to run once the survey has responses.

Then confirm with:

```bash
npm run verify:db
```

### Checking what deviates

```bash
npm run verify:survey
```

prints a **Deployment overlay** section listing every deviation and its reason,
so nothing here is silent. The source file is still verified in full by the same
run, and its fingerprint is unchanged.

### Going back to the official form

1. Clear the entries under `"overrides"` and `"framing"` in
   `data/deployment.json` — including `overrides.questions`, which restores all
   28 questions and all 5 sections
2. Re-activate the schools:
   ```sql
   update public.schools set is_active = true;
   ```
3. Re-run `20260101000400_seed_survey_baseline.sql`'s option values, or restore
   them directly, then `npm run verify:db`

---



---



---

## 7. Run it

```bash
npm run dev     # development, http://localhost:3000
```

```bash
npm run build   # production build
npm start       # serve the production build
```

| Route | Who it is for |
|---|---|
| `/` | Landing page |
| `/survey` | The baseline survey |
| `/survey/thank-you` | Confirmation |
| `/admin/login` | Staff sign-in |
| `/admin` | Overview |
| `/admin/analytics` | Averages and distributions |
| `/admin/responses` | Search, filter, open, export |
| `/admin/surveys` | Activate, close, version |

---

## 8. Verify the content

Run this after **any** change that could touch survey content, and in CI:

```bash
npm run verify:survey
```

It compares `data/survey-source.json` against the application model, the guided
step layout and the generated seed SQL, then checks a SHA-256 fingerprint of the
content against the committed baseline in `data/content-fingerprint.json`.
It exits non-zero on any mismatch.

If you change the survey content **on purpose**, re-verify against the original
Google Form first, then re-baseline:

```bash
npm run generate:migrations      # regenerate the seed SQL from the source
npm run verify:survey -- --update # re-baseline the fingerprint
```

Full test suite:

```bash
npm test
```

---

## 9. Verifying RLS against the live database

The automated tests assert the **policy definitions** statically. To confirm
Postgres is enforcing them at runtime, after running the migrations:

```sql
-- Should return rows (public survey content):
set role anon;
select count(*) from public.schools;
select count(*) from public.questions;

-- Should each return 0 rows / permission denied:
select count(*) from public.survey_responses;
select count(*) from public.answers;

reset role;
```

A signed-in user **without** an active `admin_profiles` row should see exactly
the same thing as `anon`.

---

## 9b. Going live — what actually has to change

Short answer: **no code changes.** Auth email links are built from the
browser's own origin, so the same build works on `localhost:3000` today and on
your real domain later.

Three things to do when you deploy:

| # | Where | Change |
|---|---|---|
| 1 | Supabase -> Authentication -> URL Configuration | **Add** the production URL to **Redirect URLs** (`https://your-domain/**`) and set **Site URL** to it |
| 2 | Supabase -> Project Settings -> Authentication -> SMTP | Configure real SMTP, or reset emails will not reach most addresses |
| 3 | Your host's env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (as a secret) |

**Keep the localhost entry in the Redirect URLs list.** It is an allow-list, not
a single value — leaving `http://localhost:3000/**` there means local
development keeps working after you go live.

`NEXT_PUBLIC_SITE_URL` should stay **blank** unless the browser cannot see the
real public URL (behind a reverse proxy), or you want to force one canonical
domain. If you set it to localhost it will pin email links to localhost in
production, which is exactly the bug it looks like it prevents.

Also worth doing at go-live:
- Run the migrations against the production Supabase project
- Create the first administrator there (step 6)
- Run `npm run verify:db` against production
- Run `npm run verify:survey` in CI so content drift fails the build

---


## 10. Deploying

The app runs anywhere Next.js 15 runs (Vercel, a Node host, a container).

1. Set the same three environment variables in the host's settings —
   `SUPABASE_SERVICE_ROLE_KEY` as a **server-side secret**, never exposed.
2. Set `NEXT_PUBLIC_SITE_URL` to the public URL.
3. Run the migrations against the production Supabase project.
4. Create the first administrator there (step 6).
5. Run `npm run verify:survey` in CI so content drift fails the build.

### Before collecting real responses

- Confirm the survey's status is `active` in **/admin/surveys**.
- Confirm `/admin` is reachable only after signing in as an administrator.
- Run the `set role anon` checks in step 9 against production.

---

## Operational notes

**One response per email per survey.** Enforced by a unique index. A student who
must redo the survey needs their existing response deleted first (answers
cascade), or the index dropped:

```sql
drop index public.survey_responses_one_per_email_idx;
```

**The baseline survey is immutable once it has responses.** Database triggers
refuse content edits to a survey that has been answered. Next term's survey is a
**new row** — create it from **/admin/surveys → New survey**, which copies the
sections and questions and leaves the original and its responses untouched.

**Draft answers are stored in the student's browser** (`localStorage`) so a
refresh or dropped connection does not lose work. The draft is cleared as soon
as the response is accepted.
