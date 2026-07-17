import { isPlaceholderMcqOptions } from "./mcqPlaceholderOptions";
import {
  legacyActivityFieldsAreEmpty,
  projectFirstBankQuestionToLegacyFields,
  resolveActivityPreviewQuestion,
  snapshotActivityBankForCompare,
  withEditorCompatFromActivityBank,
} from "./activityBankEditorCompat";
import { preserveActivityQuestions } from "./activityQuestionBankRoundTrip";

const synthesiserSelfCheck = {
  type: "selfCheck",
  role: "selfCheck",
  questionType: "mcq",
  prompt: "",
  question: "",
  questions: [
    {
      id: "sc1",
      type: "short",
      prompt: "Define a gamete.",
      question: "Define a gamete.",
      options: [],
      answer: "A sex cell",
      correctAnswer: "A sex cell",
      markScheme: ["sex cell"],
      sourceIds: ["src-1"],
    },
    {
      id: "sc2",
      type: "mcq",
      prompt: "Which statement is correct?",
      question: "Which statement is correct?",
      options: [
        "It contradicts the curated curriculum sources for this topic",
        "It is always true for every organism without exception",
        "It replaces the need for any biological evidence",
        "It means assessment never uses command words",
      ],
      answer: "It contradicts the curated curriculum sources for this topic",
      correctAnswer: "It contradicts the curated curriculum sources for this topic",
      markScheme: ["contradicts sources"],
      sourceIds: ["src-2"],
    },
    {
      id: "sc3",
      type: "short",
      prompt: "Explain fertilisation briefly.",
      question: "Explain fertilisation briefly.",
      options: [],
      answer: "Fusion of gametes",
      correctAnswer: "Fusion of gametes",
    },
  ],
};

const synthesiserCheckpoint = {
  type: "checkpoint",
  questionType: "mcq",
  prompt: "",
  questions: [
    {
      id: "cp1",
      type: "short",
      prompt: "Give an example.",
      question: "Give an example.",
      options: [],
      correctAnswer: "Example within curriculum",
    },
    {
      id: "cp2",
      type: "mcq",
      prompt: "Best comparison approach?",
      question: "Best comparison approach?",
      options: [
        "Compare related processes using vocabulary from the topic sources",
        "Ignore sources and invent a new specification statement",
        "Treat GCSE and IGCSE as identical board identities",
        "Replace biological terms with Option labels",
      ],
      correctAnswer: "Compare related processes using vocabulary from the topic sources",
    },
    {
      id: "cp3",
      type: "short",
      prompt: "Outline a teaching sequence.",
      question: "Outline a teaching sequence.",
      options: [],
      correctAnswer: "Prior knowledge → core idea",
    },
  ],
};

const synthesiserPageQuiz = {
  type: "pageQuiz",
  questionType: "mcq",
  prompt: "",
  question: "",
  questions: [
    {
      id: "quiz1",
      type: "short",
      prompt: "Meaning of gamete?",
      question: "Meaning of gamete?",
      options: [],
      correctAnswer: "Meaning of gamete consistent with sources.",
    },
    {
      id: "quiz2",
      type: "mcq",
      prompt: "Best description?",
      question: "Best description?",
      options: [
        "Describe gametes as specialised sex cells involved in sexual reproduction",
        "An explanation that invents unassessed specification claims",
        "An explanation that ignores board and level identity",
        "An explanation written only as placeholder labels",
      ],
      correctAnswer:
        "Describe gametes as specialised sex cells involved in sexual reproduction",
    },
    { id: "quiz3", type: "short", prompt: "Q3", question: "Q3", options: [], correctAnswer: "A3" },
    { id: "quiz4", type: "short", prompt: "Q4", question: "Q4", options: [], correctAnswer: "A4" },
    {
      id: "quiz5",
      type: "mcq",
      prompt: "Exam tip?",
      question: "Exam tip?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
    },
  ],
};

describe("activityBankEditorCompat", () => {
  it("treats empty legacy fields as empty even when padded with blank option slots", () => {
    expect(
      legacyActivityFieldsAreEmpty({
        prompt: "",
        options: ["", "", "", ""],
        correctAnswer: "",
      })
    ).toBe(true);
  });

  it("Synthesiser-shaped selfCheck with empty legacy fields projects real MCQ options", () => {
    const out = withEditorCompatFromActivityBank(
      {
        type: "selfCheck",
        prompt: "",
        questionType: "mcq",
        options: ["", ""],
        correctAnswer: "",
        explanation: "",
      },
      synthesiserSelfCheck
    );
    expect(out.prompt).toContain("Which statement");
    expect(out.questionType).toBe("mcq");
    expect(out.options).toEqual(synthesiserSelfCheck.questions[1].options);
    expect(out.correctAnswer).toBe(synthesiserSelfCheck.questions[1].correctAnswer);
    const outRec = out as Record<string, unknown>;
    expect(Array.isArray(outRec.questions)).toBe(true);
    expect((outRec.questions as unknown[]).length).toBe(3);
    expect(isPlaceholderMcqOptions(out.options)).toBe(false);
  });

  it("Synthesiser-shaped checkpoint preview does not look like placeholder MCQ", () => {
    const preview = resolveActivityPreviewQuestion(synthesiserCheckpoint);
    expect(preview).not.toBeNull();
    expect(preview!.fromBank).toBe(true);
    expect(preview!.bankCount).toBe(3);
    expect(preview!.questionType).toBe("mcq");
    expect(isPlaceholderMcqOptions(preview!.options)).toBe(false);
    expect(preview!.options[0]).toMatch(/Compare related processes/);
  });

  it("pageQuiz questions[] preserved through normalize/preserve", () => {
    const preserved = preserveActivityQuestions(synthesiserPageQuiz.questions);
    expect(preserved).toHaveLength(5);
    const snap = snapshotActivityBankForCompare(synthesiserPageQuiz.questions);
    expect(snap).toHaveLength(5);
    expect(snap[1].options).toEqual(synthesiserPageQuiz.questions[1].options);
    expect(snap[4].options).toEqual(["A", "B", "C", "D"]);
  });

  it("legacy single-question self-check is unchanged when legacy fields are filled", () => {
    const legacy = {
      type: "selfCheck",
      prompt: "Only one?",
      questionType: "short" as const,
      options: [] as string[],
      correctAnswer: "yes",
    };
    const out = withEditorCompatFromActivityBank(legacy, legacy);
    expect(out.prompt).toBe("Only one?");
    expect(out.correctAnswer).toBe("yes");
    expect((out as Record<string, unknown>).questions).toBeUndefined();
  });

  it("legacy single-question MCQ keeps its own options when present", () => {
    const legacy = {
      type: "checkpoint",
      prompt: "Pick one",
      questionType: "mcq" as const,
      options: ["Alpha", "Beta", "Gamma", "Delta"],
      correctAnswer: "Alpha",
      questions: synthesiserCheckpoint.questions,
    };
    const out = withEditorCompatFromActivityBank(
      {
        type: "checkpoint",
        prompt: "Pick one",
        questionType: "mcq",
        options: ["Alpha", "Beta", "Gamma", "Delta"],
        correctAnswer: "Alpha",
      },
      legacy
    );
    expect(out.prompt).toBe("Pick one");
    expect(out.options).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
    expect(((out as Record<string, unknown>).questions as unknown[]).length).toBe(3);
  });

  it("save/reload snapshot preserves bank lengths and option strings (3 / 3 / 5)", () => {
    const sc = snapshotActivityBankForCompare(synthesiserSelfCheck.questions);
    const cp = snapshotActivityBankForCompare(synthesiserCheckpoint.questions);
    const pq = snapshotActivityBankForCompare(synthesiserPageQuiz.questions);
    expect(sc).toHaveLength(3);
    expect(cp).toHaveLength(3);
    expect(pq).toHaveLength(5);
    const scAgain = snapshotActivityBankForCompare(
      preserveActivityQuestions(synthesiserSelfCheck.questions)
    );
    expect(scAgain).toEqual(sc);
    expect(sc[1].options).toEqual(synthesiserSelfCheck.questions[1].options);
    expect(sc[0].markScheme).toEqual(["sex cell"]);
    expect(sc[0].sourceIds).toEqual(["src-1"]);
  });

  it("projectFirstBankQuestionToLegacyFields prefers first real MCQ", () => {
    const projected = projectFirstBankQuestionToLegacyFields(synthesiserSelfCheck);
    expect(projected?.prompt).toContain("Which statement");
    expect(projected?.options).toHaveLength(4);
  });
});
