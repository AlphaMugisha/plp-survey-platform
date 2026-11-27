import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import {
  allQuestions,
  sourceQuestions,
  BASELINE_SURVEY_SLUG,
  fieldKeyFor,
  type Question,
  type QuestionGroup,
} from "./source";

/**
 * The questions applicants are asked: the source questions this deployment
 * declares it asks (see `overrides.questions` in data/deployment.json), plus
 * every question an admin has added in the dashboard.
 *
 * Source rows the deployment withholds are ignored even though they are still
 * in the database, so pruning the form is a declaration rather than a delete.
 *
 * Admin-added questions carry their GROUP — the `survey_sections` row the
 * administrator put them in — so the form can lay itself out in parts rather
 * than as one long list.
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
    .select("entry_id, order_index, title, description, type, options, is_required, section_id")
    .eq("survey_id", survey.id)
    .order("order_index");
  if (error || !rows) return [];

  // Loaded separately rather than as a join, so that a database which has not
  // had the admin-sections migration applied still returns every question —
  // just ungrouped — instead of returning nothing.
  const groups = await loadGroups(supabase, survey.id);

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
    const sectionId = (row as { section_id?: string | null }).section_id ?? null;
    return [{
      index: Number(row.order_index),
      entry_id: entryId,
      type: row.type,
      title: row.title,
      description: row.description,
      required: row.is_required,
      options: Array.isArray(row.options) ? row.options : undefined,
      fieldKey: fieldKeyFor(entryId),
      group: sectionId ? groups.get(sectionId) ?? null : null,
    }];
  });

  // If a question this deployment asks is missing from the database, the seed
  // is incomplete. Fall back to the declared set rather than quietly dropping
  // the applicant's name or year level from the form.
  const identity = asked.length === askedById.size ? asked : allQuestions;

  return [...identity, ...custom].sort((a, b) => a.index - b.index);
}

/**
 * The administrator-created question groups, keyed by section id.
 *
 * Returns an empty map when `survey_sections.is_custom` does not exist yet
 * (it arrives with 20261127085000_admin_added_sections.sql), so an
 * un-migrated database shows an ungrouped form rather than no form at all.
 */
async function loadGroups(
  supabase: ReturnType<typeof createAdminClient>,
  surveyId: string,
): Promise<Map<string, QuestionGroup>> {
  const { data, error } = await supabase
    .from("survey_sections")
    .select("id, title, description, short_label, order_index")
    .eq("survey_id", surveyId)
    .eq("is_custom", true)
    .order("order_index");

  if (error || !data) return new Map();

  const rows = data as Array<{
    id: string;
    title: string;
    description: string | null;
    short_label: string | null;
    order_index: number;
  }>;

  return new Map(
    rows.map((row, i) => [
      row.id,
      {
        id: row.id,
        title: row.title,
        description: row.description,
        // Numbered 1..n for the progress rail, independent of where these
        // sections sit among the archived source sections.
        shortLabel: row.short_label ?? String(i + 1),
        order: i + 1,
      },
    ]),
  );
}
