-- =============================================================================
-- PLP Ishami — Membership Application & Family Questionnaire
--
-- GENERATED from data/application-questions.json by
-- scripts/generate-application-seed.mjs. Do not edit by hand: re-run the
-- generator instead, or edit the questions in the admin dashboard.
--
-- Seeds 6 parts and 19 questions.
--
-- Every question is inserted with is_custom = true, so administrators keep
-- full edit and remove rights over them. The questions from the verified
-- Google Form are untouched by this migration — they stay in the database as
-- an archive and are withheld from this deployment by data/deployment.json.
--
-- Idempotent: re-running replaces the seeded set as long as nobody has
-- answered it, and refuses outright once there are responses.
-- =============================================================================

do $seed$
declare
  v_survey  uuid;
  v_locked  boolean;
  v_section uuid;
  v_order   integer := 0;
begin
  select id, is_locked into v_survey, v_locked
  from public.surveys where slug = E'plp-survey-1-baseline-term-1';

  if v_survey is null then
    raise exception 'Survey % not found — run the seed migrations first.', E'plp-survey-1-baseline-term-1';
  end if;

  -- Replacing a question set would orphan answers already given.
  if public.survey_has_responses(v_survey) then
    raise exception
      'This application already has responses: refusing to replace its questions. '
      'Create a new survey instead.'
      using errcode = 'check_violation';
  end if;

  -- Sections and questions are immutable while the survey is locked.
  update public.surveys set is_locked = false where id = v_survey;

  -- ---- Clear any previously seeded application content ----
  -- Only admin-added rows: the archived source questions are left alone.
  delete from public.questions
   where survey_id = v_survey and is_custom = true;

  delete from public.survey_sections
   where survey_id = v_survey and is_custom = true;

  -- ---- Parts ----
  -- Ordered after the archived source sections, so the unique index on
  -- (survey_id, order_index) cannot collide with them.
  select coalesce(max(order_index), 0) into v_order
  from public.survey_sections where survey_id = v_survey;

  -- PART 1: GETTING TO KNOW YOU
  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title, is_custom)
  values
    (v_survey, v_order + 1, E'PART 1: GETTING TO KNOW YOU', null, E'1', E'PART 1: GETTING TO KNOW YOU', true)
  returning id into v_section;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 1, 1, E'Full name, preferred name, and class:', null, E'paragraph', null, true, true);

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 2, 2, E'How would you describe your personality?', null, E'multiple_choice', E'["Introverted","Extroverted","Ambivert (a mixture of both)","Other: __________"]'::jsonb, true, true);

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 3, 3, E'What are your interests, talents, or passions?', null, E'multiple_choice', E'["Leadership and public speaking","Creativity and arts","Sports and fitness","Technology and innovation","Volunteering and helping others","Music and entertainment","Other: __________"]'::jsonb, true, true);

  -- PART 2: YOUR PURPOSE & EXPECTATIONS
  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title, is_custom)
  values
    (v_survey, v_order + 2, E'PART 2: YOUR PURPOSE & EXPECTATIONS', null, E'2', E'PART 2: YOUR PURPOSE & EXPECTATIONS', true)
  returning id into v_section;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 4, 4, E'Have you been part of PLP before?', null, E'multiple_choice', E'["Yes","No"]'::jsonb, true, true);

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 5, 5, E'If yes, briefly describe your experience.', null, E'paragraph', null, false, true);

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 6, 6, E'Why do you genuinely want to become part of the PLP family, and what do you hope to gain from it?', null, E'paragraph', null, true, true);

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 7, 7, E'What do you believe you can bring to this family that will make it better?', null, E'paragraph', null, true, true);

  -- PART 3: CHARACTER & RELATIONSHIPS
  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title, is_custom)
  values
    (v_survey, v_order + 3, E'PART 3: CHARACTER & RELATIONSHIPS', null, E'3', E'PART 3: CHARACTER & RELATIONSHIPS', true)
  returning id into v_section;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 8, 8, E'When you disagree with someone, especially someone you are close to, how do you usually handle the situation?', null, E'multiple_choice', E'["Discuss the issue calmly and respectfully.","Listen to understand their perspective.","Take time to cool down before addressing it.","Avoid the person or ignore the issue.","Other: __________"]'::jsonb, true, true);

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 9, 9, E'Imagine a member makes a mistake, shares an unpopular opinion, or struggles to fit in. How would you treat them?', null, E'multiple_choice', E'["Encourage and support them.","Respect their differences and give them space.","Help them improve without embarrassing them.","Distance myself from them.","Other: __________"]'::jsonb, true, true);

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 10, 10, E'If you witnessed gossip, bullying, betrayal of trust, or intentional exclusion within PLP, what would you do?', null, E'multiple_choice', E'["Address the situation respectfully.","Support the affected person.","Report it to the coordinator or appropriate committee member.","Stay silent to avoid involvement.","Other: __________"]'::jsonb, true, true);

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 11, 11, E'If someone trusted you with a personal struggle or secret, what would that trust mean to you, and how would you protect it?', null, E'paragraph', null, true, true);

  -- PART 4: COMMITMENT & ACCOUNTABILITY
  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title, is_custom)
  values
    (v_survey, v_order + 4, E'PART 4: COMMITMENT & ACCOUNTABILITY', null, E'4', E'PART 4: COMMITMENT & ACCOUNTABILITY', true)
  returning id into v_section;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 12, 12, E'How would you balance your academic responsibilities with your commitment to PLP?', null, E'multiple_choice', E'["Plan and manage my time responsibly.","Communicate when I have conflicting responsibilities.","Participate whenever my schedule allows.","I am still learning how to manage my time."]'::jsonb, true, true);

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 13, 13, E'If you make a commitment to the family but fail to fulfill it, what would you do?', null, E'multiple_choice', E'["Take responsibility and apologize.","Explain the situation and find a solution.","Wait for someone to remind me.","Ignore it and move on."]'::jsonb, true, true);

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 14, 14, E'Are you willing to contribute even when you are not in a leadership position, receive no recognition, or are not directly benefiting?', null, E'multiple_choice', E'["Yes, absolutely.","Yes, but I may need encouragement.","Only when I have enough time.","No, I prefer taking part when I benefit directly."]'::jsonb, true, true);

  -- PART 5: THE MEANING OF FAMILY
  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title, is_custom)
  values
    (v_survey, v_order + 5, E'PART 5: THE MEANING OF FAMILY', null, E'5', E'PART 5: THE MEANING OF FAMILY', true)
  returning id into v_section;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 15, 15, E'PLP believes: "Nobody gets left behind. Nobody gets intentionally pushed out." What does this statement mean to you, and how would you put it into practice?', null, E'paragraph', null, true, true);

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 16, 16, E'What kind of person do you want to become through PLP, and what personal change or contribution are you willing to commit to make this family stronger?', null, E'paragraph', null, true, true);

  -- FINAL FAMILY AGREEMENT
  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title, is_custom)
  values
    (v_survey, v_order + 6, E'FINAL FAMILY AGREEMENT', E'By joining PLP Ishami, I understand that being part of this family comes with responsibilities, not just privileges.\n\nI agree to respect others, communicate honestly, protect confidentiality, avoid bullying and gossip, participate actively, take accountability for my actions, and contribute to creating a safe and supportive environment.', E'6', E'FINAL FAMILY AGREEMENT', true)
  returning id into v_section;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 17, 17, E'Name:', null, E'short_answer', null, true, true);

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 18, 18, E'Signature:', null, E'short_answer', null, true, true);

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required, is_custom)
  values
    (v_survey, v_section, 19, 19, E'Date:', null, E'short_answer', null, true, true);

  update public.surveys set is_locked = coalesce(v_locked, true) where id = v_survey;

  raise notice 'Seeded 6 part(s) and 19 question(s) for the PLP Ishami application.';
end
$seed$;

-- =============================================================================
-- Verification
-- =============================================================================

do $check$
declare
  v_survey   uuid;
  n_sections integer;
  n_questions integer;
begin
  select id into v_survey from public.surveys where slug = E'plp-survey-1-baseline-term-1';

  select count(*) into n_sections
  from public.survey_sections where survey_id = v_survey and is_custom = true;

  select count(*) into n_questions
  from public.questions where survey_id = v_survey and is_custom = true;

  if n_sections <> 6 then
    raise exception 'Expected 6 parts, found %.', n_sections;
  end if;

  if n_questions <> 19 then
    raise exception 'Expected 19 questions, found %.', n_questions;
  end if;

  -- Every seeded question must sit in one of the seeded parts.
  if exists (
    select 1 from public.questions q
    where q.survey_id = v_survey and q.is_custom = true and q.section_id is null
  ) then
    raise exception 'A seeded application question is not in any part.';
  end if;

  -- No stored text may carry a carriage return (see migration 0007).
  if exists (
    select 1 from public.questions q
    where q.survey_id = v_survey and q.is_custom = true
      and (q.title like E'%\r%' or coalesce(q.description, '') like E'%\r%')
  ) then
    raise exception 'A seeded question contains a carriage return.';
  end if;

  raise notice 'Verified: % part(s), % question(s), all grouped.', n_sections, n_questions;
end
$check$;
