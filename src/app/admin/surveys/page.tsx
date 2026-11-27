import type { Metadata } from "next";
import { FileStack, TriangleAlert } from "lucide-react";
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
  const questionResult = live ? await listManagedQuestions(live.id) : null;

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

      {live && questionResult && (
        <div className="mt-6">
          {questionResult.ok ? (
            <QuestionManager
              surveyId={live.id}
              questions={questionResult.questions}
              canManage={session.canManage}
              actions={{ add: addSurveyQuestion, remove: removeSurveyQuestion }}
            />
          ) : (
            /* Say what is missing rather than hiding the panel. */
            <Panel
              title="Question management is not set up yet"
              description={
                questionResult.reason === "needs_migration"
                  ? "One migration has not been applied to this database."
                  : "The questions could not be loaded."
              }
            >
              <div className="flex items-start gap-3 rounded-2xl border border-accent-400/40 bg-accent-100/40 p-4 sm:p-5">
                <TriangleAlert
                  className="mt-0.5 size-5 shrink-0 text-accent-600"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
                    {questionResult.message}
                  </p>
                  {questionResult.reason === "needs_migration" && (
                    <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-muted">
                      Open the Supabase SQL Editor and run that file. Adding and removing
                      questions will appear here straight afterwards. Nothing else is affected
                      in the meantime.
                    </p>
                  )}
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
