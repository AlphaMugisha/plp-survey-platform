alter table public.survey_responses
  add column if not exists country_of_origin text;

alter table public.survey_responses
  drop constraint if exists survey_responses_country_of_origin_not_blank;

alter table public.survey_responses
  add constraint survey_responses_country_of_origin_not_blank
  check (country_of_origin is null or length(btrim(country_of_origin)) > 0);
