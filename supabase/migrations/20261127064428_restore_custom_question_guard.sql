-- Restore the question-specific rules for admin-managed questions. The earlier
-- migration must not make existing PLP questions mutable or unprotect custom
-- questions that have already been answered.
alter table public.questions
  add column if not exists is_custom boolean not null default false;

comment on column public.questions.is_custom is
  'False for verified source questions; true for questions an administrator added.';

create or replace function public.guard_question_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_survey uuid;
  locked boolean;
  has_responses boolean;
  answer_count integer;
begin
  target_survey := case when tg_op = 'DELETE' then old.survey_id else new.survey_id end;

  if target_survey is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select s.is_locked into locked from public.surveys s where s.id = target_survey;
  has_responses := public.survey_has_responses(target_survey);

  if tg_op = 'DELETE' then
    if not coalesce(old.is_custom, false) then
      raise exception 'Question "%" came from the verified source form and cannot be deleted.', left(old.title, 60)
        using errcode = 'check_violation';
    end if;

    select count(*) into answer_count from public.answers a where a.question_id = old.id;
    if answer_count > 0 then
      raise exception 'Question "%" already has % answer(s) and cannot be deleted.', left(old.title, 60), answer_count
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.entry_id <> old.entry_id or new.survey_id <> old.survey_id then
      raise exception 'A question cannot be moved or re-identified.' using errcode = 'check_violation';
    end if;
    if coalesce(new.is_custom, false) <> coalesce(old.is_custom, false) then
      raise exception 'is_custom cannot be changed after a question is created.' using errcode = 'check_violation';
    end if;

    if coalesce(old.is_custom, false) then
      select count(*) into answer_count from public.answers a where a.question_id = old.id;
      if answer_count > 0 then
        raise exception 'Question "%" already has % answer(s) and can no longer be edited.', left(old.title, 60), answer_count
          using errcode = 'check_violation';
      end if;
      return new;
    end if;

    if has_responses or coalesce(locked, false) then
      raise exception 'Survey % is locked or already has responses: questions from the source form are immutable.', target_survey
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- Appending a question does not change the meaning of existing answers.
  return new;
end;
$$;

drop trigger if exists questions_guard_immutable on public.questions;
create trigger questions_guard_immutable
  before insert or update or delete on public.questions
  for each row execute function public.guard_question_changes();
