import type { Metadata } from "next";
import { FileStack } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/admin/ui";
import { SurveyManager } from "@/components/admin/survey-manager";
import { QuestionManager } from "@/components/admin/question-manager";
import { SetupNotice } from "@/components/site/setup-notice";
import { requireAdmin } from "@/lib/admin/auth";
import { listManagedQuestions, listSurveys } from "@/lib/admin/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  addSurveyQuestion,
  createSurveyFromTemplate,
  removeSurveyQuestion,
  setSurveyStatus,
  updateDraftSurvey,
} from "./actions";

export const metadata: Metadata = { title: "Surveys" };

export default async function SurveysPage() {
  const session = await requireAdmin();

  if (!isSupabaseConfigured()) {
    return (
      <>
        <PageHeader eyebrow="Dashboard" title="Surveys" />
        <SetupNotice context="read" />
      </>
    );
  }

  const surveys = await listSurveys();

  // The live application is the survey students are filling in, so that is the
  // one whose questions can be managed here.
  const live = surveys.find((s) => s.status === "active") ?? surveys[0];
  const managedQuestions = live ? await listManagedQuestions(live.id) : [];

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Survey management"
        description="Activate, close and version surveys. A survey that has responses is immutable — the next term's survey is a new copy, so historical submissions are preserved."
      />

      {surveys.length === 0 ? (
        <Panel title="No surveys" bodyClassName="p-0">
          <EmptyState
            icon={<FileStack className="size-5" />}
            title="No surveys have been seeded"
            description="Run the migrations in supabase/migrations (0001 to 0005) against your Supabase project to create and seed the baseline survey."
          />
        </Panel>
      ) : (
        <SurveyManager
          surveys={surveys}
          canManage={session.canManage}
          actions={{
            setStatus: setSurveyStatus,
            create: createSurveyFromTemplate,
            updateDraft: updateDraftSurvey,
          }}
        />
      )}

      {live && managedQuestions.length > 0 && (
        <div className="mt-6">
          <QuestionManager
            surveyId={live.id}
            questions={managedQuestions}
            canManage={session.canManage}
            actions={{ add: addSurveyQuestion, remove: removeSurveyQuestion }}
          />
        </div>
      )}
    </>
  );
}
