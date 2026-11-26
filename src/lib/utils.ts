import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Accent-insensitive, case-insensitive key for searching (school names carry accents). */
export function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Token match that ignores case and accents, so a user typing "ecole secondaire"
 * finds "Ecole Secondaire …" and "Collège de l'Immaculée Conception" is reachable
 * by typing "college immaculee".
 */
export function matchesSearch(haystack: string, needle: string): boolean {
  const n = searchKey(needle);
  if (!n) return true;
  const h = searchKey(haystack);
  // every whitespace-separated token must appear somewhere in the name
  return n.split(/\s+/u).every((token) => h.includes(token));
}

export function formatDateTime(value: string | Date, locale = "en-GB"): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatDate(value: string | Date, locale = "en-GB"): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return n === 1 ? singular : plural;
}

/** Truncate for table cells without cutting mid-word where avoidable. */
export function truncate(value: string, max = 90): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
