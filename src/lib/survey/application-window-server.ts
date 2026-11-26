import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/config";
import { BASELINE_SURVEY_SLUG } from "@/lib/survey/source";
import { getApplicationWindowStatus, type ApplicationWindowStatus } from "./application-window";

/** Resolve the public message and preview state against the live survey status. */
export async function getApplicationAvailability(): Promise<ApplicationWindowStatus> {
  const scheduledStatus = getApplicationWindowStatus();
  if (!isServiceRoleConfigured()) return scheduledStatus;

  const { data, error } = await createAdminClient()
    .from("surveys")
    .select("status")
    .eq("slug", BASELINE_SURVEY_SLUG)
    .maybeSingle();

  if (error || !data) return scheduledStatus;
  if (scheduledStatus === "closed" || data.status === "closed") return "closed";
  if (data.status === "active") return "open";
  return "upcoming";
}
