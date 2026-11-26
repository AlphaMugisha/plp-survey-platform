const OPENS_AT = Date.parse("2026-11-27T00:00:00+02:00");
const CLOSES_AT = Date.parse("2027-01-07T23:59:00+02:00");

export type ApplicationWindowStatus = "upcoming" | "open" | "closed";

export function getApplicationWindowStatus(now = Date.now()): ApplicationWindowStatus {
  if (now < OPENS_AT) return "upcoming";
  if (now < CLOSES_AT) return "open";
  return "closed";
}
