import { parseLessonText } from "./parseLessonText";

describe("parseLessonText", () => {
  it("extracts a bold-only line as a heading segment", () => {
    const s = parseLessonText("Intro\n\n**📘 1. Revision Objectives**\n\nBody");
    expect(s.some((x) => x.type === "heading" && x.text.includes("Revision Objectives"))).toBe(true);
    expect(s.find((x) => x.type === "markdown")?.type).toBe("markdown");
  });

  it("stops Answer before Explanation so answer does not swallow explanation lines", () => {
    const raw = `⚡ CHECKPOINT
Question:
What powers the cell?
Option 1:
Mitochondria
Option 2:
Nucleus
Answer:
Mitochondria

Explanation:
Because it produces ATP.
`;
    const s = parseLessonText(raw);
    const cp = s.find((x) => x.type === "checkpoint");
    expect(cp?.type).toBe("checkpoint");
    if (cp?.type === "checkpoint") {
      expect(cp.answer).toBe("Mitochondria");
      expect(cp.options.map((o) => o.trim())).toContain("Mitochondria");
    }
  });

  it("parses a CHECKPOINT block with Question, Options, Answer", () => {
    const raw = `⚡ CHECKPOINT
Question:
What is X?
Option 1:
A
Option 2:
B
Answer:
B
`;
    const s = parseLessonText(raw);
    const cp = s.find((x) => x.type === "checkpoint");
    expect(cp?.type).toBe("checkpoint");
    if (cp?.type === "checkpoint") {
      expect(cp.question).toContain("What is X");
      expect(cp.options.length).toBeGreaterThanOrEqual(2);
      expect(cp.answer).toMatch(/B/);
    }
  });

  it("falls back to markdown when checkpoint line does not parse", () => {
    const raw = "⚡ CHECKPOINT\nnot valid yet\n\nMore text";
    const s = parseLessonText(raw);
    const md = s.filter((x) => x.type === "markdown").map((x) => (x.type === "markdown" ? x.text : ""));
    expect(md.join("\n")).toContain("⚡ CHECKPOINT");
  });
});
