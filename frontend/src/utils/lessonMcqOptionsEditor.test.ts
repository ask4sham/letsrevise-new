import { guardLessonBlockPatchForDuplicatePaste } from "./lessonEditorPaste";
import {
  backendSelfCheckSanitizeForTest,
  patchMcqAddOption,
  patchMcqOptionText,
  patchMcqRemoveOption,
  sanitizeLiveMcqOptions,
  selfCheckBlockForPersist,
  LIVE_MCQ_OPTIONS_MAX,
  LIVE_MCQ_OPTIONS_MIN,
} from "./lessonMcqOptionsEditor";

function applyLiveBlockPatch<T extends Record<string, unknown>>(
  block: T,
  patch: Record<string, unknown>
): T {
  const guarded = guardLessonBlockPatchForDuplicatePaste(patch, { mode: "live" });
  return { ...block, ...guarded };
}

describe("lessonMcqOptionsEditor", () => {
  const fourOpts = ["A", "B", "C", "D"];

  it("sanitizeLiveMcqOptions preserves length between 2 and 6", () => {
    expect(sanitizeLiveMcqOptions(["a", "b", "c", "d", "e"]).length).toBe(5);
    expect(sanitizeLiveMcqOptions(["only"]).length).toBe(LIVE_MCQ_OPTIONS_MIN);
  });

  it("SelfCheck add option changes length 4 → 5", () => {
    let block = { type: "selfCheck", options: [...fourOpts], correctAnswer: "A" };
    block = applyLiveBlockPatch(block, patchMcqAddOption(block.options));
    expect(block.options).toHaveLength(5);
    expect(block.options[4]).toBe("");
  });

  it("SelfCheck remove option changes length 4 → 3", () => {
    let block = { type: "selfCheck", options: [...fourOpts], correctAnswer: "A" };
    block = applyLiveBlockPatch(block, patchMcqRemoveOption(block.options, block.correctAnswer));
    expect(block.options).toHaveLength(3);
    expect(block.options).toEqual(["A", "B", "C"]);
  });

  it("cannot go below 2 options", () => {
    const two = ["Yes", "No"];
    const patch = patchMcqRemoveOption(two, "Yes");
    expect(patch.options).toHaveLength(LIVE_MCQ_OPTIONS_MIN);
    const guarded = guardLessonBlockPatchForDuplicatePaste(patch, { mode: "live" });
    expect(guarded.options).toHaveLength(LIVE_MCQ_OPTIONS_MIN);
  });

  it("cannot exceed 6 options", () => {
    const six = ["1", "2", "3", "4", "5", "6"];
    const patch = patchMcqAddOption(six);
    expect(patch.options).toHaveLength(LIVE_MCQ_OPTIONS_MAX);
    const guarded = guardLessonBlockPatchForDuplicatePaste(patch, { mode: "live" });
    expect(guarded.options).toHaveLength(LIVE_MCQ_OPTIONS_MAX);
  });

  it("editing option text persists in editor state", () => {
    let block = { type: "selfCheck", options: [...fourOpts], correctAnswer: "B" };
    block = applyLiveBlockPatch(
      block,
      patchMcqOptionText(block.options, 0, "Alpha", block.correctAnswer)
    );
    expect(block.options[0]).toBe("Alpha");
    expect(block.correctAnswer).toBe("B");
  });

  it("editing the correct option updates correctAnswer", () => {
    let block = { type: "selfCheck", options: [...fourOpts], correctAnswer: "B" };
    block = applyLiveBlockPatch(
      block,
      patchMcqOptionText(block.options, 1, "Beta", block.correctAnswer)
    );
    expect(block.options[1]).toBe("Beta");
    expect(block.correctAnswer).toBe("Beta");
  });

  it("removing correct option resets correctAnswer to first remaining non-empty", () => {
    const opts = ["A", "B", "C", "D"];
    const patch = patchMcqRemoveOption(opts, "D");
    expect(patch.options).toHaveLength(3);
    expect(patch.correctAnswer).toBe("A");
  });

  it("save/reload preserves edited selfCheck options (5 filled MCQ)", () => {
    const edited = {
      type: "selfCheck" as const,
      prompt: "Which is correct?",
      questionType: "mcq" as const,
      options: ["One", "Two", "Three", "Four", "Five"],
      correctAnswer: "Five",
    };
    const payload = selfCheckBlockForPersist(edited);
    expect(payload.options).toEqual(["One", "Two", "Three", "Four", "Five"]);

    const reloaded = backendSelfCheckSanitizeForTest({
      prompt: String(payload.prompt),
      questionType: String(payload.questionType),
      options: payload.options as string[],
      correctAnswer: String(payload.correctAnswer),
    });
    expect("placeholder" in reloaded).toBe(false);
    if (!("placeholder" in reloaded)) {
      expect(reloaded.options).toEqual(["One", "Two", "Three", "Four", "Five"]);
      expect(reloaded.correctAnswer).toBe("Five");
    }
  });
});

describe("guardLessonBlockPatchForDuplicatePaste paste vs live", () => {
  it("paste mode still normalises options to exactly four", () => {
    const guarded = guardLessonBlockPatchForDuplicatePaste(
      { options: ["a", "b", "c", "d", "e"] },
      { mode: "paste" }
    );
    expect(guarded.options).toEqual(["a", "b", "c", "d"]);
  });

  it("live mode preserves five options through the guard", () => {
    const guarded = guardLessonBlockPatchForDuplicatePaste(
      { options: ["a", "b", "c", "d", "e"] },
      { mode: "live" }
    );
    expect(guarded.options).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("default mode is paste (backward compatible for CreateLessonPage)", () => {
    const guarded = guardLessonBlockPatchForDuplicatePaste({ options: ["x", "y"] });
    expect(guarded.options).toEqual(["x", "y", "", ""]);
  });
});
