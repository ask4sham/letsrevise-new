import {
  chunkBlocksForTeachingLayout,
  type IndexedLessonBlock,
} from "../components/lesson/student/chunkLessonSegments";
import {
  isStudentCheckpointBlock,
  studentCheckpointFromBlock,
} from "./studentCheckpointFromBlock";

describe("studentCheckpointFromBlock", () => {
  it("accepts mcq checkpoint blocks with prompt and options", () => {
    const data = studentCheckpointFromBlock(
      {
        type: "checkpoint",
        prompt: "Which is correct?",
        options: ["A", "B", "C"],
        correctAnswer: "B",
        markScheme: ["@lr-difficulty:medium", "Point one"],
      },
      "p1-b2"
    );
    expect(data).toMatchObject({
      mode: "mcq",
      prompt: "Which is correct?",
      correctAnswer: "B",
    });
    expect(data?.markScheme).toContain("@lr-difficulty:medium");
  });

  it("accepts legacy question field alias", () => {
    const data = studentCheckpointFromBlock(
      {
        type: "checkpoint",
        question: "Legacy Q",
        options: ["1", "2"],
        answer: "1",
      },
      "x"
    );
    expect(data?.prompt).toBe("Legacy Q");
    expect(data?.correctAnswer).toBe("1");
  });

  it("returns null for empty mcq checkpoint", () => {
    expect(
      studentCheckpointFromBlock({ type: "checkpoint", prompt: "Q", options: ["only"] }, "x")
    ).toBeNull();
  });

  it("isStudentCheckpointBlock recognises checkpoint type", () => {
    expect(isStudentCheckpointBlock({ type: "checkpoint" })).toBe(true);
    expect(isStudentCheckpointBlock({ type: "text" })).toBe(false);
  });
});

describe("chunkBlocksForTeachingLayout checkpoint", () => {
  it("keeps checkpoint blocks in teaching chunks (not filtered out)", () => {
    const items: IndexedLessonBlock<Record<string, unknown>>[] = [
      { block: { type: "text", content: "Intro" }, idx: 0 },
      {
        block: {
          type: "checkpoint",
          prompt: "Pick one",
          options: ["X", "Y"],
          correctAnswer: "X",
        },
        idx: 1,
      },
      { block: { type: "keyIdea", content: "Rule" }, idx: 2 },
    ];
    const flat = chunkBlocksForTeachingLayout(items).flat();
    expect(flat.some((i) => i.block.type === "checkpoint")).toBe(true);
    expect(flat.find((i) => i.idx === 1)?.block.type).toBe("checkpoint");
  });
});
