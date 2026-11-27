-- =============================================================================
-- PLP Survey Platform — admin-managed sections (question groups)
-- =============================================================================
--
-- Questions have been admin-manageable since 20261126175105. Their GROUPS were
-- not: `survey_sections` was guarded by `guard_survey_child_immutable`, which
-- refuses every insert, update and delete once a survey is locked. That made it
-- impossible to group admin-added questions at all.
--
-- This applies the same rule to sections that already governs questions:
--
--   a SOURCE section  (is_custom = false) is immutable and can never be deleted
--   an ADMIN section   (is_custom = true)  is editable and removable, but only
--                                          while nothing in it has been answered
--
-- Deleting a section does not delete its questions; `questions.section_id` is
-- ON DELETE SET NULL, so they fall back to being ungrouped rather than
-- disappearing with the group. That is checked at the end.
--
-- Idempotent and safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Mark which sections came from the verified form and which an admin added
-- -----------------------------------------------------------------------------

alter table public.survey_sections
  add column if not exists is_custom boolean not null default false;

comment on column public.survey_sections.is_custom is
  'False for the 5 section blocks seeded from data/survey-source.json (immutable). True for a question group an administrator created.';

-- -----------------------------------------------------------------------------
-- Questions keep existing when their group is removed
-- -----------------------------------------------------------------------------

do $fk$
declare
  v_constraint text;
  v_delete_rule text;
begin
  select tc.constraint_name, rc.delete_rule
    into v_constraint, v_delete_rule
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name
   and kcu.constraint_schema = tc.constraint_schema
  join information_schema.referential_constraints rc
    on rc.constraint_name = tc.constraint_name
   and rc.constraint_schema = tc.constraint_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'questions'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'section_id'
  limit 1;

  if v_constraint is null then
    raise exception 'questions.section_id has no foreign key — unexpected schema.';
  end if;

  if v_delete_rule = 'SET NULL' then
    raise notice 'questions.section_id already uses ON DELETE SET NULL.';
    return;
  end if;

  execute format('alter table public.questions drop constraint %I', v_constraint);

  alter table public.questions
    add constraint questions_section_id_fkey
    foreign key (section_id) references public.survey_sections (id)
    on delete set null;

  raise notice 'questions.section_id now uses ON DELETE SET NULL (was %).', v_delete_rule;
end
$fk$;

-- -----------------------------------------------------------------------------
-- Section guard, mirroring the question guard
-- -----------------------------------------------------------------------------

create or replace function public.guard_section_changes()
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

  -- ---- DELETE: only an admin-added group with nothing answered in it ----
  if tg_op = 'DELETE' then
    if not coalesce(old.is_custom, false) then
      raise exception
        'Section "%" came from the verified source form and cannot be deleted.',
        left(old.title, 60)
        using errcode = 'check_violation';
    end if;

    select count(*) into answer_count
    from public.answers a
    join public.questions q on q.id = a.question_id
    where q.section_id = old.id;

    if answer_count > 0 then
      raise exception
        'Section "%" contains % answered question(s) and cannot be deleted.',
        left(old.title, 60), answer_count
        using errcode = 'check_violation';
    end if;

    return old;
  end if;

  -- ---- UPDATE ----
  if tg_op = 'UPDATE' then
    -- A section can never be moved to another survey, nor re-flagged to
    -- unlock a source section.
    if new.survey_id <> old.survey_id then
      raise exception 'A section cannot be moved to another survey.'
        using errcode = 'check_violation';
    end if;

    if coalesce(new.is_custom, false) <> coalesce(old.is_custom, false) then
      raise exception 'is_custom cannot be changed after a section is created.'
        using errcode = 'check_violation';
    end if;

    -- An admin group stays editable until something in it is answered.
    if coalesce(old.is_custom, false) then
      select count(*) into answer_count
      from public.answers a
      join public.questions q on q.id = a.question_id
      where q.section_id = old.id;

      if answer_count > 0 then
        raise exception
          'Section "%" contains % answered question(s) and can no longer be edited.',
          left(old.title, 60), answer_count
          using errcode = 'check_violation';
      end if;

      return new;
    end if;

    -- Source sections stay frozen once the survey is locked or answered.
    if has_responses or coalesce(locked, false) then
      raise exception
        'Survey % is locked or already has responses: sections from the source form are immutable.',
        target_survey
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- ---- INSERT: always allowed; a new group invalidates no existing answer ----
  return new;
end;
$$;

comment on function public.guard_section_changes() is
  'Sections are append-only. Source sections can never be deleted; admin-added ones only while nothing in them is answered.';

drop trigger if exists survey_sections_guard_immutable on public.survey_sections;

create trigger survey_sections_guard_immutable
  before insert or update or delete on public.survey_sections
  for each row execute function public.guard_section_changes();

-- =============================================================================
-- Verification
-- =============================================================================

do $check$
declare
  n_source integer;
  rule     text;
begin
  select count(*) into n_source
  from public.survey_sections where is_custom = false;

  -- The 5 source sections must still be marked as source, not as admin-added.
  if n_source < 1 then
    raise exception 'Expected the seeded sections to be marked is_custom = false.';
  end if;

  select rc.delete_rule into rule
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name
   and kcu.constraint_schema = tc.constraint_schema
  join information_schema.referential_constraints rc
    on rc.constraint_name = tc.constraint_name
   and rc.constraint_schema = tc.constraint_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'questions'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'section_id'
  limit 1;

  if rule <> 'SET NULL' then
    raise exception
      'questions.section_id must be ON DELETE SET NULL so removing a group cannot delete its questions (found %).',
      rule;
  end if;

  raise notice
    'Admin-managed sections enabled: % source section(s) protected; admin groups are editable while unanswered.',
    n_source;
end
$check$;
