-- =============================================================================
-- PLP Survey Platform — ALL MIGRATIONS, combined for one-shot execution
--
-- CONVENIENCE FILE. Not a migration itself: it lives outside migrations/ so the
-- Supabase CLI never picks it up.
--
-- HOW TO USE
--   Supabase Dashboard -> SQL Editor -> New query -> paste this whole file -> Run.
--
-- It runs the same five migrations, in order. Watch the output for the
-- self-checks at the end: they RAISE EXCEPTION if the seeded counts do not match
-- the verified source file, so a partial run fails loudly instead of leaving you
-- with an incomplete school list.
--
-- Expect to see:
--   "Baseline survey verified: 5 sections, 28 questions (27 required)."
--
-- Re-running is safe: every statement is idempotent (create ... if not exists,
-- on conflict do nothing, create or replace, drop policy if exists), and the
-- content seed skips itself once the survey already has questions.
-- =============================================================================


-- ===========================================================================
-- BEGIN 20260101000100_schema.sql
-- ===========================================================================

-- =============================================================================
-- PLP Survey Platform — core schema
-- Migration 0001: extensions, enums, tables, constraints, indexes, triggers
-- =============================================================================
--
-- Design notes
-- ------------
-- * `answers` is the CANONICAL store of every response value. Multiple-choice and
--   dropdown answers are stored as the EXACT original option string from the
--   Google Form (e.g. '3 — Neutral / Sometimes'), never as a number.
-- * `survey_responses` additionally carries denormalised `email`, `full_name`,
--   `school_id` and `year_level` columns. These are populated server-side from the
--   same validated answers and exist only so the admin dashboard can filter and
--   index efficiently. `answers` remains the source of truth.
-- * Survey content (sections, questions, options) is seeded from
--   `data/survey-source.json` and becomes immutable once responses exist.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.survey_status as enum ('draft', 'active', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Mirrors the question types present in the original form payload.
  create type public.question_type as enum (
    'short_answer',
    'paragraph',
    'multiple_choice',
    'dropdown',
    'section_header'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.admin_role as enum ('owner', 'admin', 'viewer');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- updated_at helper
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
-- 1. schools — the 180 original dropdown options
-- =============================================================================

create table if not exists public.schools (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  -- position in the original Google Form dropdown, preserved exactly
  display_order integer not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),

  constraint schools_name_unique unique (name),
  constraint schools_display_order_unique unique (display_order),
  constraint schools_name_not_blank check (length(btrim(name)) > 0)
);

comment on table public.schools is
  'Participating schools. Names are reproduced verbatim from the original Google Form dropdown, including original casing, accents and typos.';
comment on column public.schools.display_order is
  'Zero-based position in the original form dropdown. Preserves original ordering.';

create index if not exists schools_name_trgm_idx
  on public.schools using gin (name gin_trgm_ops);
create index if not exists schools_display_order_idx
  on public.schools (display_order);

-- =============================================================================
-- 2. surveys — one row per survey instrument (baseline, term 1 end, ...)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- JSON shape helper
-- -----------------------------------------------------------------------------
-- Postgres forbids a subquery inside a CHECK constraint, so the "is this a
-- non-empty array of strings?" test lives in an IMMUTABLE function instead.

create or replace function public.jsonb_is_string_array(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select v is null
      or (
        jsonb_typeof(v) = 'array'
        and jsonb_array_length(v) > 0
        and not exists (
          select 1
          from jsonb_array_elements(v) as e
          where jsonb_typeof(e) <> 'string'
        )
      );
$$;

comment on function public.jsonb_is_string_array(jsonb) is
  'True when the value is null, or a non-empty JSON array whose every element is a string. Used by questions.options so answer options can never be stored as numbers.';

create table if not exists public.surveys (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null,
  title                text not null,
  -- the original form's header/intro text, verbatim
  description          text,
  confirmation_message text,
  source_url           text,
  collects_email       boolean not null default true,
  email_required       boolean not null default true,
  status               public.survey_status not null default 'draft',
  version              integer not null default 1,
  -- set once content is final; blocks content edits even before the first response
  is_locked            boolean not null default false,
  published_at         timestamptz,
  closed_at            timestamptz,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint surveys_slug_unique unique (slug),
  constraint surveys_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint surveys_version_positive check (version > 0)
);

comment on table public.surveys is
  'Survey instruments. Future surveys are NEW rows — never destructive edits of an existing survey that has responses.';

create index if not exists surveys_status_idx on public.surveys (status);

drop trigger if exists surveys_set_updated_at on public.surveys;
create trigger surveys_set_updated_at
  before update on public.surveys
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 3. survey_sections — the 5 section blocks
-- =============================================================================

create table if not exists public.survey_sections (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references public.surveys (id) on delete cascade,
  -- 1-based display order
  order_index integer not null,
  -- exact section title, e.g. 'SECTION A1 — Leadership Identity & Confidence'
  title       text not null,
  -- exact section description from the original form (null when the form had none)
  description text,
  -- 'A1', 'A2', 'A3', 'B', 'C' — derived label for the progress indicator
  short_label text,
  plain_title text,
  created_at  timestamptz not null default now(),

  constraint survey_sections_order_unique unique (survey_id, order_index),
  constraint survey_sections_title_unique unique (survey_id, title),
  constraint survey_sections_order_positive check (order_index > 0)
);

create index if not exists survey_sections_survey_idx
  on public.survey_sections (survey_id, order_index);

-- =============================================================================
-- 4. questions — the 28 question items
-- =============================================================================

create table if not exists public.questions (
  id           uuid primary key default gen_random_uuid(),
  survey_id    uuid not null references public.surveys (id) on delete cascade,
  -- null for the participant-detail questions that precede the first section
  -- in the original form (Full Name, School Name, Year Level)
  section_id   uuid references public.survey_sections (id) on delete cascade,
  -- ORIGINAL Google Forms entry id — preserved so answers stay traceable to the source
  entry_id     bigint not null,
  -- position in the original form payload; preserves original question order
  order_index  integer not null,
  title        text not null,
  description  text,
  type         public.question_type not null,
  -- exact original answer option strings, in the original order; null for free text
  options      jsonb,
  is_required  boolean not null default false,
  created_at   timestamptz not null default now(),

  constraint questions_entry_unique unique (survey_id, entry_id),
  constraint questions_order_unique unique (survey_id, order_index),
  constraint questions_not_section_header check (type <> 'section_header'),
  constraint questions_title_not_blank check (length(btrim(title)) > 0),
  -- Options must be a non-empty JSON array of strings when present, so an
  -- answer option can never be stored as a number. Delegated to an IMMUTABLE
  -- function because Postgres rejects a subquery inside a CHECK constraint.
  constraint questions_options_shape check (public.jsonb_is_string_array(options)),
  -- choice questions must carry options; free-text questions must not
  constraint questions_options_match_type check (
    (type in ('multiple_choice', 'dropdown') and options is not null)
    or (type in ('short_answer', 'paragraph') and options is null)
  )
);

comment on column public.questions.entry_id is
  'Original Google Forms entry id (entry.<id>). Immutable link back to the source form.';
comment on column public.questions.options is
  'Exact original option strings in original order. Stored as JSON text, never as numbers.';

create index if not exists questions_survey_order_idx
  on public.questions (survey_id, order_index);
create index if not exists questions_section_idx
  on public.questions (section_id);
create index if not exists questions_entry_idx
  on public.questions (entry_id);

-- =============================================================================
-- 5. survey_responses — one row per submission
-- =============================================================================

create table if not exists public.survey_responses (
  id               uuid primary key default gen_random_uuid(),
  survey_id        uuid not null references public.surveys (id) on delete restrict,

  -- Required built-in email collection from the original form
  email            text not null,

  -- Denormalised for admin filtering/search; canonical values live in `answers`
  full_name        text not null,
  school_id        uuid references public.schools (id) on delete restrict,
  school_name      text not null,
  year_level       text not null,

  submitted_at     timestamptz not null default now(),
  duration_seconds integer,
  -- salted hash only; never a raw IP
  ip_hash          text,
  user_agent       text,

  constraint survey_responses_email_format check (
    email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint survey_responses_email_not_blank check (length(btrim(email)) > 0),
  constraint survey_responses_name_not_blank check (length(btrim(full_name)) > 0),
  constraint survey_responses_duration_sane check (
    duration_seconds is null or duration_seconds >= 0
  )
);

comment on table public.survey_responses is
  'One submission per row. Identifiable — readable only by active admins via RLS.';

-- One baseline response per email per survey. Protects the analytics from
-- duplicate submissions. To allow a student to resubmit, delete their existing
-- response (answers cascade) or drop this index.
create unique index if not exists survey_responses_one_per_email_idx
  on public.survey_responses (survey_id, lower(btrim(email)));

create index if not exists survey_responses_survey_submitted_idx
  on public.survey_responses (survey_id, submitted_at desc);
create index if not exists survey_responses_school_idx
  on public.survey_responses (school_id);
create index if not exists survey_responses_year_level_idx
  on public.survey_responses (year_level);
create index if not exists survey_responses_submitted_at_idx
  on public.survey_responses (submitted_at desc);
create index if not exists survey_responses_name_trgm_idx
  on public.survey_responses using gin (full_name gin_trgm_ops);
create index if not exists survey_responses_email_trgm_idx
  on public.survey_responses using gin (email gin_trgm_ops);

-- =============================================================================
-- 6. answers — canonical answer values
-- =============================================================================

create table if not exists public.answers (
  id          uuid primary key default gen_random_uuid(),
  -- cascade: deleting a response removes its answers, so nothing is orphaned
  response_id uuid not null references public.survey_responses (id) on delete cascade,
  -- restrict: a question that has answers cannot be deleted
  question_id uuid not null references public.questions (id) on delete restrict,
  -- denormalised original Google entry id, for traceable exports
  entry_id    bigint not null,
  -- EXACT answer string. For choice questions this is the original option string.
  answer_text text not null,
  created_at  timestamptz not null default now(),

  constraint answers_one_per_question unique (response_id, question_id),
  constraint answers_text_not_blank check (length(btrim(answer_text)) > 0)
);

comment on table public.answers is
  'Canonical answer store. Choice answers hold the exact original option string — numeric conversion happens only in analytics, at read time.';

create index if not exists answers_response_idx on public.answers (response_id);
create index if not exists answers_question_idx on public.answers (question_id);
create index if not exists answers_entry_idx on public.answers (entry_id);
-- supports "average by question" analytics scans
create index if not exists answers_question_text_idx on public.answers (question_id, answer_text);

-- Guarantee the denormalised entry_id always matches the referenced question.
create or replace function public.answers_sync_entry_id()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  q_entry bigint;
begin
  select entry_id into q_entry from public.questions where id = new.question_id;
  if q_entry is null then
    raise exception 'answers.question_id % does not exist', new.question_id;
  end if;
  new.entry_id := q_entry;
  return new;
end;
$$;

drop trigger if exists answers_sync_entry_id_trg on public.answers;
create trigger answers_sync_entry_id_trg
  before insert or update of question_id on public.answers
  for each row execute function public.answers_sync_entry_id();

-- Reject an answer whose value is not one of its question's original options.
-- Database-level backstop behind the app's server-side validation.
create or replace function public.answers_validate_option()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  q record;
begin
  select type, options, title into q
  from public.questions
  where id = new.question_id;

  if q.options is not null
     and not exists (
       select 1
       from jsonb_array_elements_text(q.options) as o(value)
       where o.value = new.answer_text
     ) then
    raise exception
      'Answer % is not one of the allowed options for question "%"',
      left(new.answer_text, 80), left(q.title, 60)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists answers_validate_option_trg on public.answers;
create trigger answers_validate_option_trg
  before insert or update of answer_text, question_id on public.answers
  for each row execute function public.answers_validate_option();

-- =============================================================================
-- 7. admin_profiles — who may read identifiable responses
-- =============================================================================

create table if not exists public.admin_profiles (
  -- 1:1 with a Supabase Auth user. There is no public sign-up path.
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       public.admin_role not null default 'viewer',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint admin_profiles_email_unique unique (email)
);

comment on table public.admin_profiles is
  'Administrator allow-list. A Supabase Auth user WITHOUT an active row here has no access to response data. Rows are created only by an existing owner/admin or by the service role.';

create index if not exists admin_profiles_active_idx
  on public.admin_profiles (is_active) where is_active;

drop trigger if exists admin_profiles_set_updated_at on public.admin_profiles;
create trigger admin_profiles_set_updated_at
  before update on public.admin_profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Survey immutability
-- =============================================================================
-- Once a survey has responses (or is explicitly locked), its content cannot be
-- changed. Future surveys must be created as new `surveys` rows.

create or replace function public.survey_has_responses(p_survey_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.survey_responses r where r.survey_id = p_survey_id
  );
$$;

-- A trigger function can only reference fields that exist on the row it is
-- handed. `surveys` has `id`; `survey_sections` and `questions` have
-- `survey_id`. PL/pgSQL resolves every field reference against the actual
-- record type, so one shared function referencing both would fail with
-- "record new has no field survey_id". Hence two functions.

-- Drop the previous single-function form and its triggers, if present.
drop trigger if exists surveys_guard_immutable on public.surveys;
drop trigger if exists survey_sections_guard_immutable on public.survey_sections;
drop trigger if exists questions_guard_immutable on public.questions;
drop function if exists public.guard_survey_content_immutable();

-- ---- surveys: block content edits, allow status / lock / timestamp changes ----

create or replace function public.guard_survey_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.title, new.description, new.confirmation_message, new.slug,
      new.collects_email, new.email_required)
     is distinct from
     (old.title, old.description, old.confirmation_message, old.slug,
      old.collects_email, old.email_required)
  then
    if public.survey_has_responses(old.id) or coalesce(old.is_locked, false) then
      raise exception
        'Survey % already has responses (or is locked): its content is immutable. Create a new survey instead.',
        old.id
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- ---- sections and questions: no content changes once answered or locked ----

create or replace function public.guard_survey_child_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_survey uuid;
  locked        boolean;
begin
  -- OLD is unassigned on INSERT and NEW is unassigned on DELETE.
  if tg_op = 'DELETE' then
    target_survey := old.survey_id;
  else
    target_survey := new.survey_id;
  end if;

  if target_survey is null then
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  select s.is_locked into locked from public.surveys s where s.id = target_survey;

  if public.survey_has_responses(target_survey) or coalesce(locked, false) then
    raise exception
      'Survey % already has responses (or is locked): sections and questions are immutable. Create a new survey instead.',
      target_survey
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

create trigger surveys_guard_immutable
  before update on public.surveys
  for each row execute function public.guard_survey_immutable();

create trigger survey_sections_guard_immutable
  before insert or update or delete on public.survey_sections
  for each row execute function public.guard_survey_child_immutable();

create trigger questions_guard_immutable
  before insert or update or delete on public.questions
  for each row execute function public.guard_survey_child_immutable();

-- Responses are append-only: block edits to submitted answers.
create or replace function public.guard_answers_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Submitted answers are append-only and cannot be modified.'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists answers_append_only on public.answers;
create trigger answers_append_only
  before update on public.answers
  for each row execute function public.guard_answers_append_only();

-- END 20260101000100_schema.sql


-- ===========================================================================
-- BEGIN 20260101000200_rls.sql
-- ===========================================================================

-- =============================================================================
-- PLP Survey Platform — Row Level Security
-- Migration 0002
-- =============================================================================
--
-- Access model
-- ------------
--  anon / authenticated (participants, browser):
--      * MAY read public survey content (active surveys, their sections,
--        questions and the school list) so the form can render.
--      * MAY NOT read, insert, update or delete ANY response or answer row.
--        Submissions are written by the server-side API route using the
--        service-role key, which bypasses RLS. The service-role key is never
--        shipped to the browser.
--
--  active administrators (a Supabase Auth user WITH an active admin_profiles row):
--      * MAY read every survey, response and answer.
--      * owner/admin roles may manage survey content and the admin allow-list.
--      * 'viewer' is read-only.
--
--  A signed-in Auth user with NO active admin_profiles row has exactly the same
--  access as an anonymous visitor. There is no public administrator registration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper predicates
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER so a policy can consult admin_profiles without the caller
-- needing read access to it (which would otherwise cause policy recursion).

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles p
    where p.id = auth.uid()
      and p.is_active
  );
$$;

create or replace function public.has_admin_role(allowed public.admin_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles p
    where p.id = auth.uid()
      and p.is_active
      and p.role = any (allowed)
  );
$$;

create or replace function public.can_manage_surveys()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_admin_role(array['owner', 'admin']::public.admin_role[]);
$$;

revoke all on function public.is_active_admin() from public;
revoke all on function public.has_admin_role(public.admin_role[]) from public;
revoke all on function public.can_manage_surveys() from public;
grant execute on function public.is_active_admin() to anon, authenticated;
grant execute on function public.has_admin_role(public.admin_role[]) to authenticated;
grant execute on function public.can_manage_surveys() to authenticated;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere (deny-by-default)
-- -----------------------------------------------------------------------------

alter table public.schools          enable row level security;
alter table public.surveys          enable row level security;
alter table public.survey_sections  enable row level security;
alter table public.questions        enable row level security;
alter table public.survey_responses enable row level security;
alter table public.answers          enable row level security;
alter table public.admin_profiles   enable row level security;

-- Defence in depth: strip table privileges the app never needs, so a missing
-- or mis-written policy cannot by itself expose or accept response data.
revoke insert, update, delete on public.survey_responses from anon, authenticated;
revoke insert, update, delete on public.answers          from anon, authenticated;
revoke select                 on public.survey_responses from anon;
revoke select                 on public.answers          from anon;
revoke all                    on public.admin_profiles   from anon;

-- =============================================================================
-- schools — public read, admin write
-- =============================================================================

drop policy if exists schools_public_read on public.schools;
create policy schools_public_read
  on public.schools for select
  to anon, authenticated
  using (is_active);

drop policy if exists schools_admin_read_all on public.schools;
create policy schools_admin_read_all
  on public.schools for select
  to authenticated
  using (public.is_active_admin());

drop policy if exists schools_admin_write on public.schools;
create policy schools_admin_write
  on public.schools for all
  to authenticated
  using (public.can_manage_surveys())
  with check (public.can_manage_surveys());

-- =============================================================================
-- surveys — participants see ACTIVE surveys only; admins see all
-- =============================================================================

drop policy if exists surveys_public_read_active on public.surveys;
create policy surveys_public_read_active
  on public.surveys for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists surveys_admin_read_all on public.surveys;
create policy surveys_admin_read_all
  on public.surveys for select
  to authenticated
  using (public.is_active_admin());

drop policy if exists surveys_admin_write on public.surveys;
create policy surveys_admin_write
  on public.surveys for all
  to authenticated
  using (public.can_manage_surveys())
  with check (public.can_manage_surveys());

-- =============================================================================
-- survey_sections — readable when the parent survey is readable
-- =============================================================================

drop policy if exists survey_sections_public_read on public.survey_sections;
create policy survey_sections_public_read
  on public.survey_sections for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.surveys s
      where s.id = survey_sections.survey_id
        and s.status = 'active'
    )
  );

drop policy if exists survey_sections_admin_read_all on public.survey_sections;
create policy survey_sections_admin_read_all
  on public.survey_sections for select
  to authenticated
  using (public.is_active_admin());

drop policy if exists survey_sections_admin_write on public.survey_sections;
create policy survey_sections_admin_write
  on public.survey_sections for all
  to authenticated
  using (public.can_manage_surveys())
  with check (public.can_manage_surveys());

-- =============================================================================
-- questions — readable when the parent survey is readable
-- =============================================================================

drop policy if exists questions_public_read on public.questions;
create policy questions_public_read
  on public.questions for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.surveys s
      where s.id = questions.survey_id
        and s.status = 'active'
    )
  );

drop policy if exists questions_admin_read_all on public.questions;
create policy questions_admin_read_all
  on public.questions for select
  to authenticated
  using (public.is_active_admin());

drop policy if exists questions_admin_write on public.questions;
create policy questions_admin_write
  on public.questions for all
  to authenticated
  using (public.can_manage_surveys())
  with check (public.can_manage_surveys());

-- =============================================================================
-- survey_responses — identifiable data. Admin read only; no public access.
-- =============================================================================
-- NOTE: there is deliberately NO insert policy. Participants cannot write
-- directly; the server-side route inserts with the service-role key.

drop policy if exists survey_responses_admin_read on public.survey_responses;
create policy survey_responses_admin_read
  on public.survey_responses for select
  to authenticated
  using (public.is_active_admin());

drop policy if exists survey_responses_admin_delete on public.survey_responses;
create policy survey_responses_admin_delete
  on public.survey_responses for delete
  to authenticated
  using (public.can_manage_surveys());

-- =============================================================================
-- answers — admin read only; append-only via the server route
-- =============================================================================

drop policy if exists answers_admin_read on public.answers;
create policy answers_admin_read
  on public.answers for select
  to authenticated
  using (public.is_active_admin());

-- =============================================================================
-- admin_profiles — no public registration
-- =============================================================================

drop policy if exists admin_profiles_read_self on public.admin_profiles;
create policy admin_profiles_read_self
  on public.admin_profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists admin_profiles_read_all_for_admins on public.admin_profiles;
create policy admin_profiles_read_all_for_admins
  on public.admin_profiles for select
  to authenticated
  using (public.is_active_admin());

-- Only an 'owner' may change the administrator allow-list. The service role
-- bypasses RLS, which is how the first owner is bootstrapped (see 0005).
drop policy if exists admin_profiles_owner_manage on public.admin_profiles;
create policy admin_profiles_owner_manage
  on public.admin_profiles for all
  to authenticated
  using (public.has_admin_role(array['owner']::public.admin_role[]))
  with check (public.has_admin_role(array['owner']::public.admin_role[]));

-- =============================================================================
-- Admin reporting view
-- =============================================================================
-- security_invoker = true makes the view respect the querying user's RLS
-- instead of the view owner's. Without it, this view would leak responses.

create or replace view public.admin_response_overview
with (security_invoker = true) as
select
  r.id,
  r.survey_id,
  s.slug          as survey_slug,
  s.title         as survey_title,
  r.email,
  r.full_name,
  r.school_name,
  r.year_level,
  r.submitted_at,
  r.duration_seconds,
  (select count(*) from public.answers a where a.response_id = r.id) as answer_count
from public.survey_responses r
join public.surveys s on s.id = r.survey_id;

comment on view public.admin_response_overview is
  'Flattened response list for the admin dashboard. security_invoker=true so RLS still applies.';

revoke all on public.admin_response_overview from anon;
grant select on public.admin_response_overview to authenticated;

-- END 20260101000200_rls.sql


-- ===========================================================================
-- BEGIN 20260101000300_seed_schools.sql
-- ===========================================================================

-- =============================================================================
-- PLP Survey Platform — school seed data
-- Migration 20260101000300  (GENERATED — do not edit by hand)
--
-- Generated from data/survey-source.json by: npm run generate:migrations
-- Source form: https://docs.google.com/forms/d/e/1FAIpQLSdOB12gVLmmamsogept8XAnw0sM5vCiJzghxnAHJSx8UamcOg/viewform
--
-- 180 schools, reproduced VERBATIM from the original Google Form
-- dropdown. Original casing, accents, punctuation and spelling are preserved
-- exactly as they appear in the source form — including inconsistent casing and
-- apparent typos, which are authoritative values and must not be "corrected".
-- display_order preserves the original dropdown ordering.
-- =============================================================================

insert into public.schools (name, display_order) values
  ('ACEJ Karama', 0),
  ('Acodes Mushishiro', 1),
  ('Agahozo Shalom Youth Village', 2),
  ('Akagera International School', 3),
  ('Apaer Institute', 4),
  ('APEFOC Gisenyi', 5),
  ('Apeki Tumba', 6),
  ('Apeki Tumba TSS', 7),
  ('Bigogwe TSS', 8),
  ('Blue lakes International School', 9),
  ('Centre de jeunes Muert', 10),
  ('Church Of God High School (St Patrick)', 11),
  ('College Adec Ruhanga', 12),
  ('College Apapec Remera Rukoma', 13),
  ('College APPEKA Kabarondo TSS', 14),
  ('College Baptist St Sylvestre de Kinigi', 15),
  ('COLLEGE DE GISENYI INYEMERAMIHIGO', 16),
  ('Collège de l''Immaculée Conception', 17),
  ('COLLEGE DE LA PAIX', 18),
  ('Collège de Rwankeri', 19),
  ('College du Christ Roi de Nyanza', 20),
  ('College Saint Andre', 21),
  ('Collège Saint Ignace Mugina', 22),
  ('College Sainte Marie Reine Kabgayi', 23),
  ('College St Ignace Kamonyi', 24),
  ('E.S Kabare / GS Kabare', 25),
  ('E.S Kabarondo', 26),
  ('E.S NYANGE', 27),
  ('E.S st Alphonse Marie de liguori Mubuga', 28),
  ('EAV Kivumu', 29),
  ('Ecole de Lettres Gatovu', 30),
  ('Ecole de science de Kidaho', 31),
  ('Ecole de Science de Musanze', 32),
  ('Ecole des science de Gisenyi (ESG)', 33),
  ('Ecole des sciences Byimana', 34),
  ('Ecole Secondaire Sancta Maria Karambo', 35),
  ('Ecole secondaire elena guerra', 36),
  ('Ecole secondaire Gafunzo', 37),
  ('Ecole Secondaire Islamique de Ruhengeri', 38),
  ('Ecole Secondaire Marie Adelaide', 39),
  ('Ecole Secondaire Nyarugunga', 40),
  ('Ecole Secondaire St Joseph Le travailleur', 41),
  ('Ecole Secondaire St Vincent', 42),
  ('Ecole Secondaire Stella Matutina', 43),
  ('Ecole Secondary de Mushubi', 44),
  ('Ecole Secondary RUKOMA SOPEM', 45),
  ('Ecole Technique St Kizito', 46),
  ('Ecole Tecnique de Kabgayi', 47),
  ('EFOTEC', 48),
  ('ENDP karubanda', 49),
  ('ES BISESERO', 50),
  ('ES GISHOMA', 51),
  ('ES Kayonza Modern', 52),
  ('Es Kigoma', 53),
  ('ES KIRINDA', 54),
  ('ES Marie Reine de la Paix', 55),
  ('ES MUBUGA', 56),
  ('ES MUHORORO', 57),
  ('ES MUNZANGA SCHOOL', 58),
  ('ES MURUNDA', 59),
  ('ES RUGABANO', 60),
  ('ES RUGANDA', 61),
  ('ES Shangi', 62),
  ('ES St Jean Bosco de Simbi', 63),
  ('ESA Gisenyi', 64),
  ('Eteka Muhanga', 65),
  ('Eto Nyamata', 66),
  ('EXCELLA', 67),
  ('Fawe gahini', 68),
  ('Fawe Gisozi', 69),
  ('Forever TVET', 70),
  ('G.S APAPEC Murambi', 71),
  ('G.S APE Rugunga', 72),
  ('G.S APRED Ndera', 73),
  ('G.S BIHE / TSS', 74),
  ('G.S BURINGO', 75),
  ('G.S MUKONDO', 76),
  ('G.S MWEGERA', 77),
  ('G.S NDA NYUNDO', 78),
  ('G.S RAMBURA (F)', 79),
  ('G.S RAMBURA (G)', 80),
  ('G.S RYABIZIGE TSS', 81),
  ('G.S SANZARE SAINT ALOYS', 82),
  ('G.S St Philippe Neri Gisagara', 83),
  ('G.S ST.RAPHAEL RAMBURA', 84),
  ('Gahogo Adventist Academy', 85),
  ('Gashora Girls Academy', 86),
  ('Gatsibo Tss', 87),
  ('GIKONKO TSS', 88),
  ('Glory academy', 89),
  ('Green Hills Academy', 90),
  ('Group scolaire Rilima', 91),
  ('Groupe officielle de Butare', 92),
  ('Groupe Scolaire Mater Dei', 93),
  ('Groupe Scolaire Mère Du Verbe kibeho', 94),
  ('Groupe Scolaire Saint Joseph Kabgayi', 95),
  ('Groupe Scolaire Sainte Bernadette Save', 96),
  ('GS BISUSA', 97),
  ('GS BUNGWE', 98),
  ('GS BUSIGARI', 99),
  ('GS BWEYEYE', 100),
  ('GS DIHIRO', 101),
  ('GS GAHENGERI', 102),
  ('GS GASUMO', 103),
  ('GS GIHUNDWE', 104),
  ('GS Gisozi', 105),
  ('GS HANIKA', 106),
  ('GS KABAYA', 107),
  ('GS KAGOMBYI', 108),
  ('GS KAMEMBE PRESBYTERIEN', 109),
  ('Gs marie merci', 110),
  ('GS MURIRA', 111),
  ('GS Muzizi', 112),
  ('GS Notre Dame du Bon Conseil Byumba', 113),
  ('GS NYABIKERI', 114),
  ('GS SAINT JOSEPH BIRAMBO', 115),
  ('GS SAINT MATHIEU DE BUSASAMANA', 116),
  ('GS SAINT PIERRE NKOMBO', 117),
  ('GSCIM RWANKUBA', 118),
  ('GSNDL Byimana', 119),
  ('Hope Haven Secondary school', 120),
  ('IFAK Don Bosco', 121),
  ('Igihozo Saint Peter Secondary School', 122),
  ('Inyange Girls School', 123),
  ('IPRC Kigali Tss', 124),
  ('Kabutare technical secondary school', 125),
  ('Kagarama secondary school', 126),
  ('Karenge Adventist Secondary School', 127),
  ('Kibeho TSS', 128),
  ('Kigali Excellent in Tourism and Hospitality Academy (KETHA)', 129),
  ('King David Academy', 130),
  ('Kivumu Tss', 131),
  ('Kiziguro Secondary School', 132),
  ('Lycee de Kicukiro Apade', 133),
  ('Lycee de Kigali', 134),
  ('Lycee de Nyanza', 135),
  ('Lycée du Lac de Muhazi (ASPEJ)', 136),
  ('Lycee Notre Dame de Citeaux', 137),
  ('Lycee Notre Dame de la visitation rulindo', 138),
  ('Maranyundo Girls School', 139),
  ('Maryhill Girls Secondary School', 140),
  ('Monseigneur Mubiligi Catholic TSS', 141),
  ('Mother Mary School Complex', 142),
  ('MTC Muhanga', 143),
  ('Muhabura Integrated Polytechnic College', 144),
  ('Muhanga Tss', 145),
  ('NEGA gashora', 146),
  ('Nelson Mandela TVET School', 147),
  ('New Life Christian Academy', 148),
  ('Ngoma Adventist College of Health Sciences', 149),
  ('Nyagatare secondary school', 150),
  ('Nyamata Highschool', 151),
  ('Nyamugali Secondary School', 152),
  ('Nyange Secondary School', 153),
  ('Nyanza Tss', 154),
  ('Nyundo School of Arts', 155),
  ('Nyundo School of Music', 156),
  ('PETIT SEMINAIRE SAINT PIE X DE NYUNDO', 157),
  ('Pt Seminaire St Leo Kabgayi', 158),
  ('Riviera High School', 159),
  ('Runda TSS', 160),
  ('Rwabuye TSS', 161),
  ('Rwanda Coding Academy', 162),
  ('Saint Bernadette Kamonyi', 163),
  ('Saint Bernard Kansi', 164),
  ('Saint Ignace TSS', 165),
  ('Saint Ignatius High School Kibagabaga', 166),
  ('Saint Kiziti Rwamagana', 167),
  ('Saint Mary High School', 168),
  ('saint Mary''s high school kiruhura', 169),
  ('Saint Sylvan Muranga', 170),
  ('SOS THS', 171),
  ('St Aloys', 172),
  ('St Jean Murundi Secondary School', 173),
  ('St Jean Nyarusange', 174),
  ('St Peter School of Shyogwe', 175),
  ('TTC DE LA SALLE BYUMBA', 176),
  ('TTC Kabarore', 177),
  ('TTC Nyamata', 178),
  ('WORLD MISSION HIGH SCHOOL', 179)
on conflict (name) do nothing;

-- Sanity check: fail the migration loudly if the count drifts.
do $check$
declare
  n integer;
begin
  select count(*) into n from public.schools;
  if n <> 180 then
    raise exception
      'Expected 180 schools after seeding, found %. School list is incomplete.', n;
  end if;
end
$check$;

-- END 20260101000300_seed_schools.sql


-- ===========================================================================
-- BEGIN 20260101000400_seed_survey_baseline.sql
-- ===========================================================================

-- =============================================================================
-- PLP Survey Platform — baseline survey content
-- Migration 20260101000400  (GENERATED — do not edit by hand)
--
-- Generated from data/survey-source.json by: npm run generate:migrations
-- Source form: https://docs.google.com/forms/d/e/1FAIpQLSdOB12gVLmmamsogept8XAnw0sM5vCiJzghxnAHJSx8UamcOg/viewform
--
-- 5 sections, 28 questions (27 required,
-- 1 optional). Question wording, descriptions, answer options,
-- required flags, original Google entry ids and original ordering are all
-- reproduced verbatim from the source file.
--
-- Multiple-choice options are stored as the EXACT original strings
-- (e.g. '3 — Neutral / Sometimes'), never converted to numbers.
--
-- This block is idempotent: it only seeds content when the survey has no
-- questions yet, so it is safe to re-run after the survey has been locked.
-- =============================================================================

do $seed$
declare
  v_survey uuid;
begin
  insert into public.surveys
    (slug, title, description, confirmation_message, source_url,
     collects_email, email_required, status, version, published_at)
  values
    ('plp-survey-1-baseline-term-1',
     'PLP Survey 1 — Baseline (Beginning of Term 1)',
     'Peace and Love Proclaimers | PLP School Curriculum

This survey is filled in BEFORE the PLP program begins. It captures who you are right now — your confidence, your skills, your values. There are no right or wrong answers. Be completely honest. You will fill in a similar survey at the end of each term and at the end of the year so we can see how you have grown.

🔒 Your answers are anonymous beyond your name and school. They will only be used to improve the PLP program.',
     'Thank you! Your baseline survey has been submitted. Welcome to PLP. Lead with peace. Create with purpose. Thrive with opportunity.',
     'https://docs.google.com/forms/d/e/1FAIpQLSdOB12gVLmmamsogept8XAnw0sM5vCiJzghxnAHJSx8UamcOg/viewform',
     true,
     true,
     'active',
     1,
     now())
  on conflict (slug) do nothing;

  select id into v_survey from public.surveys where slug = 'plp-survey-1-baseline-term-1';

  if v_survey is null then
    raise exception 'Failed to create or locate survey plp-survey-1-baseline-term-1';
  end if;

  -- Only seed content once. Re-running is a no-op.
  if exists (select 1 from public.questions where survey_id = v_survey) then
    raise notice 'Survey % already has questions — skipping content seed.', 'plp-survey-1-baseline-term-1';
    return;
  end if;

  -- ------------------------------------------------------------------
  -- Sections (5)
  -- ------------------------------------------------------------------

  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title)
  values
    (v_survey, 1, 'SECTION A1 — Leadership Identity & Confidence', 'Answer honestly based on who you are RIGHT NOW, before the program begins.

1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always', 'A1', 'Leadership Identity & Confidence')
  on conflict (survey_id, order_index) do nothing;

  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title)
  values
    (v_survey, 2, 'SECTION A2 — Skills & Knowledge', '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always', 'A2', 'Skills & Knowledge')
  on conflict (survey_id, order_index) do nothing;

  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title)
  values
    (v_survey, 3, 'SECTION A3 — Peace Values & Civic Responsibility', '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always', 'A3', 'Peace Values & Civic Responsibility')
  on conflict (survey_id, order_index) do nothing;

  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title)
  values
    (v_survey, 4, 'SECTION B — Starting Confidence', 'These questions are about how confident you feel RIGHT NOW. Some of these skills may be covered later in the PLP curriculum. There are no right or wrong answers.

1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always', 'B', 'Starting Confidence')
  on conflict (survey_id, order_index) do nothing;

  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title)
  values
    (v_survey, 5, 'SECTION C — About You', 'A few open questions to help us understand your starting point. Take your time.', 'C', 'About You')
  on conflict (survey_id, order_index) do nothing;

  -- ------------------------------------------------------------------
  -- Questions (28) — original form order preserved via order_index
  -- ------------------------------------------------------------------

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     null,
     1363545445,
     0,
     'Full Name',
     null,
     'short_answer',
     null,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     null,
     392476008,
     1,
     'School Name',
     'Please select your school from the list.',
     'dropdown',
     '["ACEJ Karama","Acodes Mushishiro","Agahozo Shalom Youth Village","Akagera International School","Apaer Institute","APEFOC Gisenyi","Apeki Tumba","Apeki Tumba TSS","Bigogwe TSS","Blue lakes International School","Centre de jeunes Muert","Church Of God High School (St Patrick)","College Adec Ruhanga","College Apapec Remera Rukoma","College APPEKA Kabarondo TSS","College Baptist St Sylvestre de Kinigi","COLLEGE DE GISENYI INYEMERAMIHIGO","Collège de l''Immaculée Conception","COLLEGE DE LA PAIX","Collège de Rwankeri","College du Christ Roi de Nyanza","College Saint Andre","Collège Saint Ignace Mugina","College Sainte Marie Reine Kabgayi","College St Ignace Kamonyi","E.S Kabare / GS Kabare","E.S Kabarondo","E.S NYANGE","E.S st Alphonse Marie de liguori Mubuga","EAV Kivumu","Ecole de Lettres Gatovu","Ecole de science de Kidaho","Ecole de Science de Musanze","Ecole des science de Gisenyi (ESG)","Ecole des sciences Byimana","Ecole Secondaire Sancta Maria Karambo","Ecole secondaire elena guerra","Ecole secondaire Gafunzo","Ecole Secondaire Islamique de Ruhengeri","Ecole Secondaire Marie Adelaide","Ecole Secondaire Nyarugunga","Ecole Secondaire St Joseph Le travailleur","Ecole Secondaire St Vincent","Ecole Secondaire Stella Matutina","Ecole Secondary de Mushubi","Ecole Secondary RUKOMA SOPEM","Ecole Technique St Kizito","Ecole Tecnique de Kabgayi","EFOTEC","ENDP karubanda","ES BISESERO","ES GISHOMA","ES Kayonza Modern","Es Kigoma","ES KIRINDA","ES Marie Reine de la Paix","ES MUBUGA","ES MUHORORO","ES MUNZANGA SCHOOL","ES MURUNDA","ES RUGABANO","ES RUGANDA","ES Shangi","ES St Jean Bosco de Simbi","ESA Gisenyi","Eteka Muhanga","Eto Nyamata","EXCELLA","Fawe gahini","Fawe Gisozi","Forever TVET","G.S APAPEC Murambi","G.S APE Rugunga","G.S APRED Ndera","G.S BIHE / TSS","G.S BURINGO","G.S MUKONDO","G.S MWEGERA","G.S NDA NYUNDO","G.S RAMBURA (F)","G.S RAMBURA (G)","G.S RYABIZIGE TSS","G.S SANZARE SAINT ALOYS","G.S St Philippe Neri Gisagara","G.S ST.RAPHAEL RAMBURA","Gahogo Adventist Academy","Gashora Girls Academy","Gatsibo Tss","GIKONKO TSS","Glory academy","Green Hills Academy","Group scolaire Rilima","Groupe officielle de Butare","Groupe Scolaire Mater Dei","Groupe Scolaire Mère Du Verbe kibeho","Groupe Scolaire Saint Joseph Kabgayi","Groupe Scolaire Sainte Bernadette Save","GS BISUSA","GS BUNGWE","GS BUSIGARI","GS BWEYEYE","GS DIHIRO","GS GAHENGERI","GS GASUMO","GS GIHUNDWE","GS Gisozi","GS HANIKA","GS KABAYA","GS KAGOMBYI","GS KAMEMBE PRESBYTERIEN","Gs marie merci","GS MURIRA","GS Muzizi","GS Notre Dame du Bon Conseil Byumba","GS NYABIKERI","GS SAINT JOSEPH BIRAMBO","GS SAINT MATHIEU DE BUSASAMANA","GS SAINT PIERRE NKOMBO","GSCIM RWANKUBA","GSNDL Byimana","Hope Haven Secondary school","IFAK Don Bosco","Igihozo Saint Peter Secondary School","Inyange Girls School","IPRC Kigali Tss","Kabutare technical secondary school","Kagarama secondary school","Karenge Adventist Secondary School","Kibeho TSS","Kigali Excellent in Tourism and Hospitality Academy (KETHA)","King David Academy","Kivumu Tss","Kiziguro Secondary School","Lycee de Kicukiro Apade","Lycee de Kigali","Lycee de Nyanza","Lycée du Lac de Muhazi (ASPEJ)","Lycee Notre Dame de Citeaux","Lycee Notre Dame de la visitation rulindo","Maranyundo Girls School","Maryhill Girls Secondary School","Monseigneur Mubiligi Catholic TSS","Mother Mary School Complex","MTC Muhanga","Muhabura Integrated Polytechnic College","Muhanga Tss","NEGA gashora","Nelson Mandela TVET School","New Life Christian Academy","Ngoma Adventist College of Health Sciences","Nyagatare secondary school","Nyamata Highschool","Nyamugali Secondary School","Nyange Secondary School","Nyanza Tss","Nyundo School of Arts","Nyundo School of Music","PETIT SEMINAIRE SAINT PIE X DE NYUNDO","Pt Seminaire St Leo Kabgayi","Riviera High School","Runda TSS","Rwabuye TSS","Rwanda Coding Academy","Saint Bernadette Kamonyi","Saint Bernard Kansi","Saint Ignace TSS","Saint Ignatius High School Kibagabaga","Saint Kiziti Rwamagana","Saint Mary High School","saint Mary''s high school kiruhura","Saint Sylvan Muranga","SOS THS","St Aloys","St Jean Murundi Secondary School","St Jean Nyarusange","St Peter School of Shyogwe","TTC DE LA SALLE BYUMBA","TTC Kabarore","TTC Nyamata","WORLD MISSION HIGH SCHOOL"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     null,
     672559437,
     2,
     'Year Level',
     null,
     'multiple_choice',
     '["S1","S2","S3","S4","S5","S6"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 1),
     1250388049,
     4,
     'I see myself as a leader.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 1),
     622497614,
     5,
     'I believe my voice and opinions matter.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 1),
     1557927388,
     6,
     'I am confident speaking in front of a group.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 1),
     2045282778,
     7,
     'I set goals for myself and work toward them.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 1),
     1923734074,
     8,
     'I take initiative without waiting to be asked.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 1),
     862335306,
     9,
     'I can lead others even when it is difficult.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 2),
     2050294250,
     11,
     'I can communicate my ideas clearly to others.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 2),
     1754423846,
     12,
     'I know how to research a topic and evaluate whether information is reliable.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 2),
     1967499013,
     13,
     'I understand how to manage money and make a basic budget.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 2),
     946747526,
     14,
     'I can identify a problem in my community and think of solutions.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 2),
     848090481,
     15,
     'I know how to write a project proposal.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 3),
     21824051,
     17,
     'I believe peace in my community is something I can contribute to.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 3),
     1276040987,
     18,
     'I understand why Rwanda''s history matters to my generation.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 3),
     2042551412,
     19,
     'I treat people from different backgrounds with respect and empathy.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 3),
     1881648513,
     20,
     'I speak up when I see unfair or divisive behavior.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 3),
     978166343,
     21,
     'I feel responsible for the wellbeing of my community.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 4),
     610283415,
     23,
     'I feel confident finding reliable information when I need it.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 4),
     749611187,
     24,
     'I feel confident managing my money and making a basic budget.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 4),
     584554120,
     25,
     'I feel confident identifying a problem and thinking of a practical solution.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 4),
     325256702,
     26,
     'I feel confident developing an idea into a simple project proposal.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 4),
     324323319,
     27,
     'I feel confident handling disagreement or conflict in a constructive way.',
     '1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     '["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 5),
     2090256807,
     29,
     'In your own words, what does it mean to be a leader?',
     null,
     'paragraph',
     null,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 5),
     1283952506,
     30,
     'What is one thing you hope PLP gives you this year?',
     null,
     'paragraph',
     null,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 5),
     852041322,
     31,
     'What is your biggest personal goal for the next 12 months?',
     null,
     'paragraph',
     null,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 5),
     1661896947,
     32,
     'Is there anything you are worried or unsure about as you start this program? (Optional)',
     null,
     'paragraph',
     null,
     false)
  on conflict (survey_id, entry_id) do nothing;

  -- Freeze the baseline instrument. Future surveys are new rows.
  update public.surveys set is_locked = true where id = v_survey;
end
$seed$;

-- =============================================================================
-- Post-seed verification — the migration fails if content does not match source
-- =============================================================================

do $check$
declare
  v_survey    uuid;
  n_sections  integer;
  n_questions integer;
  n_required  integer;
begin
  select id into v_survey from public.surveys where slug = 'plp-survey-1-baseline-term-1';

  select count(*) into n_sections  from public.survey_sections where survey_id = v_survey;
  select count(*) into n_questions from public.questions       where survey_id = v_survey;
  select count(*) into n_required  from public.questions
    where survey_id = v_survey and is_required;

  if n_sections <> 5 then
    raise exception 'Expected 5 sections, found %', n_sections;
  end if;
  if n_questions <> 28 then
    raise exception 'Expected 28 questions, found %', n_questions;
  end if;
  if n_required <> 27 then
    raise exception 'Expected 27 required questions, found %', n_required;
  end if;

  raise notice 'Baseline survey verified: % sections, % questions (% required).',
    n_sections, n_questions, n_required;
end
$check$;

-- END 20260101000400_seed_survey_baseline.sql


-- ===========================================================================
-- BEGIN 20260101000500_admin_setup.sql
-- ===========================================================================

-- =============================================================================
-- PLP Survey Platform — administrator setup
-- Migration 0005
-- =============================================================================
--
-- There is NO public administrator registration. An administrator exists only
-- when BOTH of these are true:
--   1. a Supabase Auth user exists (created by invitation in the dashboard), and
--   2. that user has an ACTIVE row in public.admin_profiles.
--
-- Creating that row requires either the service role / SQL editor, or an
-- existing active 'owner'. A self-service path is intentionally absent.
--
-- ---------------------------------------------------------------------------
-- HOW TO CREATE THE FIRST ADMINISTRATOR
-- ---------------------------------------------------------------------------
--   1. Supabase Dashboard -> Authentication -> Users -> "Add user"
--      (or "Invite user" to have them set their own password).
--      Use a real address you control. Never share the password over chat.
--
--   2. Supabase Dashboard -> SQL Editor, run:
--
--        select public.grant_admin('you@example.org', 'owner');
--
--   3. Sign in at /admin/login with that email and password.
--
-- To add further administrators later, an existing owner can run the same
-- function with role 'admin' (full management) or 'viewer' (read-only).
-- To revoke access immediately:
--
--        select public.set_admin_active('them@example.org', false);
-- =============================================================================

-- True when the caller is the service role / SQL editor / an active owner.
create or replace function public.can_manage_admins()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  jwt_role text;
begin
  -- auth.role() is null outside a PostgREST request (e.g. the SQL editor),
  -- in which case fall back to the database role.
  begin
    jwt_role := auth.role();
  exception when others then
    jwt_role := null;
  end;

  if coalesce(jwt_role, current_user) in ('service_role', 'postgres', 'supabase_admin') then
    return true;
  end if;

  return public.has_admin_role(array['owner']::public.admin_role[]);
end;
$$;

-- -----------------------------------------------------------------------------
-- grant_admin(email, role) — add or re-activate an administrator
-- -----------------------------------------------------------------------------

create or replace function public.grant_admin(
  p_email text,
  p_role  public.admin_role default 'admin'
)
returns public.admin_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   auth.users;
  v_result public.admin_profiles;
begin
  if not public.can_manage_admins() then
    raise exception 'Not authorised to manage administrators.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_email is null or length(btrim(p_email)) = 0 then
    raise exception 'An email address is required.';
  end if;

  select * into v_user
  from auth.users
  where lower(email) = lower(btrim(p_email))
  limit 1;

  if v_user.id is null then
    raise exception
      'No Supabase Auth user exists for "%". Create or invite the user in '
      'Authentication -> Users first, then re-run this function.', p_email
      using errcode = 'no_data_found';
  end if;

  insert into public.admin_profiles (id, email, full_name, role, is_active)
  values (
    v_user.id,
    lower(btrim(p_email)),
    coalesce(v_user.raw_user_meta_data ->> 'full_name', split_part(p_email, '@', 1)),
    p_role,
    true
  )
  on conflict (id) do update
    set role      = excluded.role,
        is_active = true,
        email     = excluded.email,
        updated_at = now()
  returning * into v_result;

  raise notice 'Administrator % granted role %.', p_email, p_role;
  return v_result;
end;
$$;

comment on function public.grant_admin(text, public.admin_role) is
  'Adds or re-activates an administrator for an EXISTING Supabase Auth user. Callable by the service role / SQL editor, or by an active owner.';

-- -----------------------------------------------------------------------------
-- set_admin_active(email, active) — revoke or restore access
-- -----------------------------------------------------------------------------

create or replace function public.set_admin_active(
  p_email  text,
  p_active boolean
)
returns public.admin_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.admin_profiles;
  v_owners integer;
begin
  if not public.can_manage_admins() then
    raise exception 'Not authorised to manage administrators.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Never allow the last active owner to be locked out.
  if p_active = false then
    select count(*) into v_owners
    from public.admin_profiles
    where is_active and role = 'owner' and lower(email) <> lower(btrim(p_email));

    if v_owners = 0 and exists (
      select 1 from public.admin_profiles
      where lower(email) = lower(btrim(p_email)) and role = 'owner' and is_active
    ) then
      raise exception 'Refusing to deactivate the last active owner.';
    end if;
  end if;

  update public.admin_profiles
     set is_active = p_active,
         updated_at = now()
   where lower(email) = lower(btrim(p_email))
  returning * into v_result;

  if v_result.id is null then
    raise exception 'No administrator profile found for "%".', p_email
      using errcode = 'no_data_found';
  end if;

  return v_result;
end;
$$;

comment on function public.set_admin_active(text, boolean) is
  'Revokes (false) or restores (true) an administrator profile. Refuses to deactivate the last active owner.';

-- -----------------------------------------------------------------------------
-- Lock down execution
-- -----------------------------------------------------------------------------
-- anon can never call these. 'authenticated' may call them, but the internal
-- can_manage_admins() check means only an active owner succeeds.

revoke all on function public.can_manage_admins() from public;
revoke all on function public.grant_admin(text, public.admin_role) from public;
revoke all on function public.set_admin_active(text, boolean) from public;

grant execute on function public.can_manage_admins() to authenticated;
grant execute on function public.grant_admin(text, public.admin_role) to authenticated;
grant execute on function public.set_admin_active(text, boolean) to authenticated;

-- END 20260101000500_admin_setup.sql
