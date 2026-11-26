-- =============================================================================
-- PLP Survey Platform — normalise line endings in seeded content
-- Migration 0007
-- =============================================================================
--
-- WHY THIS EXISTS
-- ---------------
-- The original seed wrote multi-line text (the survey intro and two section
-- descriptions) as literal line breaks inside a single-quoted SQL string. On a
-- Windows checkout those breaks become CRLF, so the carriage returns were
-- stored in the database: the text read "...begins.\r\n\r\n1 = Strongly..."
-- where the original Google Form has "...begins.\n\n1 = Strongly...".
--
-- Two characters, invisible on screen — but the content must match the source
-- byte for byte, and `npm run verify:db` correctly flagged it.
--
-- The generator now emits E'' escape strings with \n, so newly generated SQL
-- cannot be affected. This migration repairs rows seeded before that change.
--
-- Idempotent: replacing CRLF with LF on text that already uses LF is a no-op.
-- =============================================================================

do $fix$
declare
  v_survey   uuid;
  v_locked   boolean;
  v_responses integer;
  v_fixed    integer := 0;
  n          integer;
begin
  select id, is_locked into v_survey, v_locked
  from public.surveys
  where slug = 'plp-survey-1-baseline-term-1';

  if v_survey is null then
    raise notice 'Baseline survey not found — nothing to normalise.';
    return;
  end if;

  select count(*) into v_responses
  from public.survey_responses
  where survey_id = v_survey;

  if v_responses > 0 then
    -- Content is immutable once answered. Any deployment seeded after the
    -- generator fix is already correct, so this is informational, not an error.
    raise notice
      'Survey already has % response(s); content is immutable and will not be modified.',
      v_responses;
    return;
  end if;

  -- Unlock so the content triggers allow the repair. is_locked is not a content
  -- column, so toggling it is permitted even while locked.
  update public.surveys set is_locked = false where id = v_survey;

  -- ---- survey intro and confirmation message ----
  update public.surveys
     set description          = replace(description, chr(13) || chr(10), chr(10)),
         confirmation_message = replace(confirmation_message, chr(13) || chr(10), chr(10))
   where id = v_survey
     and (description like '%' || chr(13) || '%'
       or confirmation_message like '%' || chr(13) || '%');
  get diagnostics n = row_count;
  v_fixed := v_fixed + n;

  -- ---- section titles and descriptions ----
  update public.survey_sections
     set title       = replace(title, chr(13) || chr(10), chr(10)),
         description = replace(description, chr(13) || chr(10), chr(10))
   where survey_id = v_survey
     and (title like '%' || chr(13) || '%'
       or description like '%' || chr(13) || '%');
  get diagnostics n = row_count;
  v_fixed := v_fixed + n;

  -- ---- question wording and help text ----
  update public.questions
     set title       = replace(title, chr(13) || chr(10), chr(10)),
         description = replace(description, chr(13) || chr(10), chr(10))
   where survey_id = v_survey
     and (title like '%' || chr(13) || '%'
       or description like '%' || chr(13) || '%');
  get diagnostics n = row_count;
  v_fixed := v_fixed + n;

  -- ---- school names (defensive; these are single-line) ----
  update public.schools
     set name = replace(name, chr(13) || chr(10), chr(10))
   where name like '%' || chr(13) || '%';
  get diagnostics n = row_count;
  v_fixed := v_fixed + n;

  -- Restore the previous lock state.
  update public.surveys set is_locked = coalesce(v_locked, true) where id = v_survey;

  raise notice 'Line-ending normalisation complete: % row(s) updated.', v_fixed;
end
$fix$;

-- =============================================================================
-- Verification — no carriage returns may remain in seeded content
-- =============================================================================

do $check$
declare
  offenders integer;
begin
  select
    (select count(*) from public.surveys
      where description like '%' || chr(13) || '%'
         or confirmation_message like '%' || chr(13) || '%')
  + (select count(*) from public.survey_sections
      where title like '%' || chr(13) || '%'
         or description like '%' || chr(13) || '%')
  + (select count(*) from public.questions
      where title like '%' || chr(13) || '%'
         or description like '%' || chr(13) || '%')
  + (select count(*) from public.schools
      where name like '%' || chr(13) || '%')
  into offenders;

  if offenders > 0 then
    raise exception
      '% row(s) still contain a carriage return in seeded content.', offenders;
  end if;

  raise notice 'Verified: no carriage returns remain in any seeded content.';
end
$check$;
