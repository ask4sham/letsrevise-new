import {
  allocateLessonFlowFooterOrdinals,
  applySequentialStudentDisplayNumbers,
  fallbackActivityTitleFromBlockType,
  formatDisplaySectionHeading,
  formatStudentBlockHeading,
  inferStudentFrameKind,
  isDuplicateBlockTitle,
  isOuterStudentHeadingVisible,
  normalizeLegacyBlockLabel,
  normalizeLegacySs1Heading,
  normalizePersistedBlockTitle,
  sequentialStudentBlockNumber,
  shouldSuppressInnerBlockTitle,
  stripLeadingDuplicateBlockHeading,
  studentDisplayNumbersAreSequential,
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

  it("renames Composite Question to Exam Question for student display", () => {
    expect(normalizeLegacyBlockLabel("COMPOSITE QUESTION")).toBe("EXAM QUESTION");
    expect(normalizeLegacyBlockLabel("Composite Question")).toBe("Exam Question");
    expect(normalizeLegacySs1Heading("23 — COMPOSITE QUESTION")).toBe("23 — EXAM QUESTION");
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
    expect(fallbackActivityTitleFromBlockType("composite")).toBe("EXAM QUESTION");
    expect(formatStudentBlockHeading({ number: 24, type: "composite", title: "" })).toBe(
      "24 — EXAM QUESTION"
    );
    expect(formatStudentBlockHeading({ number: 23, type: "composite", title: "COMPOSITE QUESTION" })).toBe(
      "23 — EXAM QUESTION"
    );
    expect(formatStudentBlockHeading({ number: 15, type: "examQuestion", title: "" })).toBe(
      "15 — EXAM QUESTION"
    );
  });

  it("sequentialStudentBlockNumber follows visual ordinal (not authored SS1 slots)", () => {
    expect(sequentialStudentBlockNumber(1)).toBe(1);
    expect(sequentialStudentBlockNumber(14)).toBe(14);
    expect(sequentialStudentBlockNumber(0)).toBe(1);
  });

  it("applySequentialStudentDisplayNumbers rewrites authored 16→13→12 slots to 1→2→3", () => {
    const authored = [
      { type: "diagram", number: 16, title: "16 — DIAGRAM / VISUAL SETUP" },
      { type: "interactiveSequence", number: 13, title: "13 — STEP-BY-STEP PROCESS" },
      { type: "text", number: 12, title: "12 — EXAM TECHNIQUE" },
      { type: "text", number: 22, title: "22 — SYNTHESIS" },
      { type: "keyWords", number: 28, title: "28 — KEY WORDS" },
      { type: "selfCheck", number: 19, title: "19 — SELF-CHECK" },
    ];
    const out = applySequentialStudentDisplayNumbers(authored, 1);
    expect(studentDisplayNumbersAreSequential(out, 1)).toBe(true);
    expect(out.map((b) => formatStudentBlockHeading(b))).toEqual([
      "1 — DIAGRAM / VISUAL SETUP",
      "2 — STEP-BY-STEP PROCESS",
      "3 — EXAM TECHNIQUE",
      "4 — SYNTHESIS",
      "5 — KEY WORDS",
      "6 — SELF-CHECK",
    ]);
  });

  it("does not resurrect authored SS1 numbers from title when display number is missing", () => {
    expect(formatStudentBlockHeading({ title: "16 — DIAGRAM / VISUAL SETUP" })).toBe(
      "DIAGRAM / VISUAL SETUP"
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

  it("skips Quiz Page ordinal when that footer section is hidden", () => {
    const hidden = allocateLessonFlowFooterOrdinals(25, false, { showQuizPage: false });
    expect(hidden.revisionPractice).toBe(26);
    expect(hidden.quizPage).toBeNull();
    expect(hidden.practiceQuestions).toBe(27);
  });
});

describe("duplicate inner title suppression", () => {
  it("treats numbered outer and plain inner labels as duplicates", () => {
    expect(isDuplicateBlockTitle("14 — STEP-BY-STEP PROCESS", "STEP-BY-STEP PROCESS")).toBe(true);
    expect(isDuplicateBlockTitle("14 — STEP-BY-STEP PROCESS", "14 — STEP-BY-STEP PROCESS")).toBe(
      true
    );
    expect(isDuplicateBlockTitle("12 — DRAG AND DROP MATCH", "Drag and Drop Match")).toBe(true);
    expect(isDuplicateBlockTitle("2 — PRIOR KNOWLEDGE", "Prior knowledge")).toBe(true);
    expect(isDuplicateBlockTitle("9 — CORE LEARNING", "Core learning")).toBe(true);
    expect(isDuplicateBlockTitle("8 — KEY WORDS", "Keywords")).toBe(true);
    expect(isDuplicateBlockTitle("5 — WHY IT MATTERS", "Why this matters")).toBe(true);
  });

  it("keeps distinct subheadings", () => {
    expect(isDuplicateBlockTitle("14 — STEP-BY-STEP PROCESS", "Step 1")).toBe(false);
    expect(isDuplicateBlockTitle("14 — STEP-BY-STEP PROCESS", "Test me")).toBe(false);
    expect(isDuplicateBlockTitle("12 — DRAG AND DROP MATCH", "Instructions")).toBe(false);
    expect(isDuplicateBlockTitle("2 — PRIOR KNOWLEDGE", "Useful reminder")).toBe(false);
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

  it("strips leading Prior knowledge when outer is numbered PRIOR KNOWLEDGE", () => {
    const outer = formatStudentBlockHeading({ number: 2, title: "PRIOR KNOWLEDGE" });
    expect(outer).toBe("2 — PRIOR KNOWLEDGE");
    expect(
      stripLeadingDuplicateBlockHeading(
        "Prior knowledge\n\n- Plants make glucose\n- Animals eat plants",
        outer
      )
    ).toBe("- Plants make glucose\n- Animals eat plants");
    expect(
      stripLeadingDuplicateBlockHeading("## Prior knowledge\n\nBody text here", outer)
    ).toBe("Body text here");
    expect(
      stripLeadingDuplicateBlockHeading(
        "<h2>Prior knowledge</h2>\n<p>Body text here</p>",
        outer
      )
    ).toBe("<p>Body text here</p>");
    expect(
      stripLeadingDuplicateBlockHeading(
        "<p><strong>Prior knowledge</strong></p>\n<p>Body</p>",
        outer
      )
    ).toBe("<p>Body</p>");
  });

  it("preserves different inner subheadings and activity labels", () => {
    const outer = "2 — PRIOR KNOWLEDGE";
    expect(stripLeadingDuplicateBlockHeading("Useful reminder\n\n- Fact", outer)).toBe(
      "Useful reminder\n\n- Fact"
    );
    expect(
      stripLeadingDuplicateBlockHeading("Step 1\n\nDo the first step", "14 — STEP-BY-STEP PROCESS")
    ).toBe("Step 1\n\nDo the first step");
    expect(stripLeadingDuplicateBlockHeading("Test me\n\nQuestion?", "14 — STEP-BY-STEP PROCESS")).toBe(
      "Test me\n\nQuestion?"
    );
  });

  it("covers common teaching-block label duplicates", () => {
    const cases = [
      ["9 — CORE LEARNING", "Core learning\n\nPhotosynthesis…", "Photosynthesis…"],
      ["8 — KEY WORDS", "Keywords\n\nglucose, oxygen", "glucose, oxygen"],
      ["10 — SUMMARY", "Summary\n\nKey points", "Key points"],
      ["4 — SCENARIO", "Scenario\n\nA plant in dark", "A plant in dark"],
      ["5 — WHY IT MATTERS", "Why it matters\n\nExam link", "Exam link"],
      ["3 — DEFINITION", "Definition\n\nA process…", "A process…"],
      ["7 — KEY EXAMPLES", "Key examples\n\nExample A", "Example A"],
    ];
    for (const [outer, content, expected] of cases) {
      expect(stripLeadingDuplicateBlockHeading(content, outer)).toBe(expected);
    }
  });

  it("does not change numbering or frame labels", () => {
    expect(formatStudentBlockHeading({ number: 2, title: "PRIOR KNOWLEDGE" })).toBe(
      "2 — PRIOR KNOWLEDGE"
    );
    expect(inferStudentFrameKind("2 — PRIOR KNOWLEDGE")).toBe("prior-knowledge");
    expect(inferStudentFrameKind("9 — CORE LEARNING")).toBe("core-learning");
  });
});
