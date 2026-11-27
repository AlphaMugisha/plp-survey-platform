import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import {
  allQuestions,
  sourceQuestions,
  BASELINE_SURVEY_SLUG,
  fieldKeyFor,
  type Question,
} from "./source";

/**
 * The questions applicants are asked: the source questions this deployment
 * declares it asks (see `overrides.questions` in data/deployment.json), plus
 * every question an admin has added in the dashboard.
 *
 * Source rows the deployment withholds are ignored even though they are still
 * in the database, so pruning the form is a declaration rather than a delete.
 */
export async function getApplicationQuestions(): Promise<Question[]> {
  if (!isServiceRoleConfigured()) return [];

  const supabase = createAdminClient();
  const { data: survey } = await supabase
    .from("surveys")
    .select("id")
    .eq("slug", BASELINE_SURVEY_SLUG)
    .maybeSingle();
  if (!survey) return [];

  const { data: rows, error } = await supabase
    .from("questions")
    .select("entry_id, order_index, title, description, type, options, is_required")
    .eq("survey_id", survey.id)
    .order("order_index");
  if (error || !rows) return [];

  // `allQuestions` is already narrowed to what this deployment asks, so a
  // withheld source row simply never matches and is dropped.
  const sourceIds = new Set(sourceQuestions.map((question) => question.entry_id));
  const askedById = new Map(allQuestions.map((question) => [question.entry_id, question]));
  const present = new Set(rows.map((row) => Number(row.entry_id)));
  const asked = allQuestions.filter((question) => present.has(question.entry_id));

  const custom: Question[] = rows.flatMap((row) => {
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

  // If a question this deployment asks is missing from the database, the seed
  // is incomplete. Fall back to the declared set rather than quietly dropping
  // the applicant's name or year level from the form.
  const identity = asked.length === askedById.size ? asked : allQuestions;

  return [...identity, ...custom].sort((a, b) => a.index - b.index);
}
