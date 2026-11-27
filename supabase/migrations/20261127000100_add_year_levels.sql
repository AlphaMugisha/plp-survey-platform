-- =============================================================================
-- PLP Survey Platform — add Year 1 and Year 2 to the year levels
-- Migration 0009
--
-- Year levels become: Grade 7, Grade 8, Grade 9, Grade 10, Year 1, Year 2
--
-- WHY THIS IS SEPARATE FROM 0008
-- ------------------------------
-- 0008 refuses to run once the survey has responses, because replacing an
-- option list can orphan answers already given. ADDING an option cannot:
-- every existing answer still matches an option that is still offered.
--
-- So this migration allows the change, but only after PROVING it is additive.
-- It aborts unless the new list contains every option currently stored, so a
-- rename or a removal can never slip through this path.
--
-- Idempotent and safe to re-run.
-- =============================================================================

do $years$
declare
  v_survey     uuid;
  v_locked     boolean;
  current_opts jsonb;
  target_opts  jsonb := E'["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Year 1", "Year 2"]'::jsonb;
  missing      text;
begin
  select id, is_locked into v_survey, v_locked
  from public.surveys where slug = 'plp-survey-1-baseline-term-1';

  if v_survey is null then
    raise exception 'Baseline survey not found — run the seed migrations first.';
  end if;

  select options into current_opts
  from public.questions
  where survey_id = v_survey and entry_id = 672559437;

  if current_opts is null then
    raise exception 'Year level question (entry 672559437) not found.';
  end if;

  -- Already applied?
  if current_opts = target_opts then
    raise notice 'Year levels already up to date (% options).',
      jsonb_array_length(current_opts);
    return;
  end if;

  -- ---- Prove the change is purely additive ----
  select string_agg(existing.value, ', ')
    into missing
  from jsonb_array_elements_text(current_opts) as existing(value)
  where not exists (
    select 1
    from jsonb_array_elements_text(target_opts) as wanted(value)
    where wanted.value = existing.value
  );

  if missing is not null then
    raise exception
      'Refusing to continue: this would remove or rename existing year level(s): %. Answers already given would no longer match an offered option.',
      missing
      using errcode = 'check_violation';
  end if;

  -- Safe: every current option survives, so no answer can be orphaned.
  update public.surveys set is_locked = false where id = v_survey;

  update public.questions
     set options = target_opts
   where survey_id = v_survey and entry_id = 672559437;

  update public.surveys set is_locked = coalesce(v_locked, true) where id = v_survey;

  raise notice 'Year levels updated from % to % options.',
    jsonb_array_length(current_opts), jsonb_array_length(target_opts);
end
$years$;

-- =============================================================================
-- Verification
-- =============================================================================

do $check$
declare
  v_survey uuid;
  opts     jsonb;
  orphans  integer;
begin
  select id into v_survey from public.surveys where slug = 'plp-survey-1-baseline-term-1';

  select options into opts
  from public.questions where survey_id = v_survey and entry_id = 672559437;

  if jsonb_array_length(opts) <> 6 then
    raise exception 'Expected 6 year levels, found %.', jsonb_array_length(opts);
  end if;

  -- No stored answer may point at an option that is no longer offered.
  select count(*) into orphans
  from public.answers a
  join public.questions q on q.id = a.question_id
  where q.survey_id = v_survey
    and q.entry_id = 672559437
    and not exists (
      select 1
      from jsonb_array_elements_text(q.options) as o(value)
      where o.value = a.answer_text
    );

  if orphans > 0 then
    raise exception '% existing answer(s) no longer match an offered year level.', orphans;
  end if;

  raise notice 'Verified: % year levels, no orphaned answers.', jsonb_array_length(opts);
end
$check$;
