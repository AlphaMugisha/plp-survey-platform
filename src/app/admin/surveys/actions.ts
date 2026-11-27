"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/admin/auth";
import type { QuestionRow, SurveySectionRow } from "@/lib/supabase/types";

/**
 * Survey management actions.
 *
 * Every action re-checks the caller is a manager. That check is belt-and-braces:
 * RLS already restricts these writes to active owner/admin profiles, and the
 * database triggers independently refuse any content change to a survey that
 * has responses.
 */

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

async function requireManagerOrFail() {
  const session = await getAdminSession();
  if (!session) return { session: null, error: "You are not signed in as an administrator." };
  if (!session.canManage) {
    return { session: null, error: "Your role is read-only. Ask an owner to make this change." };
  }
  return { session, error: null };
}

/* ------------------------------------------------------------------ *
 * Status transitions
 * ------------------------------------------------------------------ */

const statusSchema = z.object({
  surveyId: z.string().uuid(),
  status: z.enum(["draft", "active", "closed"]),
});

export async function setSurveyStatus(formData: FormData): Promise<ActionResult> {
  const { error: authError } = await requireManagerOrFail();
  if (authError) return { ok: false, error: authError };

  const parsed = statusSchema.safeParse({
    surveyId: formData.get("surveyId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const { surveyId, status } = parsed.data;
  const supabase = await createServerSupabase();

  const patch: Record<string, unknown> = { status };
  if (status === "active") {
    patch.published_at = new Date().toISOString();
    patch.closed_at = null;
    // Freeze content the moment a survey goes live.
    patch.is_locked = true;
  }
  if (status === "closed") patch.closed_at = new Date().toISOString();

  const { error } = await supabase.from("surveys").update(patch).eq("id", surveyId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/surveys");
  revalidatePath("/admin");

  return {
    ok: true,
    message:
      status === "active"
        ? "Survey activated. Its content is now locked."
        : status === "closed"
          ? "Survey closed. Existing responses are untouched."
          : "Survey moved back to draft.",
  };
}

/* ------------------------------------------------------------------ *
 * Create a new survey from an existing one
 * ------------------------------------------------------------------ */

const createSchema = z.object({
  title: z.string().trim().min(3, "Give the survey a title.").max(200),
  slug: z
    .string()
    .trim()
    .min(3, "Give the survey a URL slug.")
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/u, "Use lowercase letters, numbers and hyphens only."),
  templateSurveyId: z.string().uuid("Choose a survey to copy the questions from."),
  description: z.string().trim().max(4000).optional(),
});

/**
 * Creates a NEW survey row and copies the chosen survey's sections and questions
 * into it. The source survey is never modified, so historical submissions stay
 * attached to the instrument they were answered on.
 *
 * The copy starts as a DRAFT, so content can still be adjusted before it is
 * activated (activation locks it).
 */
export async function createSurveyFromTemplate(formData: FormData): Promise<ActionResult> {
  const { session, error: authError } = await requireManagerOrFail();
  if (authError || !session) return { ok: false, error: authError ?? "Not authorised." };

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    templateSurveyId: formData.get("templateSurveyId"),
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const { title, slug, templateSurveyId, description } = parsed.data;
  const supabase = await createServerSupabase();

  /* ---- Load the template content ---- */
  const [{ data: template }, { data: sectionRows }, { data: questionRows }] = await Promise.all([
    supabase.from("surveys").select("*").eq("id", templateSurveyId).maybeSingle(),
    supabase
      .from("survey_sections")
      .select("*")
      .eq("survey_id", templateSurveyId)
      .order("order_index"),
    supabase
      .from("questions")
      .select("*")
      .eq("survey_id", templateSurveyId)
      .order("order_index"),
  ]);

  if (!template) return { ok: false, error: "The survey you chose to copy no longer exists." };

  const sections = (sectionRows ?? []) as SurveySectionRow[];
  const questions = (questionRows ?? []) as QuestionRow[];

  if (questions.length === 0) {
    return { ok: false, error: "That survey has no questions to copy." };
  }

  /* ---- Create the new survey ---- */
  const { data: created, error: createError } = await supabase
    .from("surveys")
    .insert({
      slug,
      title,
      description: description || template.description,
      confirmation_message: template.confirmation_message,
      source_url: template.source_url,
      collects_email: template.collects_email,
      email_required: template.email_required,
      status: "draft",
      version: (template.version ?? 1) + 1,
      is_locked: false,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (createError) {
    if (createError.code === "23505") {
      return { ok: false, error: `The slug "${slug}" is already in use. Choose another.` };
    }
    return { ok: false, error: createError.message };
  }

  /* ---- Copy sections, remembering the old -> new id mapping ---- */
  const sectionIdMap = new Map<string, string>();

  if (sections.length > 0) {
    const { data: newSections, error: sectionError } = await supabase
      .from("survey_sections")
      .insert(
        sections.map((s) => ({
          survey_id: created.id,
          order_index: s.order_index,
          title: s.title,
          description: s.description,
          short_label: s.short_label,
          plain_title: s.plain_title,
        })),
      )
      .select("id, order_index");

    if (sectionError) {
      // Roll back so a half-built survey is never left behind.
      await supabase.from("surveys").delete().eq("id", created.id);
      return { ok: false, error: `Could not copy sections: ${sectionError.message}` };
    }

    const byOrder = new Map(
      (newSections ?? []).map((s) => [s.order_index as number, s.id as string]),
    );
    for (const old of sections) {
      const newId = byOrder.get(old.order_index);
      if (newId) sectionIdMap.set(old.id, newId);
    }
  }

  /* ---- Copy questions, preserving wording, options, order and entry ids ---- */
  const { error: questionError } = await supabase.from("questions").insert(
    questions.map((q) => ({
      survey_id: created.id,
      section_id: q.section_id ? (sectionIdMap.get(q.section_id) ?? null) : null,
      entry_id: q.entry_id,
      order_index: q.order_index,
      title: q.title,
      description: q.description,
      type: q.type,
      options: q.options,
      is_required: q.is_required,
    })),
  );

  if (questionError) {
    await supabase.from("surveys").delete().eq("id", created.id);
    return { ok: false, error: `Could not copy questions: ${questionError.message}` };
  }

  revalidatePath("/admin/surveys");

  return {
    ok: true,
    message: `Created "${title}" as a draft with ${questions.length} questions copied. Activate it when you are ready.`,
  };
}

/* ------------------------------------------------------------------ *
 * Edit a draft survey's wrapper text
 * ------------------------------------------------------------------ */

const editSchema = z.object({
  surveyId: z.string().uuid(),
  title: z.string().trim().min(3, "Give the survey a title.").max(200),
  description: z.string().trim().max(4000).optional(),
  confirmationMessage: z.string().trim().max(2000).optional(),
});

/**
 * Edits a DRAFT survey's title / intro / confirmation message.
 * The database refuses this once the survey has responses or is locked.
 */
export async function updateDraftSurvey(formData: FormData): Promise<ActionResult> {
  const { error: authError } = await requireManagerOrFail();
  if (authError) return { ok: false, error: authError };

  const parsed = editSchema.safeParse({
    surveyId: formData.get("surveyId"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    confirmationMessage: formData.get("confirmationMessage") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const { surveyId, title, description, confirmationMessage } = parsed.data;
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("surveys")
    .update({
      title,
      description: description || null,
      confirmation_message: confirmationMessage || null,
    })
    .eq("id", surveyId);

  if (error) {
    // The immutability trigger raises a check_violation with a clear message.
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/surveys");
  return { ok: true, message: "Draft updated." };
}

/* ------------------------------------------------------------------ *
 * Add a question without changing existing questions or saved answers
 * ------------------------------------------------------------------ */

const addQuestionSchema = z.object({
  surveyId: z.string().uuid(),
  title: z.string().trim().min(3, "Write a question.").max(500),
  description: z.string().trim().max(1000).optional(),
  type: z.enum(["multiple_choice", "paragraph"]),
  required: z.enum(["true", "false"]),
  options: z.string().optional(),
});

export async function addSurveyQuestion(formData: FormData): Promise<ActionResult> {
  const { error: authError } = await requireManagerOrFail();
  if (authError) return { ok: false, error: authError };

  const parsed = addQuestionSchema.safeParse({
    surveyId: formData.get("surveyId"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    type: formData.get("type"),
    required: formData.get("required"),
    options: formData.get("options") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid question." };

  const { surveyId, title, description, type, required } = parsed.data;
  const options = (parsed.data.options ?? "")
    .split(/\r?\n/u)
    .map((option) => option.trim())
    .filter(Boolean);
  if (type === "multiple_choice" && options.length < 2) {
    return { ok: false, error: "Add at least two answer options, one per line." };
  }
  if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) {
    return { ok: false, error: "Each answer option must be unique." };
  }
  if (options.some((option) => option.length > 300)) {
    return { ok: false, error: "Keep each answer option under 300 characters." };
  }

  const supabase = await createServerSupabase();
  const { data: existing, error: loadError } = await supabase
    .from("questions")
    .select("entry_id, order_index")
    .eq("survey_id", surveyId);
  if (loadError || !existing) return { ok: false, error: loadError?.message ?? "Questions could not be loaded." };

  const entryId = Math.max(...existing.map((question) => Number(question.entry_id)), 0) + 1;
  const orderIndex = Math.max(...existing.map((question) => Number(question.order_index)), 0) + 1;
  const { error } = await supabase.from("questions").insert({
    survey_id: surveyId,
    section_id: null,
    entry_id: entryId,
    order_index: orderIndex,
    title,
    description: description || null,
    type,
    options: type === "multiple_choice" ? options : null,
    is_required: required === "true",
    // Flags this as admin-added, which is what makes it removable later.
    // Seeded questions are is_custom = false and can never be deleted.
    is_custom: true,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/surveys");
  revalidatePath("/survey");
  revalidatePath("/admin");
  return { ok: true, message: "Question added to the application." };
}

/* ------------------------------------------------------------------ *
 * Form-action wrappers
 * ------------------------------------------------------------------ */

/**
 * React form `action` props must resolve to void. These thin wrappers let a
 * plain <form action={...}> call an action that normally returns a result,
 * for the cases where the page just revalidates rather than showing a message.
 */
export async function openApplicationsAction(formData: FormData): Promise<void> {
  await setSurveyStatus(formData);
}

/* ------------------------------------------------------------------ *
 * Remove an admin-added question
 * ------------------------------------------------------------------ */

const removeQuestionSchema = z.object({
  surveyId: z.string().uuid(),
  entryId: z.coerce.number().int(),
});

/**
 * Deletes a question an administrator added.
 *
 * Refuses, in order:
 *   - a question seeded from the verified source form (never deletable)
 *   - a question that already has answers (deleting would lose them)
 *
 * The same two rules are enforced independently by a database trigger, so a
 * mistake here cannot destroy content.
 */
export async function removeSurveyQuestion(formData: FormData): Promise<ActionResult> {
  const { error: authError } = await requireManagerOrFail();
  if (authError) return { ok: false, error: authError };

  const parsed = removeQuestionSchema.safeParse({
    surveyId: formData.get("surveyId"),
    entryId: formData.get("entryId"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const { surveyId, entryId } = parsed.data;
  const supabase = await createServerSupabase();

  const { data: question } = await supabase
    .from("questions")
    .select("id, title, is_custom")
    .eq("survey_id", surveyId)
    .eq("entry_id", entryId)
    .maybeSingle();

  if (!question) return { ok: false, error: "That question no longer exists." };

  if (!question.is_custom) {
    return {
      ok: false,
      error:
        "That question comes from the verified PLP form and cannot be removed. Only questions added here can be deleted.",
    };
  }

  const { count } = await supabase
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("question_id", question.id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `"${question.title}" already has ${count} answer(s), so it cannot be removed.`,
    };
  }

  const { error } = await supabase.from("questions").delete().eq("id", question.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/surveys");
  revalidatePath("/survey");
  revalidatePath("/admin");

  return { ok: true, message: `Removed "${question.title}" from the application.` };
}

/* ------------------------------------------------------------------ *
 * Edit an admin-added question
 * ------------------------------------------------------------------ */

const editQuestionSchema = addQuestionSchema.extend({
  entryId: z.coerce.number().int(),
});

/** Shared option parsing, so add and edit cannot validate differently. */
function parseOptions(
  raw: string | undefined,
  type: "multiple_choice" | "paragraph",
): { options: string[] } | { error: string } {
  const options = (raw ?? "")
    .split(/\r?\n/u)
    .map((option) => option.trim())
    .filter(Boolean);

  if (type === "multiple_choice") {
    if (options.length < 2) return { error: "Add at least two answer options, one per line." };
    if (new Set(options.map((o) => o.toLocaleLowerCase())).size !== options.length) {
      return { error: "Each answer option must be unique." };
    }
    if (options.some((o) => o.length > 300)) {
      return { error: "Keep each answer option under 300 characters." };
    }
  }
  return { options };
}

/**
 * Edits a question an administrator added.
 *
 * Refuses a question that came from the verified source form, and one that
 * already has answers — changing the wording under an existing answer would
 * silently change what that answer meant. Both rules are also enforced by a
 * database trigger.
 */
export async function updateSurveyQuestion(formData: FormData): Promise<ActionResult> {
  const { error: authError } = await requireManagerOrFail();
  if (authError) return { ok: false, error: authError };

  const parsed = editQuestionSchema.safeParse({
    surveyId: formData.get("surveyId"),
    entryId: formData.get("entryId"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    type: formData.get("type"),
    required: formData.get("required"),
    options: formData.get("options") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid question." };
  }

  const { surveyId, entryId, title, description, type, required } = parsed.data;

  const result = parseOptions(parsed.data.options, type);
  if ("error" in result) return { ok: false, error: result.error };

  const supabase = await createServerSupabase();

  const { data: question } = await supabase
    .from("questions")
    .select("id, title, is_custom")
    .eq("survey_id", surveyId)
    .eq("entry_id", entryId)
    .maybeSingle();

  if (!question) return { ok: false, error: "That question no longer exists." };

  if (!question.is_custom) {
    return {
      ok: false,
      error:
        "That question comes from the verified PLP form and cannot be edited. Only questions added here can be changed.",
    };
  }

  const { count } = await supabase
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("question_id", question.id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `"${question.title}" already has ${count} answer(s), so its wording can no longer be changed.`,
    };
  }

  const { error } = await supabase
    .from("questions")
    .update({
      title,
      description: description || null,
      type,
      options: type === "multiple_choice" ? result.options : null,
      is_required: required === "true",
    })
    .eq("id", question.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/surveys");
  revalidatePath("/survey");
  revalidatePath("/admin");

  return { ok: true, message: `Updated "${title}".` };
}

/* ------------------------------------------------------------------ *
 * Open / close applications
 * ------------------------------------------------------------------ */

/**
 * Flips the live survey between accepting and not accepting submissions.
 * Content stays locked either way; only the status changes.
 */
export async function toggleApplications(formData: FormData): Promise<ActionResult> {
  const { error: authError } = await requireManagerOrFail();
  if (authError) return { ok: false, error: authError };

  const surveyId = String(formData.get("surveyId") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!surveyId || (next !== "active" && next !== "closed")) {
    return { ok: false, error: "Invalid request." };
  }

  const patch = new FormData();
  patch.set("surveyId", surveyId);
  patch.set("status", next);

  const result = await setSurveyStatus(patch);
  if (!result.ok) return result;

  revalidatePath("/admin");
  revalidatePath("/survey");
  revalidatePath("/");

  return {
    ok: true,
    message:
      next === "active"
        ? "Applications are open. Students can submit from now on."
        : "Applications are closed. Submissions already received are untouched.",
  };
}
