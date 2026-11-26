/**
 * Static analysis of the schema's PL/pgSQL, catching errors that would only
 * surface when the migration is actually run against Postgres.
 *
 * The motivating bug: a single trigger function served `surveys` (which has
 * `id`) and `survey_sections`/`questions` (which have `survey_id`). PL/pgSQL
 * resolves every field reference against the real record type, so it failed
 * with `record "new" has no field "survey_id"` — even though the reference sat
 * in a CASE branch that would never be taken for that table.
 *
 * These tests parse the migration and verify every `new.<field>` / `old.<field>`
 * a trigger function uses actually exists on every table that trigger is
 * attached to.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const schemaSql = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260101000100_schema.sql"),
  "utf8",
);

/* ------------------------------------------------------------------ *
 * Parsing helpers
 * ------------------------------------------------------------------ */

/** Slice from `openIndex` (at a "(") to its matching ")". */
function balanced(sql: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < sql.length; i += 1) {
    if (sql[i] === "(") depth += 1;
    else if (sql[i] === ")") {
      depth -= 1;
      if (depth === 0) return sql.slice(openIndex, i + 1);
    }
  }
  return sql.slice(openIndex);
}

/** table name -> set of column names */
function parseTables(sql: string): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();

  for (const match of sql.matchAll(
    /create table if not exists public\.(\w+)\s*\(/giu,
  )) {
    const name = match[1]!;
    const body = balanced(sql, match.index! + match[0].length - 1).slice(1, -1);

    const columns = new Set<string>();
    const NON_COLUMN = ["constraint", "primary", "unique", "foreign", "check", "exclude"];

    // Walk line by line, tracking paren depth so the inner lines of a
    // multi-line CHECK body are never mistaken for column definitions.
    let depth = 0;
    for (const rawLine of body.split("\n")) {
      const startedAtTopLevel = depth === 0;

      for (const ch of rawLine) {
        if (ch === "(") depth += 1;
        else if (ch === ")") depth -= 1;
      }

      if (!startedAtTopLevel) continue;

      const line = rawLine.trim();
      if (!line || line.startsWith("--")) continue;

      const [first, ...rest] = line.split(/\s+/u);
      const colName = first?.toLowerCase() ?? "";

      // A column definition is `identifier <type> ...` at the top level.
      if (!/^[a-z_][a-z0-9_]*$/u.test(colName)) continue;
      if (NON_COLUMN.includes(colName)) continue;
      if (rest.length === 0) continue;

      columns.add(colName);
    }

    tables.set(name, columns);
  }

  return tables;
}

/** function name -> body text */
function parseFunctions(sql: string): Map<string, string> {
  const functions = new Map<string, string>();
  for (const match of sql.matchAll(
    /create or replace function public\.(\w+)\s*\([^)]*\)([\s\S]*?)\$\$;/giu,
  )) {
    functions.set(match[1]!, match[2]!);
  }
  return functions;
}

/** trigger name -> { table, fn } */
function parseTriggers(sql: string): Array<{ name: string; table: string; fn: string }> {
  const triggers: Array<{ name: string; table: string; fn: string }> = [];
  for (const match of sql.matchAll(
    /create trigger (\w+)[\s\S]*?on public\.(\w+)[\s\S]*?execute function public\.(\w+)\(\);/giu,
  )) {
    triggers.push({ name: match[1]!, table: match[2]!, fn: match[3]! });
  }
  return triggers;
}

const tables = parseTables(schemaSql);
const functions = parseFunctions(schemaSql);
const triggers = parseTriggers(schemaSql);

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

describe("schema parsing sanity", () => {
  it("finds the seven tables", () => {
    expect([...tables.keys()].sort()).toEqual([
      "admin_profiles",
      "answers",
      "questions",
      "schools",
      "survey_responses",
      "survey_sections",
      "surveys",
    ]);
  });

  it("finds the expected columns on the tables the guards use", () => {
    expect(tables.get("surveys")).toContain("id");
    expect(tables.get("surveys")).toContain("is_locked");
    expect(tables.get("survey_sections")).toContain("survey_id");
    expect(tables.get("questions")).toContain("survey_id");
    expect(tables.get("answers")).toContain("question_id");
  });

  it("finds every trigger and its function", () => {
    expect(triggers.length).toBeGreaterThanOrEqual(6);
    for (const trigger of triggers) {
      expect(functions.has(trigger.fn), `function ${trigger.fn} should be defined`).toBe(
        true,
      );
      expect(tables.has(trigger.table), `table ${trigger.table} should exist`).toBe(true);
    }
  });
});

describe("trigger functions only reference fields that exist", () => {
  it.each(triggers.map((t) => [t.name, t] as const))(
    "%s uses only real columns",
    (_name, trigger) => {
      const body = functions.get(trigger.fn) ?? "";
      const columns = tables.get(trigger.table)!;

      const referenced = new Set<string>();
      for (const match of body.matchAll(/\b(?:new|old)\.(\w+)/giu)) {
        referenced.add(match[1]!.toLowerCase());
      }

      const missing = [...referenced].filter((field) => !columns.has(field));

      expect(
        missing,
        `${trigger.fn}() is attached to public.${trigger.table}, which has no column(s): ` +
          `${missing.join(", ")}. PL/pgSQL resolves NEW/OLD against the real record type, ` +
          `so this fails at runtime with 'record "new" has no field ...' — even inside a ` +
          `CASE or IF branch that is never taken for this table.`,
      ).toEqual([]);
    },
  );
});

describe("PL/pgSQL record-variable safety", () => {
  it("never reads OLD in an INSERT-only trigger or NEW in a DELETE-only trigger", () => {
    // Our triggers are multi-event, so the functions must branch on TG_OP
    // before touching a record that may be unassigned.
    for (const trigger of triggers) {
      const statement = schemaSql.slice(
        schemaSql.indexOf(`create trigger ${trigger.name}`),
      );
      const events = statement.slice(0, statement.indexOf(";")).toLowerCase();
      const body = functions.get(trigger.fn) ?? "";

      const handlesDelete = events.includes("delete");
      const usesOld = /\bold\./iu.test(body);
      const usesNew = /\bnew\./iu.test(body);

      if (handlesDelete && usesNew) {
        expect(
          /tg_op\s*=\s*'DELETE'/iu.test(body),
          `${trigger.fn}() handles DELETE and reads NEW, so it must branch on TG_OP`,
        ).toBe(true);
      }

      if (events.includes("insert") && usesOld) {
        expect(
          /tg_op/iu.test(body),
          `${trigger.fn}() handles INSERT and reads OLD, so it must branch on TG_OP`,
        ).toBe(true);
      }
    }
  });

  it("pins search_path on every function, including the trigger functions", () => {
    for (const [name, body] of functions) {
      expect(body, `public.${name}() should pin search_path`).toContain(
        "set search_path = ''",
      );
    }
  });
});
