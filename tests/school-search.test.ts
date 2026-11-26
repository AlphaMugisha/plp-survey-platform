/**
 * School search behaviour. Search must be forgiving about accents and casing
 * while the stored value stays byte-identical to the original list.
 */
import { describe, expect, it } from "vitest";
import { matchesSearch, searchKey } from "@/lib/utils";
import { schools } from "@/lib/survey/source";

function find(query: string): string[] {
  return schools.filter((name) => matchesSearch(name, query));
}

describe("searchKey", () => {
  it("strips accents and lowercases", () => {
    expect(searchKey("Collège de l'Immaculée Conception")).toBe(
      "college de l'immaculee conception",
    );
    expect(searchKey("Groupe Scolaire Mère Du Verbe kibeho")).toBe(
      "groupe scolaire mere du verbe kibeho",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(searchKey("  Lycee  ")).toBe("lycee");
  });
});

describe("school search", () => {
  it("returns every school for an empty query", () => {
    expect(find("")).toHaveLength(180);
    expect(find("   ")).toHaveLength(180);
  });

  it("finds an accented name when typed without accents", () => {
    const results = find("college immaculee");
    expect(results).toContain("Collège de l'Immaculée Conception");
  });

  it("finds an accented name when typed with accents", () => {
    expect(find("Immaculée")).toContain("Collège de l'Immaculée Conception");
  });

  it("is case-insensitive in both directions", () => {
    expect(find("college de la paix")).toContain("COLLEGE DE LA PAIX");
    expect(find("GREEN HILLS")).toContain("Green Hills Academy");
  });

  it("matches tokens in any order", () => {
    expect(find("academy gashora")).toContain("Gashora Girls Academy");
    expect(find("gashora academy")).toContain("Gashora Girls Academy");
  });

  it("requires every token to appear", () => {
    expect(find("gashora nonexistenttoken")).toHaveLength(0);
  });

  it("narrows as the query grows", () => {
    const broad = find("ecole").length;
    const narrow = find("ecole secondaire").length;
    expect(broad).toBeGreaterThan(narrow);
    expect(narrow).toBeGreaterThan(0);
  });

  it("finds schools with punctuation in their names", () => {
    expect(find("G.S RAMBURA")).toContain("G.S RAMBURA (F)");
    expect(find("E.S Kabarondo")).toContain("E.S Kabarondo");
  });

  it("returns an empty list rather than throwing for nonsense", () => {
    expect(find("zzzzqqqq")).toEqual([]);
  });

  it("never alters the returned names", () => {
    for (const name of find("ecole")) {
      expect(schools).toContain(name);
    }
  });
});
