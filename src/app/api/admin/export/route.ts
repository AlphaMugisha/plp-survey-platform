import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAdminSession } from "@/lib/admin/auth";
import { buildCsv, csvFilename } from "@/lib/csv";
import type { AnswerRow, QuestionRow, SurveyResponseRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CSV export of responses.
 *
 * One row per submission; one column per question, headed by the question's exact
 * original wording. Choice answers export as the exact original option string.
 *
 * Authorisation is checked here AND enforced by RLS: the query runs with the
 * caller's own session, so a non-administrator would receive no rows even if
 * this check were bypassed.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const surveySlug = params.get("survey");
  const school = params.get("school");
  const yearLevel = params.get("year");
  const from = params.get("from");
  const to = params.get("to");
  const search = params.get("q");

  const supabase = await createServerSupabase();

  /* ---- Survey ---- */
  const surveyQuery = supabase.from("surveys").select("id, slug, title");
  const { data: survey } = surveySlug
    ? await surveyQuery.eq("slug", surveySlug).maybeSingle()
    : await surveyQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!survey) {
    return NextResponse.json({ error: "Survey not found." }, { status: 404 });
  }

  /* ---- Questions define the column order (original form order) ---- */
  const { data: questionRows } = await supabase
    .from("questions")
    .select("id, entry_id, title, order_index")
    .eq("survey_id", survey.id)
    .order("order_index");

  const questions = (questionRows ?? []) as Array<
    Pick<QuestionRow, "id" | "entry_id" | "title" | "order_index">
  >;

  /* ---- Responses (same filters as the table view) ---- */
  let responseQuery = supabase
    .from("survey_responses")
    .select("*")
    .eq("survey_id", survey.id);

  if (school) responseQuery = responseQuery.eq("school_name", school);
  if (yearLevel) responseQuery = responseQuery.eq("year_level", yearLevel);
  if (from) responseQuery = responseQuery.gte("submitted_at", from);
  if (to) {
    const end = new Date(`${to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    responseQuery = responseQuery.lt("submitted_at", end.toISOString());
  }
  if (search?.trim()) {
    const term = search.trim().replace(/[%,]/gu, "");
    responseQuery = responseQuery.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const { data: responseRows, error: responseError } = await responseQuery.order(
    "submitted_at",
    { ascending: false },
  );

  if (responseError) {
    console.error("[export] response query failed:", responseError.message);
    return NextResponse.json({ error: "Export failed." }, { status: 502 });
  }

  const responses = (responseRows ?? []) as SurveyResponseRow[];

  /* ---- Answers for exactly those responses ---- */
  const answersByResponse = new Map<string, Map<number, string>>();

  if (responses.length > 0) {
    // Chunked so a large export cannot build an unbounded IN list.
    const ids = responses.map((r) => r.id);
    const CHUNK = 200;

    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { data: answerRows } = await supabase
        .from("answers")
        .select("response_id, entry_id, answer_text")
        .in("response_id", slice);

      for (const a of (answerRows ?? []) as Array<
        Pick<AnswerRow, "response_id" | "entry_id" | "answer_text">
      >) {
        let map = answersByResponse.get(a.response_id);
        if (!map) {
          map = new Map<number, string>();
          answersByResponse.set(a.response_id, map);
        }
        map.set(Number(a.entry_id), a.answer_text);
      }
    }
  }

  /* ---- Compose ---- */
  const headers = [
    "Response ID",
    "Submitted at (UTC)",
    "Email",
    "Year level",
    "School",
    "Duration (seconds)",
    // Exact original question wording, prefixed with the original entry id so a
    // column can always be traced back to the source form.
    ...questions.map((q) => `[${q.entry_id}] ${q.title}`),
  ];

  const rows = responses.map((response) => {
    const answers = answersByResponse.get(response.id);
    return [
      response.id,
      response.submitted_at,
      response.email,
      response.year_level,
      response.school_name,
      response.duration_seconds ?? "",
      ...questions.map((q) => answers?.get(Number(q.entry_id)) ?? ""),
    ];
  });

  const csv = buildCsv(headers, rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(survey.slug)}"`,
      "Cache-Control": "no-store",
    },
  });
}
