-- =============================================================================
-- PLP Survey Platform — baseline survey content
-- Migration 20260101000400  (GENERATED — do not edit by hand)
--
-- Generated from data/survey-source.json by: npm run generate:migrations
-- Source form: https://docs.google.com/forms/d/e/1FAIpQLSdOB12gVLmmamsogept8XAnw0sM5vCiJzghxnAHJSx8UamcOg/viewform
--
-- 5 sections, 28 questions (27 required,
-- 1 optional). Question wording, descriptions, answer options,
-- required flags, original Google entry ids and original ordering are all
-- reproduced verbatim from the source file.
--
-- Multiple-choice options are stored as the EXACT original strings
-- (e.g. '3 — Neutral / Sometimes'), never converted to numbers.
--
-- This block is idempotent: it only seeds content when the survey has no
-- questions yet, so it is safe to re-run after the survey has been locked.
-- =============================================================================

do $seed$
declare
  v_survey uuid;
begin
  insert into public.surveys
    (slug, title, description, confirmation_message, source_url,
     collects_email, email_required, status, version, published_at)
  values
    (E'plp-survey-1-baseline-term-1',
     E'PLP Survey 1 — Baseline (Beginning of Term 1)',
     E'Peace and Love Proclaimers | PLP School Curriculum\n\nThis survey is filled in BEFORE the PLP program begins. It captures who you are right now — your confidence, your skills, your values. There are no right or wrong answers. Be completely honest. You will fill in a similar survey at the end of each term and at the end of the year so we can see how you have grown.\n\n🔒 Your answers are anonymous beyond your name and school. They will only be used to improve the PLP program.',
     E'Thank you! Your baseline survey has been submitted. Welcome to PLP. Lead with peace. Create with purpose. Thrive with opportunity.',
     E'https://docs.google.com/forms/d/e/1FAIpQLSdOB12gVLmmamsogept8XAnw0sM5vCiJzghxnAHJSx8UamcOg/viewform',
     true,
     true,
     'active',
     1,
     now())
  on conflict (slug) do nothing;

  select id into v_survey from public.surveys where slug = E'plp-survey-1-baseline-term-1';

  if v_survey is null then
    raise exception 'Failed to create or locate survey plp-survey-1-baseline-term-1';
  end if;

  -- Only seed content once. Re-running is a no-op.
  if exists (select 1 from public.questions where survey_id = v_survey) then
    raise notice 'Survey % already has questions — skipping content seed.', E'plp-survey-1-baseline-term-1';
    return;
  end if;

  -- ------------------------------------------------------------------
  -- Sections (5)
  -- ------------------------------------------------------------------

  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title)
  values
    (v_survey, 1, E'SECTION A1 — Leadership Identity & Confidence', E'Answer honestly based on who you are RIGHT NOW, before the program begins.\n\n1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always', E'A1', E'Leadership Identity & Confidence')
  on conflict (survey_id, order_index) do nothing;

  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title)
  values
    (v_survey, 2, E'SECTION A2 — Skills & Knowledge', E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always', E'A2', E'Skills & Knowledge')
  on conflict (survey_id, order_index) do nothing;

  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title)
  values
    (v_survey, 3, E'SECTION A3 — Peace Values & Civic Responsibility', E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always', E'A3', E'Peace Values & Civic Responsibility')
  on conflict (survey_id, order_index) do nothing;

  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title)
  values
    (v_survey, 4, E'SECTION B — Starting Confidence', E'These questions are about how confident you feel RIGHT NOW. Some of these skills may be covered later in the PLP curriculum. There are no right or wrong answers.\n\n1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always', E'B', E'Starting Confidence')
  on conflict (survey_id, order_index) do nothing;

  insert into public.survey_sections
    (survey_id, order_index, title, description, short_label, plain_title)
  values
    (v_survey, 5, E'SECTION C — About You', E'A few open questions to help us understand your starting point. Take your time.', E'C', E'About You')
  on conflict (survey_id, order_index) do nothing;

  -- ------------------------------------------------------------------
  -- Questions (28) — original form order preserved via order_index
  -- ------------------------------------------------------------------

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     null,
     1363545445,
     0,
     E'Full Name',
     null,
     'short_answer',
     null,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     null,
     392476008,
     1,
     E'School Name',
     E'Please select your school from the list.',
     'dropdown',
     E'["ACEJ Karama","Acodes Mushishiro","Agahozo Shalom Youth Village","Akagera International School","Apaer Institute","APEFOC Gisenyi","Apeki Tumba","Apeki Tumba TSS","Bigogwe TSS","Blue lakes International School","Centre de jeunes Muert","Church Of God High School (St Patrick)","College Adec Ruhanga","College Apapec Remera Rukoma","College APPEKA Kabarondo TSS","College Baptist St Sylvestre de Kinigi","COLLEGE DE GISENYI INYEMERAMIHIGO","Collège de l''Immaculée Conception","COLLEGE DE LA PAIX","Collège de Rwankeri","College du Christ Roi de Nyanza","College Saint Andre","Collège Saint Ignace Mugina","College Sainte Marie Reine Kabgayi","College St Ignace Kamonyi","E.S Kabare / GS Kabare","E.S Kabarondo","E.S NYANGE","E.S st Alphonse Marie de liguori Mubuga","EAV Kivumu","Ecole de Lettres Gatovu","Ecole de science de Kidaho","Ecole de Science de Musanze","Ecole des science de Gisenyi (ESG)","Ecole des sciences Byimana","Ecole Secondaire Sancta Maria Karambo","Ecole secondaire elena guerra","Ecole secondaire Gafunzo","Ecole Secondaire Islamique de Ruhengeri","Ecole Secondaire Marie Adelaide","Ecole Secondaire Nyarugunga","Ecole Secondaire St Joseph Le travailleur","Ecole Secondaire St Vincent","Ecole Secondaire Stella Matutina","Ecole Secondary de Mushubi","Ecole Secondary RUKOMA SOPEM","Ecole Technique St Kizito","Ecole Tecnique de Kabgayi","EFOTEC","ENDP karubanda","ES BISESERO","ES GISHOMA","ES Kayonza Modern","Es Kigoma","ES KIRINDA","ES Marie Reine de la Paix","ES MUBUGA","ES MUHORORO","ES MUNZANGA SCHOOL","ES MURUNDA","ES RUGABANO","ES RUGANDA","ES Shangi","ES St Jean Bosco de Simbi","ESA Gisenyi","Eteka Muhanga","Eto Nyamata","EXCELLA","Fawe gahini","Fawe Gisozi","Forever TVET","G.S APAPEC Murambi","G.S APE Rugunga","G.S APRED Ndera","G.S BIHE / TSS","G.S BURINGO","G.S MUKONDO","G.S MWEGERA","G.S NDA NYUNDO","G.S RAMBURA (F)","G.S RAMBURA (G)","G.S RYABIZIGE TSS","G.S SANZARE SAINT ALOYS","G.S St Philippe Neri Gisagara","G.S ST.RAPHAEL RAMBURA","Gahogo Adventist Academy","Gashora Girls Academy","Gatsibo Tss","GIKONKO TSS","Glory academy","Green Hills Academy","Group scolaire Rilima","Groupe officielle de Butare","Groupe Scolaire Mater Dei","Groupe Scolaire Mère Du Verbe kibeho","Groupe Scolaire Saint Joseph Kabgayi","Groupe Scolaire Sainte Bernadette Save","GS BISUSA","GS BUNGWE","GS BUSIGARI","GS BWEYEYE","GS DIHIRO","GS GAHENGERI","GS GASUMO","GS GIHUNDWE","GS Gisozi","GS HANIKA","GS KABAYA","GS KAGOMBYI","GS KAMEMBE PRESBYTERIEN","Gs marie merci","GS MURIRA","GS Muzizi","GS Notre Dame du Bon Conseil Byumba","GS NYABIKERI","GS SAINT JOSEPH BIRAMBO","GS SAINT MATHIEU DE BUSASAMANA","GS SAINT PIERRE NKOMBO","GSCIM RWANKUBA","GSNDL Byimana","Hope Haven Secondary school","IFAK Don Bosco","Igihozo Saint Peter Secondary School","Inyange Girls School","IPRC Kigali Tss","Kabutare technical secondary school","Kagarama secondary school","Karenge Adventist Secondary School","Kibeho TSS","Kigali Excellent in Tourism and Hospitality Academy (KETHA)","King David Academy","Kivumu Tss","Kiziguro Secondary School","Lycee de Kicukiro Apade","Lycee de Kigali","Lycee de Nyanza","Lycée du Lac de Muhazi (ASPEJ)","Lycee Notre Dame de Citeaux","Lycee Notre Dame de la visitation rulindo","Maranyundo Girls School","Maryhill Girls Secondary School","Monseigneur Mubiligi Catholic TSS","Mother Mary School Complex","MTC Muhanga","Muhabura Integrated Polytechnic College","Muhanga Tss","NEGA gashora","Nelson Mandela TVET School","New Life Christian Academy","Ngoma Adventist College of Health Sciences","Nyagatare secondary school","Nyamata Highschool","Nyamugali Secondary School","Nyange Secondary School","Nyanza Tss","Nyundo School of Arts","Nyundo School of Music","PETIT SEMINAIRE SAINT PIE X DE NYUNDO","Pt Seminaire St Leo Kabgayi","Riviera High School","Runda TSS","Rwabuye TSS","Rwanda Coding Academy","Saint Bernadette Kamonyi","Saint Bernard Kansi","Saint Ignace TSS","Saint Ignatius High School Kibagabaga","Saint Kiziti Rwamagana","Saint Mary High School","saint Mary''s high school kiruhura","Saint Sylvan Muranga","SOS THS","St Aloys","St Jean Murundi Secondary School","St Jean Nyarusange","St Peter School of Shyogwe","TTC DE LA SALLE BYUMBA","TTC Kabarore","TTC Nyamata","WORLD MISSION HIGH SCHOOL"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     null,
     672559437,
     2,
     E'Year Level',
     null,
     'multiple_choice',
     E'["S1","S2","S3","S4","S5","S6"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 1),
     1250388049,
     4,
     E'I see myself as a leader.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 1),
     622497614,
     5,
     E'I believe my voice and opinions matter.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 1),
     1557927388,
     6,
     E'I am confident speaking in front of a group.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 1),
     2045282778,
     7,
     E'I set goals for myself and work toward them.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 1),
     1923734074,
     8,
     E'I take initiative without waiting to be asked.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 1),
     862335306,
     9,
     E'I can lead others even when it is difficult.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 2),
     2050294250,
     11,
     E'I can communicate my ideas clearly to others.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 2),
     1754423846,
     12,
     E'I know how to research a topic and evaluate whether information is reliable.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 2),
     1967499013,
     13,
     E'I understand how to manage money and make a basic budget.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 2),
     946747526,
     14,
     E'I can identify a problem in my community and think of solutions.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 2),
     848090481,
     15,
     E'I know how to write a project proposal.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 3),
     21824051,
     17,
     E'I believe peace in my community is something I can contribute to.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 3),
     1276040987,
     18,
     E'I understand why Rwanda''s history matters to my generation.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 3),
     2042551412,
     19,
     E'I treat people from different backgrounds with respect and empathy.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 3),
     1881648513,
     20,
     E'I speak up when I see unfair or divisive behavior.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 3),
     978166343,
     21,
     E'I feel responsible for the wellbeing of my community.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 4),
     610283415,
     23,
     E'I feel confident finding reliable information when I need it.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 4),
     749611187,
     24,
     E'I feel confident managing my money and making a basic budget.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 4),
     584554120,
     25,
     E'I feel confident identifying a problem and thinking of a practical solution.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 4),
     325256702,
     26,
     E'I feel confident developing an idea into a simple project proposal.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 4),
     324323319,
     27,
     E'I feel confident handling disagreement or conflict in a constructive way.',
     E'1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always',
     'multiple_choice',
     E'["1 — Strongly Disagree / Not at all","2 — Disagree / A little","3 — Neutral / Sometimes","4 — Agree / Often","5 — Strongly Agree / Always"]'::jsonb,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 5),
     2090256807,
     29,
     E'In your own words, what does it mean to be a leader?',
     null,
     'paragraph',
     null,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 5),
     1283952506,
     30,
     E'What is one thing you hope PLP gives you this year?',
     null,
     'paragraph',
     null,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 5),
     852041322,
     31,
     E'What is your biggest personal goal for the next 12 months?',
     null,
     'paragraph',
     null,
     true)
  on conflict (survey_id, entry_id) do nothing;

  insert into public.questions
    (survey_id, section_id, entry_id, order_index, title, description, type, options, is_required)
  values
    (v_survey,
     (select id from public.survey_sections where survey_id = v_survey and order_index = 5),
     1661896947,
     32,
     E'Is there anything you are worried or unsure about as you start this program? (Optional)',
     null,
     'paragraph',
     null,
     false)
  on conflict (survey_id, entry_id) do nothing;

  -- Freeze the baseline instrument. Future surveys are new rows.
  update public.surveys set is_locked = true where id = v_survey;
end
$seed$;

-- =============================================================================
-- Post-seed verification — the migration fails if content does not match source
-- =============================================================================

do $check$
declare
  v_survey    uuid;
  n_sections  integer;
  n_questions integer;
  n_required  integer;
begin
  select id into v_survey from public.surveys where slug = E'plp-survey-1-baseline-term-1';

  select count(*) into n_sections  from public.survey_sections where survey_id = v_survey;
  select count(*) into n_questions from public.questions       where survey_id = v_survey;
  select count(*) into n_required  from public.questions
    where survey_id = v_survey and is_required;

  if n_sections <> 5 then
    raise exception 'Expected 5 sections, found %', n_sections;
  end if;
  if n_questions <> 28 then
    raise exception 'Expected 28 questions, found %', n_questions;
  end if;
  if n_required <> 27 then
    raise exception 'Expected 27 required questions, found %', n_required;
  end if;

  raise notice 'Baseline survey verified: % sections, % questions (% required).',
    n_sections, n_questions, n_required;
end
$check$;
