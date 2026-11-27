import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import { allQuestions, BASELINE_SURVEY_SLUG, fieldKeyFor, type Question } from "./source";

/** Return the verified source questions plus any questions the admin added. */
export async function getApplicationQuestions(): Promise<Question[]> {
  if (!isServiceRoleConfigured()) return allQuestions;

  const supabase = createAdminClient();
  const { data: survey } = await supabase
    .from("surveys")
    .select("id")
    .eq("slug", BASELINE_SURVEY_SLUG)
    .maybeSingle();
  if (!survey) return allQuestions;

  const { data: rows, error } = await supabase
    .from("questions")
    .select("entry_id, order_index, title, description, type, options, is_required")
    .eq("survey_id", survey.id)
    .order("order_index");
  if (error || !rows) return allQuestions;

  const sourceById = new Map(allQuestions.map((question) => [question.entry_id, question]));
  const databaseIds = new Set(rows.map((row) => Number(row.entry_id)));
  const loadedSource = allQuestions.filter((question) => databaseIds.has(question.entry_id));
  const custom: Question[] = rows.flatMap((row) => {
    const entryId = Number(row.entry_id);
    if (sourceById.has(entryId)) return [];
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

  // If the database is partially seeded, keep the original form usable while
  // including only valid, database-backed additions.
  const source = loadedSource.length === allQuestions.length ? loadedSource : allQuestions;
  return [...source, ...custom].sort((a, b) => a.index - b.index);
}
