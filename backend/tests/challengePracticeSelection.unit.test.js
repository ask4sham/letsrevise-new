/**
 * Higher Tier Challenge Questions V1 — pure selection heuristic unit tests.
 */
const {
  isStrongChallengeQuestion,
  challengeRankScore,
  selectChallengePracticeItems,
} = require("../services/generatePracticeSet");

describe("challenge practice selection", () => {
  test("difficulty >= 4 is a strong challenge match and ranks above easy", () => {
    const hard = { difficulty: 5, marks: 1, question: "Name the organelle." };
    const easy = { difficulty: 1, marks: 1, question: "Name the organelle." };
    expect(isStrongChallengeQuestion(hard)).toBe(true);
    expect(isStrongChallengeQuestion(easy)).toBe(false);
    expect(challengeRankScore(hard)).toBeGreaterThan(challengeRankScore(easy));
  });

  test("marks >= 4 is a strong challenge match (fallback signal)", () => {
    const long = { difficulty: 2, marks: 6, question: "Describe the process." };
    const short = { difficulty: 2, marks: 1, question: "Describe the process." };
    expect(isStrongChallengeQuestion(long)).toBe(true);
    expect(isStrongChallengeQuestion(short)).toBe(false);
  });

  test("command words evaluate/analyse/compare/justify/explain qualify", () => {
    expect(isStrongChallengeQuestion({ question: "Evaluate the method used." })).toBe(true);
    expect(isStrongChallengeQuestion({ question: "Analyse the results." })).toBe(true);
    expect(isStrongChallengeQuestion({ question: "Compare X and Y." })).toBe(true);
    expect(isStrongChallengeQuestion({ question: "Justify your conclusion." })).toBe(true);
    expect(isStrongChallengeQuestion({ question: "Explain why diffusion is important." })).toBe(true);
    expect(isStrongChallengeQuestion({ question: "State the definition of osmosis." })).toBe(false);
  });

  test("analysis / exam-technique skills qualify", () => {
    expect(isStrongChallengeQuestion({ skill: "analysis", question: "Q" })).toBe(true);
    expect(isStrongChallengeQuestion({ skill: "exam-technique", question: "Q" })).toBe(true);
    expect(isStrongChallengeQuestion({ skill: "recall", question: "Q" })).toBe(false);
  });

  test("selectChallengePracticeItems prefers difficulty 4–5 before easy", () => {
    const raw = [
      { contentId: "e1", row: { difficulty: 1, marks: 1, question: "Easy 1" } },
      { contentId: "h1", row: { difficulty: 5, marks: 2, question: "Hard 1" } },
      { contentId: "e2", row: { difficulty: 2, marks: 1, question: "Easy 2" } },
      { contentId: "h2", row: { difficulty: 4, marks: 3, question: "Hard 2" } },
    ];
    const selected = selectChallengePracticeItems(raw, 2);
    expect(selected.map((x) => x.contentId)).toEqual(["h1", "h2"]);
  });

  test("fallback returns highest available when no strong challenge matches", () => {
    const raw = [
      { contentId: "a", row: { difficulty: 1, marks: 1, question: "State X" } },
      { contentId: "b", row: { difficulty: 3, marks: 2, question: "Describe Y" } },
      { contentId: "c", row: { difficulty: 2, marks: 1, question: "Name Z" } },
    ];
    const selected = selectChallengePracticeItems(raw, 2);
    expect(selected.length).toBe(2);
    expect(selected[0].contentId).toBe("b");
    expect(selected.map((x) => x.contentId)).not.toContain("a");
  });

  test("never returns empty when topic questions exist", () => {
    const raw = [{ contentId: "only", row: { difficulty: 1, marks: 1, question: "State X" } }];
    expect(selectChallengePracticeItems(raw, 10)).toHaveLength(1);
  });
});
