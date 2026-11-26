-- =============================================================================
-- PLP Survey Platform — explicit table privileges
-- Migration 0006
-- =============================================================================
--
-- WHY THIS EXISTS
-- ---------------
-- Postgres access control here has TWO independent layers, and both must allow
-- an operation:
--
--   1. GRANT  — may this role touch this table at all?
--   2. RLS    — which ROWS of it may this role see or change?
--
-- Older Supabase projects shipped an ALTER DEFAULT PRIVILEGES rule that granted
-- anon / authenticated / service_role access to every new table in `public`
-- automatically, so migrations could rely on layer 1 being handled. Newer
-- projects do not. Without this file you get:
--
--   42501: permission denied for table surveys
--
-- even with a correct set of RLS policies, and even for the service role.
--
-- This migration states the intended end state explicitly, so the schema no
-- longer depends on a project-level default that may or may not be present.
-- It is idempotent and safe to re-run.
--
-- The access model is unchanged from 0002_rls.sql — this only makes layer 1
-- match the policies that layer 2 already expresses.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- service_role — the server-side identity used by /api/survey/submit.
-- Bypasses RLS by design; the key never reaches the browser.
-- -----------------------------------------------------------------------------

grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute        on all functions in schema public to service_role;

-- -----------------------------------------------------------------------------
-- Public survey content — anon must read this to render the form at all.
-- RLS still restricts rows to the ACTIVE survey.
-- -----------------------------------------------------------------------------

grant select on public.schools         to anon, authenticated;
grant select on public.surveys         to anon, authenticated;
grant select on public.survey_sections to anon, authenticated;
grant select on public.questions       to anon, authenticated;

-- Content management. RLS narrows these to owner/admin profiles.
grant insert, update, delete on public.schools         to authenticated;
grant insert, update, delete on public.surveys         to authenticated;
grant insert, update, delete on public.survey_sections to authenticated;
grant insert, update, delete on public.questions       to authenticated;

-- -----------------------------------------------------------------------------
-- Response data — readable only by signed-in users, and RLS narrows that
-- further to ACTIVE administrators. A signed-in non-admin sees nothing.
-- -----------------------------------------------------------------------------

grant select on public.survey_responses to authenticated;
grant delete on public.survey_responses to authenticated;  -- RLS: owner/admin only
grant select on public.answers          to authenticated;

grant select, insert, update, delete on public.admin_profiles to authenticated;
grant select on public.admin_response_overview to authenticated;

-- -----------------------------------------------------------------------------
-- Defence in depth — withdraw everything anon must never have, and the writes
-- that must only ever happen through the server-side route.
-- These REVOKEs run last so they win over the broad grants above.
-- -----------------------------------------------------------------------------

revoke all on public.survey_responses        from anon;
revoke all on public.answers                 from anon;
revoke all on public.admin_profiles          from anon;
revoke all on public.admin_response_overview from anon;

revoke insert, update         on public.survey_responses from authenticated;
revoke insert, update, delete on public.answers          from authenticated;

-- -----------------------------------------------------------------------------
-- Any table added later inherits the same baseline.
-- -----------------------------------------------------------------------------

alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;

-- =============================================================================
-- Post-grant verification — fails loudly if a required privilege is missing
-- =============================================================================

do $check$
declare
  missing text := '';
begin
  -- service_role must be able to read every table the API route touches.
  if not has_table_privilege('service_role', 'public.surveys', 'SELECT') then
    missing := missing || ' service_role:surveys';
  end if;
  if not has_table_privilege('service_role', 'public.survey_responses', 'INSERT') then
    missing := missing || ' service_role:survey_responses(insert)';
  end if;
  if not has_table_privilege('service_role', 'public.answers', 'INSERT') then
    missing := missing || ' service_role:answers(insert)';
  end if;

  -- anon must be able to read public survey content.
  if not has_table_privilege('anon', 'public.schools', 'SELECT') then
    missing := missing || ' anon:schools';
  end if;
  if not has_table_privilege('anon', 'public.questions', 'SELECT') then
    missing := missing || ' anon:questions';
  end if;

  -- anon must NOT be able to read response data.
  if has_table_privilege('anon', 'public.survey_responses', 'SELECT') then
    missing := missing || ' UNEXPECTED:anon-can-select-responses';
  end if;
  if has_table_privilege('anon', 'public.answers', 'SELECT') then
    missing := missing || ' UNEXPECTED:anon-can-select-answers';
  end if;

  if length(missing) > 0 then
    raise exception 'Privilege check failed:%', missing;
  end if;

  raise notice 'Privileges verified: service_role has full access, anon can read survey content only.';
end
$check$;
