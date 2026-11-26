/**
 * CSV generation.
 *
 * Values are quoted and internal quotes doubled, so answers containing commas,
 * quotes, newlines or a leading "=" survive intact and cannot break the row
 * structure or be interpreted as a spreadsheet formula.
 */

/** Escape one CSV field. */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);

  // Neutralise spreadsheet formula injection while keeping the original text
  // readable: a leading =, +, - or @ is prefixed with a tab inside the quotes.
  const guarded = /^[=+\-@\t\r]/u.test(text) ? `\t${text}` : text;

  return `"${guarded.replace(/"/gu, '""')}"`;
}

export function csvRow(values: Array<string | number | null | undefined>): string {
  return values.map(csvField).join(",");
}

/**
 * Build a complete CSV document.
 * CRLF line endings and a UTF-8 BOM keep Excel happy with accented school names.
 */
export function buildCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  { bom = true }: { bom?: boolean } = {},
): string {
  const lines = [csvRow(headers), ...rows.map(csvRow)];
  return `${bom ? "﻿" : ""}${lines.join("\r\n")}\r\n`;
}

/** Safe, dated filename. */
export function csvFilename(prefix: string, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  const safe = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
  return `${safe}-${stamp}.csv`;
}
