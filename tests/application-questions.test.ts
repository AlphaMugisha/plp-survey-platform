/**
 * The PLP Ishami membership application.
 *
 * PLP supplied this questionnaire as 15 numbered questions across 5 parts, plus
 * a final family agreement. It was transcribed into
 * `data/application-questions.json` and the seed migration is GENERATED from
 * that file.
 *
 * What these tests hold in place:
 *   - the wording and every answer option, character for character
 *   - that the generated SQL still contains that same text, so the migration
 *     cannot drift from the reviewed JSON
 *   - that the form lays it out as the parts PLP wrote, one step each
 *   - that every question stays admin-editable
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stepsForQuestions } from "@/lib/survey/steps";
import { fieldKeyFor, sourceQuestions, type Question, type QuestionGroup } from "@/lib/survey/source";

type SeedQuestion = {
  entryId: number;
  type: "paragraph" | "short_answer" | "multiple_choice";
  title: string;
  required: boolean;
  options?: string[];
};

type SeedPart = {
  shortLabel: string;
  title: string;
  description: string | null;
  questions: SeedQuestion[];
};

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "data", "application-questions.json"), "utf8"),
) as { title: string; subtitle: string; epigraph: string; parts: SeedPart[] };

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261127090000_seed_plp_ishami_application.sql",
  ),
  "utf8",
);

const seedQuestions = seed.parts.flatMap((p) => p.questions);

/** The questions as the live loader would hand them over, groups attached. */
function asLiveQuestions(): Question[] {
  return seed.parts.flatMap((part, partIndex) => {
    const group: QuestionGroup = {
      id: `section-${partIndex + 1}`,
      title: part.title,
      description: part.description,
      shortLabel: part.shortLabel,
      order: partIndex + 1,
    };
    return part.questions.map((q) => ({
      index: q.entryId,
      entry_id: q.entryId,
      type: q.type,
      title: q.title,
      description: null,
      required: q.required,
      options: q.options,
      fieldKey: fieldKeyFor(q.entryId),
      group,
    }));
  });
}

/* ------------------------------------------------------------------ *
 * The content PLP supplied
 * ------------------------------------------------------------------ */

describe("the questionnaire as PLP wrote it", () => {
  it("has the six parts, named exactly", () => {
    expect(seed.parts.map((p) => p.title)).toEqual([
      "PART 1: GETTING TO KNOW YOU",
      "PART 2: YOUR PURPOSE & EXPECTATIONS",
      "PART 3: CHARACTER & RELATIONSHIPS",
      "PART 4: COMMITMENT & ACCOUNTABILITY",
      "PART 5: THE MEANING OF FAMILY",
      "FINAL FAMILY AGREEMENT",
    ]);
  });

  it("asks the 15 numbered questions, plus the follow-up and the signature block", () => {
    // 15 numbered + "If yes, briefly describe your experience." + Name/Signature/Date
    expect(seedQuestions).toHaveLength(19);
  });

  it("keeps every question's wording verbatim", () => {
    const titles = seedQuestions.map((q) => q.title);
    expect(titles).toEqual([
      "Full name, preferred name, and class:",
      "How would you describe your personality?",
      "What are your interests, talents, or passions?",
      "Have you been part of PLP before?",
      "If yes, briefly describe your experience.",
      "Why do you genuinely want to become part of the PLP family, and what do you hope to gain from it?",
      "What do you believe you can bring to this family that will make it better?",
      "When you disagree with someone, especially someone you are close to, how do you usually handle the situation?",
      "Imagine a member makes a mistake, shares an unpopular opinion, or struggles to fit in. How would you treat them?",
      "If you witnessed gossip, bullying, betrayal of trust, or intentional exclusion within PLP, what would you do?",
      "If someone trusted you with a personal struggle or secret, what would that trust mean to you, and how would you protect it?",
      "How would you balance your academic responsibilities with your commitment to PLP?",
      "If you make a commitment to the family but fail to fulfill it, what would you do?",
      "Are you willing to contribute even when you are not in a leadership position, receive no recognition, or are not directly benefiting?",
      'PLP believes: "Nobody gets left behind. Nobody gets intentionally pushed out." What does this statement mean to you, and how would you put it into practice?',
      "What kind of person do you want to become through PLP, and what personal change or contribution are you willing to commit to make this family stronger?",
      "Name:",
      "Signature:",
      "Date:",
    ]);
  });

  it("keeps every answer option verbatim, in the order given", () => {
    const options = Object.fromEntries(
      seedQuestions.filter((q) => q.options).map((q) => [q.title, q.options]),
    );

    expect(options["How would you describe your personality?"]).toEqual([
      "Introverted",
      "Extroverted",
      "Ambivert (a mixture of both)",
      "Other: __________",
    ]);

    expect(options["What are your interests, talents, or passions?"]).toEqual([
      "Leadership and public speaking",
      "Creativity and arts",
      "Sports and fitness",
      "Technology and innovation",
      "Volunteering and helping others",
      "Music and entertainment",
      "Other: __________",
    ]);

    expect(options["Have you been part of PLP before?"]).toEqual(["Yes", "No"]);

    expect(
      options[
        "When you disagree with someone, especially someone you are close to, how do you usually handle the situation?"
      ],
    ).toEqual([
      "Discuss the issue calmly and respectfully.",
      "Listen to understand their perspective.",
      "Take time to cool down before addressing it.",
      "Avoid the person or ignore the issue.",
      "Other: __________",
    ]);

    expect(
      options[
        "Imagine a member makes a mistake, shares an unpopular opinion, or struggles to fit in. How would you treat them?"
      ],
    ).toEqual([
      "Encourage and support them.",
      "Respect their differences and give them space.",
      "Help them improve without embarrassing them.",
      "Distance myself from them.",
      "Other: __________",
    ]);

    expect(
      options[
        "If you witnessed gossip, bullying, betrayal of trust, or intentional exclusion within PLP, what would you do?"
      ],
    ).toEqual([
      "Address the situation respectfully.",
      "Support the affected person.",
      "Report it to the coordinator or appropriate committee member.",
      "Stay silent to avoid involvement.",
      "Other: __________",
    ]);

    expect(
      options["How would you balance your academic responsibilities with your commitment to PLP?"],
    ).toEqual([
      "Plan and manage my time responsibly.",
      "Communicate when I have conflicting responsibilities.",
      "Participate whenever my schedule allows.",
      "I am still learning how to manage my time.",
    ]);

    expect(
      options["If you make a commitment to the family but fail to fulfill it, what would you do?"],
    ).toEqual([
      "Take responsibility and apologize.",
      "Explain the situation and find a solution.",
      "Wait for someone to remind me.",
      "Ignore it and move on.",
    ]);

    expect(
      options[
        "Are you willing to contribute even when you are not in a leadership position, receive no recognition, or are not directly benefiting?"
      ],
    ).toEqual([
      "Yes, absolutely.",
      "Yes, but I may need encouragement.",
      "Only when I have enough time.",
      "No, I prefer taking part when I benefit directly.",
    ]);
  });

  it("carries the family agreement text on the final part", () => {
    const agreement = seed.parts.at(-1)!;
    expect(agreement.title).toBe("FINAL FAMILY AGREEMENT");
    expect(agreement.description).toBe(
      "By joining PLP Ishami, I understand that being part of this family comes with " +
        "responsibilities, not just privileges.\n\nI agree to respect others, communicate " +
        "honestly, protect confidentiality, avoid bullying and gossip, participate actively, " +
        "take accountability for my actions, and contribute to creating a safe and supportive " +
        "environment.",
    );
  });

  it("asks only the follow-up optionally, since it depends on a 'Yes'", () => {
    const optional = seedQuestions.filter((q) => !q.required);
    expect(optional.map((q) => q.title)).toEqual([
      "If yes, briefly describe your experience.",
    ]);
  });

  it("uses entry ids that cannot collide with the verified Google Form", () => {
    const sourceIds = new Set(sourceQuestions.map((q) => q.entry_id));
    for (const q of seedQuestions) {
      expect(sourceIds.has(q.entryId), `entry ${q.entryId} collides with the source`).toBe(false);
    }
    // A collision would make the question be treated as a source row and
    // silently vanish from the form.
    const ids = seedQuestions.map((q) => q.entryId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/* ------------------------------------------------------------------ *
 * The generated migration
 * ------------------------------------------------------------------ */

describe("the seed migration matches the reviewed JSON", () => {
  it("contains every question title", () => {
    for (const q of seedQuestions) {
      // SQL doubles single quotes inside a literal.
      expect(sql, `missing: ${q.title}`).toContain(q.title.replace(/'/gu, "''"));
    }
  });

  it("contains every answer option", () => {
    for (const q of seedQuestions) {
      for (const option of q.options ?? []) {
        expect(sql, `missing option: ${option}`).toContain(option.replace(/'/gu, "''"));
      }
    }
  });

  it("contains every part title", () => {
    for (const part of seed.parts) {
      expect(sql).toContain(part.title.replace(/'/gu, "''"));
    }
  });

  it("stores newlines escaped rather than embedded, so no CR can creep in", () => {
    // The agreement is the only multi-line text; it must be written as \n.
    expect(sql).toContain("not just privileges.\\n\\nI agree to respect others");
    expect(sql).not.toMatch(/\r/u);
  });

  it("inserts every question as admin-editable", () => {
    // is_custom = true is what keeps edit and remove rights with the admin.
    const inserts = sql.match(/insert into public\.questions/gu) ?? [];
    expect(inserts).toHaveLength(seedQuestions.length);
    expect(sql).not.toMatch(/is_required, is_custom\)\s*values\s*\([^;]*, false\);/u);
  });

  it("refuses to replace a questionnaire that has answers", () => {
    expect(sql).toContain("if public.survey_has_responses(v_survey) then");
    expect(sql).toMatch(/refusing to replace its questions/iu);
  });

  it("leaves the archived source questions alone", () => {
    // Only is_custom rows are cleared, so the verified form stays in the
    // database as an archive.
    expect(sql).toContain("where survey_id = v_survey and is_custom = true;");
    expect(sql).not.toMatch(/delete from public\.questions\s*where survey_id = v_survey;/u);
  });

  it("restores the survey lock it has to lift", () => {
    expect(sql).toContain("update public.surveys set is_locked = false where id = v_survey;");
    expect(sql).toContain(
      "update public.surveys set is_locked = coalesce(v_locked, true) where id = v_survey;",
    );
  });
});

/* ------------------------------------------------------------------ *
 * How an applicant sees it
 * ------------------------------------------------------------------ */

describe("the form lays the questionnaire out in PLP's own parts", () => {
  const steps = stepsForQuestions(asLiveQuestions());

  it("is details, then one step per part, then review", () => {
    expect(steps).toHaveLength(8);
    expect(steps[0]!.kind).toBe("details");
    expect(steps.at(-1)!.kind).toBe("review");
    expect(steps.filter((s) => s.kind === "section")).toHaveLength(6);
  });

  it("heads each step with the part title, exactly", () => {
    const sectionSteps = steps.filter((s) => s.kind === "section");
    expect(sectionSteps.map((s) => s.title)).toEqual(seed.parts.map((p) => p.title));
  });

  it("shows the family agreement text on its step", () => {
    const agreement = steps.find((s) => s.title === "FINAL FAMILY AGREEMENT")!;
    expect(agreement.description).toBe(seed.parts.at(-1)!.description);
    expect(agreement.questions.map((q) => q.title)).toEqual(["Name:", "Signature:", "Date:"]);
  });

  it("asks every question exactly once, in the order PLP wrote them", () => {
    const asked = steps.flatMap((s) => s.questions.map((q) => q.title));
    expect(asked).toEqual(seedQuestions.map((q) => q.title));
    expect(new Set(asked).size).toBe(asked.length);
  });

  it("puts each part's questions under their own part and nowhere else", () => {
    for (const part of seed.parts) {
      const step = steps.find((s) => s.title === part.title)!;
      expect(step.questions.map((q) => q.title)).toEqual(part.questions.map((q) => q.title));
    }
  });

  it("keeps the follow-up immediately after the question it depends on", () => {
    const part2 = steps.find((s) => s.title === "PART 2: YOUR PURPOSE & EXPECTATIONS")!;
    const titles = part2.questions.map((q) => q.title);
    expect(titles.indexOf("If yes, briefly describe your experience.")).toBe(
      titles.indexOf("Have you been part of PLP before?") + 1,
    );
  });

  it("falls back to one trailing step for a question with no part", () => {
    const loose: Question = {
      index: 9000,
      entry_id: 9000,
      type: "paragraph",
      title: "Added later, not in a part",
      description: null,
      required: false,
      fieldKey: fieldKeyFor(9000),
      group: null,
    };
    const withLoose = stepsForQuestions([...asLiveQuestions(), loose]);

    // Still 6 parts, plus a step for the ungrouped one — never dropped.
    expect(withLoose.filter((s) => s.kind === "section")).toHaveLength(7);
    const last = withLoose.at(-2)!;
    expect(last.title).toBe("Additional questions");
    expect(last.questions.map((q) => q.title)).toEqual(["Added later, not in a part"]);
  });
});
