-- =============================================================================
-- PLP Survey Platform — admin-managed questions
-- =============================================================================
--
-- Managers may APPEND their own questions to a live application, and REMOVE
-- ones they added. The 28 questions seeded from the verified Google Form stay
-- immutable, as does any question that already has answers.
--
-- The rules this installs, on public.questions:
--
--   INSERT  allowed. Adding a question cannot invalidate an existing answer.
--   UPDATE  blocked once the survey has responses or is locked — unchanged.
--   DELETE  allowed ONLY for an admin-added question that nobody has answered.
--           A seeded question can never be deleted, at any point.
--
-- Idempotent and safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Mark which questions came from the verified source and which an admin added
-- -----------------------------------------------------------------------------

alter table public.questions
  add column if not exists is_custom boolean not null default false;

comment on column public.questions.is_custom is
  'False for questions seeded from data/survey-source.json (immutable, never deletable). True for questions an administrator appended.';

-- Anything that exists already was seeded, so it is not custom.
update public.questions set is_custom = false where is_custom is null;

-- -----------------------------------------------------------------------------
-- Question-specific guard, replacing the generic child guard for this table
-- -----------------------------------------------------------------------------

create or replace function public.guard_question_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_survey uuid;
  locked        boolean;
  has_responses boolean;
  answer_count  integer;
begin
  target_survey := case when tg_op = 'DELETE' then old.survey_id else new.survey_id end;

  if target_survey is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select s.is_locked into locked from public.surveys s where s.id = target_survey;
  has_responses := public.survey_has_responses(target_survey);

  -- ---- DELETE: only an unanswered, admin-added question ----
  if tg_op = 'DELETE' then
    if not coalesce(old.is_custom, false) then
      raise exception
        'Question "%" came from the verified source form and cannot be deleted.',
        left(old.title, 60)
        using errcode = 'check_violation';
    end if;

    select count(*) into answer_count
    from public.answers a where a.question_id = old.id;

    if answer_count > 0 then
      raise exception
        'Question "%" already has % answer(s) and cannot be deleted.',
        left(old.title, 60), answer_count
        using errcode = 'check_violation';
    end if;

    return old;
  end if;

  -- ---- UPDATE: wording stays frozen once the survey is in use ----
  if tg_op = 'UPDATE' then
    if has_responses or coalesce(locked, false) then
      raise exception
        'Survey % is locked or already has responses: existing questions are immutable.',
        target_survey
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- ---- INSERT: always allowed; it cannot invalidate an existing answer ----
  return new;
end;
$$;

comment on function public.guard_question_changes() is
  'Questions are append-only. Seeded questions can never be deleted; admin-added ones only while unanswered.';

drop trigger if exists questions_guard_immutable on public.questions;

create trigger questions_guard_immutable
  before insert or update or delete on public.questions
  for each row execute function public.guard_question_changes();

-- =============================================================================
-- Verification
-- =============================================================================

do $check$
declare
  n_seeded integer;
begin
  select count(*) into n_seeded from public.questions where is_custom = false;

  if n_seeded < 1 then
    raise exception 'Expected seeded questions to be marked is_custom = false.';
  end if;

  raise notice
    'Admin-managed questions enabled: % seeded question(s) protected; admin additions are removable while unanswered.',
    n_seeded;
end
$check$;
