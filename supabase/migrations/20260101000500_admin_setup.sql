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
