import { resolveShortAnswerModelAnswer } from "./gradeShortAnswer";

describe("resolveShortAnswerModelAnswer", () => {
  it("formats mark scheme as numbered model answer", () => {
    const out = resolveShortAnswerModelAnswer({
      markScheme: ["Point one.", "Point two."],
      correctAnswer: "stale",
    });
    expect(out).toBe("1. Point one.\n2. Point two.");
  });

  it("falls back to correctAnswer when no mark scheme", () => {
    const out = resolveShortAnswerModelAnswer({
      correctAnswer: "Mitochondria",
    });
    expect(out).toBe("Mitochondria");
  });
});
