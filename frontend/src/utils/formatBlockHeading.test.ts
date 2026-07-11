import {
  allocateLessonFlowFooterOrdinals,
  fallbackActivityTitleFromBlockType,
  formatDisplaySectionHeading,
  formatStudentBlockHeading,
  inferStudentFrameKind,
  isDuplicateBlockTitle,
  isOuterStudentHeadingVisible,
  normalizeLegacyBlockLabel,
  normalizeLegacySs1Heading,
  normalizePersistedBlockTitle,
  shouldSuppressInnerBlockTitle,
} from "./formatBlockHeading";

describe("normalizeLegacyBlockLabel", () => {
  it("renames Core teaching variants to Core Learning", () => {
    expect(normalizeLegacyBlockLabel("CORE TEACHING")).toBe("CORE LEARNING");
    expect(normalizeLegacyBlockLabel("Core Teaching")).toBe("Core Learning");
    expect(normalizeLegacyBlockLabel("Core teaching")).toBe("Core Learning");
  });

  it("renames Scenario / Hook to Scenario", () => {
    expect(normalizeLegacyBlockLabel("SCENARIO / HOOK")).toBe("SCENARIO");
    expect(normalizeLegacyBlockLabel("Scenario / Hook")).toBe("Scenario");
  });

  it("leaves unrelated labels unchanged", () => {
    expect(normalizeLegacyBlockLabel("Core rule")).toBe("Core rule");
    expect(normalizeLegacyBlockLabel("Hook")).toBe("Hook");
  });
});

describe("legacy SS1 headings", () => {
  it("renames numbered legacy titles", () => {
    expect(normalizeLegacySs1Heading("5 — CORE TEACHING")).toBe("5 — CORE LEARNING");
    expect(normalizeLegacySs1Heading("4 — SCENARIO / HOOK")).toBe("4 — SCENARIO");
    expect(formatStudentBlockHeading({ number: 5, title: "CORE TEACHING" })).toBe(
      "5 — CORE LEARNING"
    );
    expect(normalizePersistedBlockTitle({ title: "Core teaching" }).title).toBe("Core Learning");
  });
});

describe("inferStudentFrameKind", () => {
  it("maps SS1 teaching headings to frame kinds", () => {
    expect(inferStudentFrameKind("1 — REVISION OBJECTIVES")).toBe("objectives");
    expect(inferStudentFrameKind("2 — PRIOR KNOWLEDGE")).toBe("prior-knowledge");
    expect(inferStudentFrameKind("3 — DEFINITION")).toBe("definition");
    expect(inferStudentFrameKind("4 — SCENARIO")).toBe("scenario");
    expect(inferStudentFrameKind("5 — WHY IT MATTERS")).toBe("why-matters");
    expect(inferStudentFrameKind("7 — KEY EXAMPLES")).toBe("examples");
    expect(inferStudentFrameKind("8 — EXAM VOCABULARY")).toBe("keywords");
    expect(inferStudentFrameKind("9 — CORE LEARNING")).toBe("core-learning");
    expect(inferStudentFrameKind("Instructions")).toBe("instructions");
    expect(inferStudentFrameKind("Task")).toBe("task");
    expect(inferStudentFrameKind("21 — KEY WORDS")).toBe("keywords");
  });

  it("falls back to default for unknown labels", () => {
    expect(inferStudentFrameKind("Something else")).toBe("default");
  });
});

describe("activity titles and display numbering", () => {
  it("uses type fallback when numbered block has no title", () => {
    expect(formatStudentBlockHeading({ number: 12, type: "checkpoint", title: "" })).toBe(
      "12 — CHECKPOINT"
    );
    expect(formatStudentBlockHeading({ number: 8, type: "selfCheck", title: "" })).toBe(
      "8 — SELF-CHECK"
    );
    expect(fallbackActivityTitleFromBlockType("dragDropMatch")).toBe("DRAG AND DROP MATCH");
    expect(fallbackActivityTitleFromBlockType("composite")).toBe("COMPOSITE QUESTION");
    expect(formatStudentBlockHeading({ number: 24, type: "composite", title: "" })).toBe(
      "24 — COMPOSITE QUESTION"
    );
    expect(formatStudentBlockHeading({ number: 15, type: "examQuestion", title: "" })).toBe(
      "15 — EXAM QUESTION"
    );
  });

  it("does not double-number existing SS1 headings", () => {
    expect(formatDisplaySectionHeading(18, "18 — Quiz Page")).toBe("18 — Quiz Page");
    expect(formatDisplaySectionHeading(19, "Practice Questions")).toBe("19 — Practice Questions");
  });

  it("preserves existing titles when present", () => {
    expect(formatStudentBlockHeading({ number: 10, title: "Sexual and asexual reproduction" })).toBe(
      "10 — Sexual and asexual reproduction"
    );
  });

  it("shifts Revision Practice after a legacy page self-check", () => {
    const withoutCp = allocateLessonFlowFooterOrdinals(21, false);
    expect(withoutCp.pageCheckpoint).toBeNull();
    expect(withoutCp.revisionPractice).toBe(22);
    expect(withoutCp.quizPage).toBe(23);
    expect(withoutCp.practiceQuestions).toBe(24);

    const withCp = allocateLessonFlowFooterOrdinals(21, true);
    expect(withCp.pageCheckpoint).toBe(22);
    expect(formatStudentBlockHeading({ number: 22, type: "selfCheck" })).toBe("22 — SELF-CHECK");
    expect(withCp.revisionPractice).toBe(23);
    expect(formatDisplaySectionHeading(withCp.revisionPractice, "Revision practice")).toBe(
      "23 — Revision practice"
    );
    expect(withCp.quizPage).toBe(24);
    expect(withCp.practiceQuestions).toBe(25);
  });
});

describe("duplicate inner title suppression", () => {
  it("treats numbered outer and plain inner labels as duplicates", () => {
    expect(isDuplicateBlockTitle("14 — STEP-BY-STEP PROCESS", "STEP-BY-STEP PROCESS")).toBe(true);
    expect(isDuplicateBlockTitle("14 — STEP-BY-STEP PROCESS", "14 — STEP-BY-STEP PROCESS")).toBe(
      true
    );
    expect(isDuplicateBlockTitle("12 — DRAG AND DROP MATCH", "Drag and Drop Match")).toBe(true);
  });

  it("keeps distinct subheadings", () => {
    expect(isDuplicateBlockTitle("14 — STEP-BY-STEP PROCESS", "Step 1")).toBe(false);
    expect(isDuplicateBlockTitle("14 — STEP-BY-STEP PROCESS", "Test me")).toBe(false);
    expect(isDuplicateBlockTitle("12 — DRAG AND DROP MATCH", "Instructions")).toBe(false);
  });

  it("suppresses only when outer heading is visible", () => {
    expect(
      shouldSuppressInnerBlockTitle("14 — STEP-BY-STEP PROCESS", "STEP-BY-STEP PROCESS", true)
    ).toBe(true);
    expect(
      shouldSuppressInnerBlockTitle("14 — STEP-BY-STEP PROCESS", "STEP-BY-STEP PROCESS", false)
    ).toBe(false);
    expect(
      isOuterStudentHeadingVisible({ number: 14, type: "interactiveSequence", title: "" }, "")
    ).toBe(true);
    expect(
      isOuterStudentHeadingVisible(
        { number: 14, title: "STEP-BY-STEP PROCESS" },
        "14 — STEP-BY-STEP PROCESS\n\nIntro"
      )
    ).toBe(false);
  });
});
