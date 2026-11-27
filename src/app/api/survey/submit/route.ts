import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { IP_HASH_SALT, isServiceRoleConfigured } from "@/lib/supabase/config";
import {
  submissionSchema,
  validateSubmissionAnswers,
  type ValidationIssue,
} from "@/lib/survey/schema";
import {
  allQuestions,
  isAsked,
  nameQuestion,
  schoolQuestion,
  schools,
  yearLevelQuestion,
  fieldKeyFor,
  type Question,
} from "@/lib/survey/source";
import { getApplicationWindowStatus } from "@/lib/survey/application-window";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Survey submission endpoint.
 *
 * Participants have NO direct write access to the database (there is no insert
 * RLS policy for anon). Everything arrives here, is re-validated against
 * `survey-source.json` on the server, and is only then written with the
 * service-role key — which never leaves the server.
 */
export async function POST(request: NextRequest) {
  /* ---- 0. Configuration ---- */
  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      {
        error:
          "The survey is not connected to a database yet, so your answers cannot be saved. Please tell your PLP coordinator.",
      },
      { status: 503 },
    );
  }

  /* ---- 1. Parse ---- */
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = submissionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Your submission could not be read. Please check your answers and try again.",
        issues: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const { surveySlug, email, countryOfOrigin, answers, meta } = parsed.data;

  const supabase = createAdminClient();

  /* ---- 3. Resolve the survey ---- */
  const { data: survey, error: surveyError } = await supabase
    .from("surveys")
    .select("id, status, title")
    .eq("slug", surveySlug)
    .maybeSingle();

  if (surveyError) {
    console.error("[submit] survey lookup failed:", surveyError.message);
    return NextResponse.json(
      { error: "We could not reach the survey right now. Please try again shortly." },
      { status: 502 },
    );
  }

  if (!survey) {
    return NextResponse.json(
      {
        error:
          "This survey has not been set up in the database yet. Please tell your PLP coordinator.",
      },
      { status: 404 },
    );
  }

  if (survey.status !== "active" || getApplicationWindowStatus() === "closed") {
    return NextResponse.json(
      { error: "This survey is closed and is no longer accepting responses." },
      { status: 409 },
    );
  }

  /* ---- 4. Map original entry ids to database question rows ---- */
  const { data: questionRows, error: questionsError } = await supabase
    .from("questions")
    .select("id, entry_id, order_index, title, description, type, options, is_required")
    .eq("survey_id", survey.id);

  if (questionsError || !questionRows) {
    console.error("[submit] question lookup failed:", questionsError?.message);
    return NextResponse.json(
      { error: "We could not load the survey questions. Please try again shortly." },
      { status: 502 },
    );
  }

  // Only admin-created questions belong to this application.
  const sourceIds = new Set(allQuestions.map((question) => question.entry_id));
  const customQuestions: Question[] = questionRows.flatMap((row) => {
    const entryId = Number(row.entry_id);
    if (sourceIds.has(entryId)) return [];
    if (row.type !== "paragraph" && row.type !== "short_answer" && row.type !== "multiple_choice") {
      return [];
    }
    return [{
      index: Number(row.order_index),
      entry_id: entryId,
      type: row.type,
      title: row.title,
      description: row.description,
      required: row.is_required,
      options: Array.isArray(row.options) ? row.options : undefined,
      fieldKey: fieldKeyFor(entryId),
    }];
  });

  /* ---- 5. Authoritative validation against this survey's live questions ---- */
  const issues: ValidationIssue[] = validateSubmissionAnswers(answers, customQuestions);
  if (issues.length > 0) {
    return NextResponse.json(
      {
        error: "Some answers are missing or not allowed. Please review and try again.",
        issues: issues.map((i) => ({ field: i.field, message: i.message })),
      },
      { status: 422 },
    );
  }

  const questionIdByEntry = new Map<number, string>(
    questionRows.map((row) => [Number(row.entry_id), row.id as string]),
  );

  const unknown = Object.keys(answers).filter((k) => !questionIdByEntry.has(Number(k)));
  if (unknown.length > 0) {
    console.error("[submit] unknown entry ids:", unknown.join(", "));
    return NextResponse.json(
      { error: "Your submission referenced questions that do not exist in this survey." },
      { status: 422 },
    );
  }

  /* ---- 5. Denormalised columns, read from the validated answers ---- */
  const fullName = answers[String(nameQuestion.entry_id)]?.trim() || "Not provided";
  const yearLevel = answers[String(yearLevelQuestion.entry_id)]?.trim() ?? "";

  // When this deployment does not ask for the school, there is still exactly
  // one school it can be — the overlay declares it — so record that rather
  // than leaving every response unattributed and unfilterable in the
  // dashboard. If the question IS asked, the answer always wins.
  const answeredSchool = answers[String(schoolQuestion.entry_id)]?.trim() ?? "";
  const assumedSchool =
    !answeredSchool && !isAsked(schoolQuestion.entry_id) && schools.length === 1
      ? schools[0]!
      : "";
  const schoolName = answeredSchool || assumedSchool;

  const { data: school } = schoolName
    ? await supabase
        .from("schools")
        .select("id")
        .eq("name", schoolName)
        .maybeSingle()
    : { data: null };

  if (answeredSchool && !school) {
    // The name passed source validation, so the school list in the database is
    // out of step with the source file.
    //
    // Only an ANSWERED school can fail here. An assumed one was never the
    // applicant's choice, so a missing row is our bookkeeping problem, not a
    // reason to throw away their application — it is recorded by name with no
    // school_id and shows up in the dashboard either way.
    console.error(`[submit] school not found in database: ${answeredSchool}`);
    return NextResponse.json(
      {
        error:
          "Your school could not be matched in the database. Please tell your PLP coordinator.",
      },
      { status: 422 },
    );
  }

  /* ---- 6. Insert the response ---- */
  const ipHash = hashIp(request, IP_HASH_SALT);

  const { data: response, error: responseError } = await supabase
    .from("survey_responses")
    .insert({
      survey_id: survey.id,
      email: email!.trim(),
      country_of_origin: countryOfOrigin,
      full_name: fullName,
      school_id: school?.id ?? null,
      school_name: schoolName,
      year_level: yearLevel,
      duration_seconds: meta?.durationSeconds ?? null,
      ip_hash: ipHash,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    })
    .select("id")
    .single();

  if (responseError) {
    // 23505 = unique violation -> one response per email per survey
    if (responseError.code === "23505") {
      return NextResponse.json(
        {
          error:
            "A response has already been submitted with this email address for this survey. If you think this is a mistake, please tell your PLP coordinator.",
        },
        { status: 409 },
      );
    }
    console.error("[submit] response insert failed:", responseError.message);
    return NextResponse.json(
      { error: "We could not save your response. Please try again shortly." },
      { status: 502 },
    );
  }

  /* ---- 7. Insert the answers ---- */
  const answerRows = Object.entries(answers).map(([entryId, value]) => ({
    response_id: response.id,
    question_id: questionIdByEntry.get(Number(entryId))!,
    entry_id: Number(entryId),
    // Stored EXACTLY as submitted — the original option string for choice questions.
    answer_text: value.trim(),
  }));

  const { error: answersError } = answerRows.length
    ? await supabase.from("answers").insert(answerRows)
    : { error: null };

  if (answersError) {
    // Roll back the response so we never keep a submission with partial answers.
    await supabase.from("survey_responses").delete().eq("id", response.id);
    console.error("[submit] answer insert failed, response rolled back:", answersError.message);
    return NextResponse.json(
      { error: "We could not save all of your answers. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { ok: true, responseId: response.id, answersStored: answerRows.length },
    { status: 201 },
  );
}

/**
 * Salted hash of the client IP, for abuse investigation only.
 * Without IP_HASH_SALT configured, nothing is stored — a raw IP never is.
 */
function hashIp(request: NextRequest, salt: string): string | null {
  if (!salt) return null;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
  if (!ip) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
