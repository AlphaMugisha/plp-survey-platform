-- Clear the baseline question set. Keep the survey's dedicated email and
-- country fields; admins can add a new question set from the dashboard.
do $$
declare
  baseline_id uuid;
begin
  select id into baseline_id
  from public.surveys
  where slug = 'plp-survey-1-baseline-term-1';

  if baseline_id is null then
    raise exception 'Baseline survey not found; no questions were removed.';
  end if;

  if public.survey_has_responses(baseline_id) then
    raise exception 'Baseline survey has responses; refusing to delete its questions.';
  end if;
end;
$$;

drop trigger if exists questions_guard_immutable on public.questions;

delete from public.questions q
using public.surveys s
where q.survey_id = s.id
  and s.slug = 'plp-survey-1-baseline-term-1';

create trigger questions_guard_immutable
  before insert or update or delete on public.questions
  for each row execute function public.guard_question_changes();
