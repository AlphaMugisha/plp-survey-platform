import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type {
  AnswerRow,
  QuestionRow,
  SchoolRow,
  SurveyResponseRow,
  SurveyRow,
  SurveySectionRow,
} from "@/lib/supabase/types";
import { BASELINE_SURVEY_SLUG } from "@/lib/survey/source";
import { distribution, meanScale } from "@/lib/survey/scale";

/**
 * Admin data access.
 *
 * Every query runs through the RLS-respecting server client with the signed-in
 * administrator's session — never the service-role key. If the session is not an
 * active administrator these queries return nothing, by database policy rather
 * than by application logic.
 */

export type SurveyWithCounts = SurveyRow & { response_count: number };

export async function listSurveys(): Promise<SurveyWithCounts[]> {
  const supabase = await createServerSupabase();

  const { data: surveys, error } = await supabase
    .from("surveys")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !surveys) return [];

  const withCounts = await Promise.all(
    (surveys as SurveyRow[]).map(async (survey) => {
      const { count } = await supabase
        .from("survey_responses")
        .select("id", { count: "exact", head: true })
        .eq("survey_id", survey.id);
      return { ...survey, response_count: count ?? 0 };
    }),
  );

  return withCounts;
}

export async function getSurveyBySlug(slug = BASELINE_SURVEY_SLUG): Promise<SurveyRow | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("surveys").select("*").eq("slug", slug).maybeSingle();
  return (data as SurveyRow) ?? null;
}

/** The survey the dashboard defaults to: the baseline, or the newest if absent. */
export async function getDefaultSurvey(): Promise<SurveyRow | null> {
  const baseline = await getSurveyBySlug();
  if (baseline) return baseline;

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("surveys")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SurveyRow) ?? null;
}

/* ------------------------------------------------------------------ *
 * Overview
 * ------------------------------------------------------------------ */

export type OverviewStats = {
  totalResponses: number;
  distinctSchools: number;
  totalSchools: number;
  distinctStudents: number;
  yearLevels: Array<{ level: string; count: number }>;
  recent: Array<
    Pick<
      SurveyResponseRow,
      "id" | "full_name" | "school_name" | "year_level" | "submitted_at"
    >
  >;
  medianDurationSeconds: number | null;
  answeredCells: number;
  expectedCells: number;
  optionalAnswered: number;
  firstSubmission: string | null;
  lastSubmission: string | null;
};

export async function getOverviewStats(surveyId: string): Promise<OverviewStats> {
  const supabase = await createServerSupabase();

  const [{ count: totalResponses }, { count: totalSchools }, { data: questionRows }] =
    await Promise.all([
      supabase
        .from("survey_responses")
        .select("id", { count: "exact", head: true })
        .eq("survey_id", surveyId),
      supabase.from("schools").select("id", { count: "exact", head: true }),
      supabase
        .from("questions")
        .select("id, created_at")
        .eq("survey_id", surveyId),
    ]);

  // Pull the light columns we need to aggregate in memory. A school programme's
  // response volume makes this cheaper and simpler than a set of RPCs.
  const { data: rows } = await supabase
    .from("survey_responses")
    .select("id, email, full_name, school_name, year_level, submitted_at, duration_seconds")
    .eq("survey_id", surveyId)
    .order("submitted_at", { ascending: false });

  const responses = (rows ?? []) as Array<
    Pick<
      SurveyResponseRow,
      | "id"
      | "email"
      | "full_name"
      | "school_name"
      | "year_level"
      | "submitted_at"
      | "duration_seconds"
    >
  >;

  // A question added later should not make older submissions look incomplete.
  const expectedCells = responses.reduce((total, response) => {
    const submittedAt = new Date(response.submitted_at).getTime();
    return total + (questionRows ?? []).filter(
      (question) => new Date(question.created_at).getTime() <= submittedAt,
    ).length;
  }, 0);

  const schoolSet = new Set(responses.map((r) => r.school_name));
  const studentSet = new Set(responses.map((r) => r.email.trim().toLowerCase()));

  const yearCounts = new Map<string, number>();
  for (const r of responses) {
    yearCounts.set(r.year_level, (yearCounts.get(r.year_level) ?? 0) + 1);
  }

  const durations = responses
    .map((r) => r.duration_seconds)
    .filter((d): d is number => typeof d === "number" && d > 0)
    .sort((a, b) => a - b);

  const medianDurationSeconds =
    durations.length === 0
      ? null
      : durations.length % 2 === 1
        ? durations[(durations.length - 1) / 2]!
        : Math.round(
            (durations[durations.length / 2 - 1]! + durations[durations.length / 2]!) / 2,
          );

  const { count: answeredCells } = await supabase
    .from("answers")
    .select("id", { count: "exact", head: true })
    .in(
      "response_id",
      responses.length > 0 ? responses.map((r) => r.id) : ["00000000-0000-0000-0000-000000000000"],
    );

  // How many people answered the one optional question.
  const { data: optionalQuestions } = await supabase
    .from("questions")
    .select("id")
    .eq("survey_id", surveyId)
    .eq("is_required", false);

  let optionalAnswered = 0;
  if (optionalQuestions && optionalQuestions.length > 0 && responses.length > 0) {
    const { count } = await supabase
      .from("answers")
      .select("id", { count: "exact", head: true })
      .in(
        "question_id",
        optionalQuestions.map((q) => q.id as string),
      )
      .in(
        "response_id",
        responses.map((r) => r.id),
      );
    optionalAnswered = count ?? 0;
  }

  const sorted = [...responses].sort(
    (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime(),
  );

  return {
    totalResponses: totalResponses ?? responses.length,
    distinctSchools: schoolSet.size,
    totalSchools: totalSchools ?? 0,
    distinctStudents: studentSet.size,
    yearLevels: [...yearCounts.entries()]
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => a.level.localeCompare(b.level, undefined, { numeric: true })),
    recent: responses.slice(0, 8).map((r) => ({
      id: r.id,
      full_name: r.full_name,
      school_name: r.school_name,
      year_level: r.year_level,
      submitted_at: r.submitted_at,
    })),
    medianDurationSeconds,
    answeredCells: answeredCells ?? 0,
    expectedCells,
    optionalAnswered,
    firstSubmission: sorted[0]?.submitted_at ?? null,
    lastSubmission: sorted[sorted.length - 1]?.submitted_at ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * Analytics
 * ------------------------------------------------------------------ */

export type QuestionAnalytics = {
  entryId: number;
  title: string;
  sectionId: string | null;
  orderIndex: number;
  /** Mean of the ORIGINAL option ordering. Null when no scale answers exist. */
  mean: number | null;
  responses: number;
  distribution: ReturnType<typeof distribution>;
};

export type SectionAnalytics = {
  id: string;
  title: string;
  shortLabel: string;
  plainTitle: string;
  orderIndex: number;
  mean: number | null;
  questionCount: number;
  responses: number;
};

export type AnalyticsResult = {
  questions: QuestionAnalytics[];
  sections: SectionAnalytics[];
  totalScaleAnswers: number;
};

/**
 * Averages by question and by section.
 *
 * Numeric conversion happens HERE, at read time, from each answer's position in
 * the original option ordering. The stored answer is always the original string.
 */
export async function getAnalytics(surveyId: string): Promise<AnalyticsResult> {
  const supabase = await createServerSupabase();

  const [{ data: questionRows }, { data: sectionRows }] = await Promise.all([
    supabase
      .from("questions")
      .select("id, entry_id, title, type, options, section_id, order_index")
      .eq("survey_id", surveyId)
      .order("order_index"),
    supabase
      .from("survey_sections")
      .select("*")
      .eq("survey_id", surveyId)
      .order("order_index"),
  ]);

  const questions = (questionRows ?? []) as Array<
    Pick<
      QuestionRow,
      "id" | "entry_id" | "title" | "type" | "options" | "section_id" | "order_index"
    >
  >;
  const sections = (sectionRows ?? []) as SurveySectionRow[];

  if (questions.length === 0) {
    return { questions: [], sections: [], totalScaleAnswers: 0 };
  }

  // All answers belonging to this survey, via the response join.
  const { data: answerRows } = await supabase
    .from("answers")
    .select("question_id, answer_text, survey_responses!inner(survey_id)")
    .eq("survey_responses.survey_id", surveyId);

  const answers = (answerRows ?? []) as Array<Pick<AnswerRow, "question_id" | "answer_text">>;

  const byQuestion = new Map<string, string[]>();
  for (const a of answers) {
    const list = byQuestion.get(a.question_id);
    if (list) list.push(a.answer_text);
    else byQuestion.set(a.question_id, [a.answer_text]);
  }

  let totalScaleAnswers = 0;

  const questionAnalytics: QuestionAnalytics[] = questions.map((q) => {
    const texts = byQuestion.get(q.id) ?? [];
    const dist = distribution(texts);
    const scaleAnswerCount = dist.reduce((sum, d) => sum + d.count, 0);
    totalScaleAnswers += scaleAnswerCount;

    return {
      entryId: Number(q.entry_id),
      title: q.title,
      sectionId: q.section_id,
      orderIndex: q.order_index,
      mean: meanScale(texts),
      responses: scaleAnswerCount,
      distribution: dist,
    };
  });

  const sectionAnalytics: SectionAnalytics[] = sections.map((section) => {
    const inSection = questionAnalytics.filter(
      (q) => q.sectionId === section.id && q.mean !== null,
    );
    const weighted = inSection.reduce((sum, q) => sum + q.mean! * q.responses, 0);
    const totalAnswers = inSection.reduce((sum, q) => sum + q.responses, 0);

    return {
      id: section.id,
      title: section.title,
      shortLabel: section.short_label ?? String(section.order_index),
      plainTitle: section.plain_title ?? section.title,
      orderIndex: section.order_index,
      mean: totalAnswers > 0 ? weighted / totalAnswers : null,
      questionCount: questionAnalytics.filter((q) => q.sectionId === section.id).length,
      responses: totalAnswers,
    };
  });

  return {
    // Only questions that actually carry scale answers are meaningful here.
    questions: questionAnalytics.filter((q) => q.responses > 0 || q.mean !== null),
    sections: sectionAnalytics,
    totalScaleAnswers,
  };
}

/* ------------------------------------------------------------------ *
 * Responses
 * ------------------------------------------------------------------ */

export type ResponseFilters = {
  surveyId: string;
  search?: string;
  school?: string;
  yearLevel?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export type ResponseListResult = {
  rows: SurveyResponseRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function listResponses(filters: ResponseFilters): Promise<ResponseListResult> {
  const supabase = await createServerSupabase();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  let query = supabase
    .from("survey_responses")
    .select("*", { count: "exact" })
    .eq("survey_id", filters.surveyId);

  if (filters.school) query = query.eq("school_name", filters.school);
  if (filters.yearLevel) query = query.eq("year_level", filters.yearLevel);
  if (filters.from) query = query.gte("submitted_at", filters.from);
  if (filters.to) {
    // `to` is an inclusive calendar day — push to the end of that day.
    const end = new Date(`${filters.to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    query = query.lt("submitted_at", end.toISOString());
  }
  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%,]/gu, "");
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const { data, count } = await query
    .order("submitted_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const total = count ?? 0;

  return {
    rows: (data ?? []) as SurveyResponseRow[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type ResponseDetail = {
  response: SurveyResponseRow;
  survey: SurveyRow | null;
  sections: SurveySectionRow[];
  items: Array<{
    question: Pick<
      QuestionRow,
      "id" | "entry_id" | "title" | "type" | "section_id" | "order_index" | "is_required"
    >;
    answer: string | null;
  }>;
};

export async function getResponseDetail(responseId: string): Promise<ResponseDetail | null> {
  const supabase = await createServerSupabase();

  const { data: response } = await supabase
    .from("survey_responses")
    .select("*")
    .eq("id", responseId)
    .maybeSingle();

  if (!response) return null;
  const row = response as SurveyResponseRow;

  const [{ data: survey }, { data: questionRows }, { data: sectionRows }, { data: answerRows }] =
    await Promise.all([
      supabase.from("surveys").select("*").eq("id", row.survey_id).maybeSingle(),
      supabase
        .from("questions")
        .select("id, entry_id, title, type, section_id, order_index, is_required")
        .eq("survey_id", row.survey_id)
        .order("order_index"),
      supabase
        .from("survey_sections")
        .select("*")
        .eq("survey_id", row.survey_id)
        .order("order_index"),
      supabase.from("answers").select("question_id, answer_text").eq("response_id", responseId),
    ]);

  const answerByQuestion = new Map<string, string>(
    ((answerRows ?? []) as Array<Pick<AnswerRow, "question_id" | "answer_text">>).map((a) => [
      a.question_id,
      a.answer_text,
    ]),
  );

  const questions = (questionRows ?? []) as ResponseDetail["items"][number]["question"][];

  return {
    response: row,
    survey: (survey as SurveyRow) ?? null,
    sections: (sectionRows ?? []) as SurveySectionRow[],
    items: questions.map((question) => ({
      question,
      answer: answerByQuestion.get(question.id) ?? null,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Filter option lists
 * ------------------------------------------------------------------ */

export async function listSchoolsWithResponses(
  surveyId: string,
): Promise<Array<{ name: string; count: number }>> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("survey_responses")
    .select("school_name")
    .eq("survey_id", surveyId);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ school_name: string }>) {
    counts.set(row.school_name, (counts.get(row.school_name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function listAllSchools(): Promise<SchoolRow[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("schools").select("*").order("display_order");
  return (data ?? []) as SchoolRow[];
}

export async function listYearLevels(surveyId: string): Promise<string[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("survey_responses")
    .select("year_level")
    .eq("survey_id", surveyId);

  return [...new Set(((data ?? []) as Array<{ year_level: string }>).map((r) => r.year_level))].sort(
    (a, b) => a.localeCompare(b, undefined, { numeric: true }),
  );
}

/* ------------------------------------------------------------------ *
 * Question management
 * ------------------------------------------------------------------ */

export type ManagedQuestion = {
  entryId: number;
  orderIndex: number;
  title: string;
  description: string | null;
  type: string;
  options: string[] | null;
  isRequired: boolean;
  /** False for the questions seeded from the verified form. */
  isCustom: boolean;
  /** How many submitted answers reference it. */
  answerCount: number;
  /** Only an admin-added question with no answers can be removed. */
  canRemove: boolean;
};

/** Every question on a survey, with what the admin UI needs to manage it. */
export async function listManagedQuestions(surveyId: string): Promise<ManagedQuestion[]> {
  const supabase = await createServerSupabase();

  const { data: rows } = await supabase
    .from("questions")
    .select("id, entry_id, order_index, title, description, type, options, is_required, is_custom")
    .eq("survey_id", surveyId)
    .order("order_index");

  const questions = (rows ?? []) as Array<{
    id: string;
    entry_id: number;
    order_index: number;
    title: string;
    description: string | null;
    type: string;
    options: string[] | null;
    is_required: boolean;
    is_custom: boolean | null;
  }>;

  if (questions.length === 0) return [];

  // One grouped count rather than a query per question.
  const { data: answerRows } = await supabase
    .from("answers")
    .select("question_id")
    .in(
      "question_id",
      questions.map((q) => q.id),
    );

  const counts = new Map<string, number>();
  for (const row of (answerRows ?? []) as Array<{ question_id: string }>) {
    counts.set(row.question_id, (counts.get(row.question_id) ?? 0) + 1);
  }

  return questions.map((q) => {
    const answerCount = counts.get(q.id) ?? 0;
    const isCustom = Boolean(q.is_custom);
    return {
      entryId: Number(q.entry_id),
      orderIndex: q.order_index,
      title: q.title,
      description: q.description,
      type: q.type,
      options: Array.isArray(q.options) ? q.options : null,
      isRequired: q.is_required,
      isCustom,
      answerCount,
      canRemove: isCustom && answerCount === 0,
    };
  });
}
