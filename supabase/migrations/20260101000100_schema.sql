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
