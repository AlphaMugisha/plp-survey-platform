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
