import {
  assertGeneratorExportV1QualityFloor,
  formatQualityFloorErrorMessage,
  isPlaceholderOptions,
  markSchemeIsConcealed,
} from "./generatorExportV1QualityFloor";

function baseDoc(overrides: Record<string, unknown> = {}) {
  return {
    formatVersion: "letsrevise.generator.export.v1",
    lesson: {
      title: "Gametes and Fertilisation",
      subject: "Biology",
      board: "Edexcel",
      level: "IGCSE",
    },
    pages: [
      {
        title: "Learn",
        pageType: "learn",
        blocks: [
          {
            editorType: "keyIdeas",
            title: "Key ideas",
            payload: { content: "<p>Gametes are sex cells.</p>" },
          },
        ],
      },
      {
        title: "Practise",
        pageType: "practise",
        blocks: [
          {
            editorType: "pageQuiz",
            title: "Quiz",
            payload: {
              questions: [
                {
                  prompt: "What is a gamete?",
                  questionType: "mcq",
                  options: ["Sex cell", "Body cell", "Pollen tube", "Zygote wall"],
                  correctAnswer: "Sex cell",
                },
              ],
            },
          },
          {
            editorType: "text",
            role: "examPractice",
            title: "Practice Questions",
            payload: {
              content:
                "<p><strong>Q1 (2 marks)</strong></p>\n<p>Explain fertilisation.</p>\n<details><summary>Reveal Model Answer</summary>\n<h3><strong>Mark scheme:</strong></h3>\n<ul>\n<li>fusion of gametes</li>\n</ul>\n</details>",
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("generatorExportV1QualityFloor", () => {
  test("accepts a gold-shaped Gametes-like export", () => {
    const result = assertGeneratorExportV1QualityFloor(baseDoc());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("rejects empty pageQuiz bank", () => {
    const doc = baseDoc();
    (doc.pages[1] as { blocks: unknown[] }).blocks[0] = {
      editorType: "pageQuiz",
      payload: { questions: [] },
    };
    const result = assertGeneratorExportV1QualityFloor(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "QF_EMPTY_PAGE_QUIZ")).toBe(
      true
    );
  });

  test("rejects Option 1–4 filler checkpoints", () => {
    const doc = baseDoc();
    (doc.pages[1] as { blocks: unknown[] }).blocks.push({
      editorType: "checkpoint",
      payload: {
        prompt: "Which statement is correct?",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        correctAnswer: "Option 1",
      },
    });
    const result = assertGeneratorExportV1QualityFloor(doc);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === "QF_PLACEHOLDER_CHECKPOINT")
    ).toBe(true);
  });

  test("rejects open mark schemes outside details", () => {
    const doc = baseDoc();
    (doc.pages[1] as { blocks: unknown[] }).blocks[1] = {
      editorType: "text",
      role: "examPractice",
      title: "Practice Questions",
      payload: {
        content:
          "<p>Q1</p>\n<h3><strong>Mark scheme:</strong></h3>\n<ul>\n<li>open answer</li>\n</ul>",
      },
    };
    const result = assertGeneratorExportV1QualityFloor(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "QF_OPEN_MARK_SCHEME")).toBe(
      true
    );
  });

  test("rejects testing blocks on Learn", () => {
    const doc = baseDoc();
    (doc.pages[0] as { blocks: unknown[] }).blocks.push({
      editorType: "pageQuiz",
      payload: {
        questions: [
          {
            prompt: "Bad on learn",
            options: ["A", "B"],
            correctAnswer: "A",
          },
        ],
      },
    });
    const result = assertGeneratorExportV1QualityFloor(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "QF_LEARN_TESTING")).toBe(true);
  });

  test("helpers detect fillers and concealed mark schemes", () => {
    expect(isPlaceholderOptions(["Option 1", "Option 2"])).toBe(true);
    expect(isPlaceholderOptions(["Sex cell", "Zygote"])).toBe(false);
    expect(
      markSchemeIsConcealed(
        "<details><summary>Reveal</summary><h3><strong>Mark scheme:</strong></h3><ul><li>x</li></ul></details>"
      )
    ).toBe(true);
    expect(
      markSchemeIsConcealed(
        "<h3><strong>Mark scheme:</strong></h3><ul><li>x</li></ul>"
      )
    ).toBe(false);
  });

  test("formats a clear import error message", () => {
    const msg = formatQualityFloorErrorMessage({
      ok: false,
      errors: [
        {
          code: "QF_EMPTY_PAGE_QUIZ",
          path: "pages[1].blocks[0]",
          message: "pageQuiz has an empty questions bank.",
        },
      ],
    });
    expect(msg).toMatch(/^Import blocked by quality floor:/);
    expect(msg).toContain("empty questions bank");
  });
});
