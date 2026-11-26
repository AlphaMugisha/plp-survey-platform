/**
 * Hand-written database types matching supabase/migrations/0001_schema.sql.
 *
 * Kept deliberately small and explicit rather than generated, so the shape the
 * app relies on is reviewable in one place.
 */

export type SurveyStatus = "draft" | "active" | "closed";
export type DbQuestionType =
  | "short_answer"
  | "paragraph"
  | "multiple_choice"
  | "dropdown"
  | "section_header";
export type AdminRole = "owner" | "admin" | "viewer";

export type SchoolRow = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

export type SurveyRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  confirmation_message: string | null;
  source_url: string | null;
  collects_email: boolean;
  email_required: boolean;
  status: SurveyStatus;
  version: number;
  is_locked: boolean;
  published_at: string | null;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SurveySectionRow = {
  id: string;
  survey_id: string;
  order_index: number;
  title: string;
  description: string | null;
  short_label: string | null;
  plain_title: string | null;
  created_at: string;
};

export type QuestionRow = {
  id: string;
  survey_id: string;
  section_id: string | null;
  entry_id: number;
  order_index: number;
  title: string;
  description: string | null;
  type: DbQuestionType;
  options: string[] | null;
  is_required: boolean;
  created_at: string;
};

export type SurveyResponseRow = {
  id: string;
  survey_id: string;
  email: string;
  full_name: string;
  school_id: string | null;
  school_name: string;
  year_level: string;
  submitted_at: string;
  duration_seconds: number | null;
  ip_hash: string | null;
  user_agent: string | null;
};

export type AnswerRow = {
  id: string;
  response_id: string;
  question_id: string;
  entry_id: number;
  answer_text: string;
  created_at: string;
};

export type AdminProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminResponseOverviewRow = {
  id: string;
  survey_id: string;
  survey_slug: string;
  survey_title: string;
  email: string;
  full_name: string;
  school_name: string;
  year_level: string;
  submitted_at: string;
  duration_seconds: number | null;
  answer_count: number;
};
