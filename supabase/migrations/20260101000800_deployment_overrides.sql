-- =============================================================================
-- PLP Survey Platform — deployment overrides
-- Migration 0008  (GENERATED from data/deployment.json — do not edit by hand)
--
-- New Generation Academy — club recruitment
--
-- This deployment is a recruitment drive at New Generation Academy, which is not yet one of the 180 schools on the official PLP form. Running the baseline survey with the school and year levels fixed to that school lets PLP gather accurate numbers before the school is added to the official form.
--
-- This does NOT change any question wording, help text, ordering, required flag
-- or entry id. Only the answer OPTIONS of two questions change, plus the school
-- list they draw from.
--
-- Refuses to run once the survey has responses: by then the instrument is in
-- use, and changing its options would invalidate answers already given.
-- =============================================================================

do $deploy$
declare
  v_survey    uuid;
  v_responses integer;
  v_locked    boolean;
begin
  select id, is_locked into v_survey, v_locked
  from public.surveys where slug = 'plp-survey-1-baseline-term-1';

  if v_survey is null then
    raise exception 'Baseline survey not found — run the seed migrations first.';
  end if;

  select count(*) into v_responses
  from public.survey_responses where survey_id = v_survey;

  if v_responses > 0 then
    raise exception
      'Survey already has % response(s). Options cannot be changed once answers exist; create a new survey instead.',
      v_responses;
  end if;

  -- Content triggers block edits while the survey is locked.
  update public.surveys set is_locked = false where id = v_survey;

  -- ---- School list ----
  -- Single-school recruitment drive. Everyone answering is at New Generation Academy, so the 180-school dropdown is replaced by that one value and filled in automatically.
  insert into public.schools (name, display_order) values
    (E'New Generation Academy', 1000)
  on conflict (name) do nothing;

  -- Retire the schools this deployment does not use, so the dropdown and the
  -- admin filters only show what is actually in play. Nothing is deleted — the
  -- rows stay for when the official 180-school list is restored.
  update public.schools set is_active = false where name <> all (array[E'New Generation Academy']);
  update public.schools set is_active = true  where name =  any (array[E'New Generation Academy']);

  -- ---- Year levels ----
  -- New Generation Academy uses Grade 7 to Grade 10, plus Year 1 and Year 2, rather than the S1-S6 levels on the official form.
  update public.questions
     set options = E'["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Year 1", "Year 2"]'::jsonb
   where survey_id = v_survey and entry_id = 672559437;

  -- ---- School question options ----
  update public.questions
     set options = E'["New Generation Academy"]'::jsonb
   where survey_id = v_survey and entry_id = 392476008;

  update public.surveys set is_locked = coalesce(v_locked, true) where id = v_survey;

  raise notice 'Deployment overrides applied.';
end
$deploy$;

-- =============================================================================
-- Verification — fails loudly if the overrides did not land
-- =============================================================================

do $check$
declare
  v_survey    uuid;
  n_active    integer;
  year_opts   jsonb;
  school_opts jsonb;
begin
  select id into v_survey from public.surveys where slug = 'plp-survey-1-baseline-term-1';

  select count(*) into n_active from public.schools where is_active;
  if n_active <> 1 then
    raise exception 'Expected 1 active school(s), found %.', n_active;
  end if;

  select options into year_opts
    from public.questions where survey_id = v_survey and entry_id = 672559437;
  if jsonb_array_length(year_opts) <> 6 then
    raise exception 'Year level options were not applied.';
  end if;

  select options into school_opts
    from public.questions where survey_id = v_survey and entry_id = 392476008;
  if jsonb_array_length(school_opts) <> 1 then
    raise exception 'School options were not applied.';
  end if;

  raise notice 'Verified: % active school(s), % year level(s).',
    n_active, jsonb_array_length(year_opts);
end
$check$;
