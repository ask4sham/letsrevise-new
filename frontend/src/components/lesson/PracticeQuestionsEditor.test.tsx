import { fireEvent, render, screen } from "@testing-library/react";
import PracticeQuestionsEditor from "./PracticeQuestionsEditor";
import type { PracticeQuestionAttachment } from "../../api/lessonPracticeEdits";
import type { PendingPracticeQuestionEditsMap } from "../../utils/practiceQuestionLessonState";

const mcqAttachment: PracticeQuestionAttachment = {
  questionId: "mcq-1",
  slotIndex: 0,
  editable: true,
  hasLessonEdit: false,
  available: true,
  master: {
    id: "mcq-1",
    question: "Bank MCQ stem?",
    type: "mcq",
    marks: 2,
    options: ["Alpha", "Beta", "Gamma"],
    correctAnswer: "Alpha",
    markScheme: ["Alpha is correct because..."],
    explanation: "Hidden MCQ explanation",
  },
  effective: {
    id: "mcq-1",
    question: "Bank MCQ stem?",
    type: "mcq",
    marks: 2,
    options: ["Alpha", "Beta", "Gamma"],
    correctAnswer: "Alpha",
    markScheme: ["Alpha is correct because..."],
    explanation: "Hidden MCQ explanation",
  },
  lessonEdit: null,
};

const shortAttachment: PracticeQuestionAttachment = {
  questionId: "short-1",
  slotIndex: 1,
  editable: true,
  hasLessonEdit: false,
  available: true,
  master: {
    id: "short-1",
    question: "Bank short stem?",
    type: "short",
    marks: 3,
    markScheme: ["Point one", "Point two"],
    correctAnswer: "Model answer text",
    explanation: "Hidden short explanation",
  },
  effective: {
    id: "short-1",
    question: "Bank short stem?",
    type: "short",
    marks: 3,
    markScheme: ["Point one", "Point two"],
    correctAnswer: "Model answer text",
    explanation: "Hidden short explanation",
  },
  lessonEdit: null,
};

const editedMcqAttachment: PracticeQuestionAttachment = {
  ...mcqAttachment,
  questionId: "mcq-edited",
  hasLessonEdit: true,
  effective: {
    ...mcqAttachment.effective!,
    question: "Edited MCQ stem?",
    marks: 4,
  },
  lessonEdit: {
    type: "mcq",
    question: "Edited MCQ stem?",
    marks: 4,
    options: ["Alpha", "Beta", "Gamma"],
    correctAnswer: "Beta",
  },
};

const unsupportedAttachment: PracticeQuestionAttachment = {
  questionId: "composite-1",
  slotIndex: 0,
  editable: false,
  unsupportedReason: "This question type is managed in the Question Bank.",
  hasLessonEdit: false,
  available: true,
  master: {
    id: "composite-1",
    question: "Composite stem",
    type: "composite",
    marks: 4,
  },
  effective: {
    id: "composite-1",
    question: "Composite stem",
    type: "composite",
    marks: 4,
  },
  lessonEdit: null,
};

const unavailableAttachment: PracticeQuestionAttachment = {
  questionId: "missing-1",
  slotIndex: 3,
  editable: false,
  unsupportedReason: "Question unavailable — remove from lesson",
  hasLessonEdit: false,
  available: false,
  master: null,
  effective: null,
  lessonEdit: null,
};

function renderEditor(
  attachments: PracticeQuestionAttachment[],
  opts: {
    pendingEdits?: PendingPracticeQuestionEditsMap;
    onUpsert?: jest.Mock;
    onClear?: jest.Mock;
    onDiscard?: jest.Mock;
    onRemove?: jest.Mock;
    onAddFromQuestionBank?: jest.Mock;
    onAutoSelectQuestions?: jest.Mock;
    autoSelectLoading?: boolean;
  } = {}
) {
  const onUpsert = opts.onUpsert ?? jest.fn();
  const onClear = opts.onClear ?? jest.fn();
  const onDiscard = opts.onDiscard ?? jest.fn();
  const onRemove = opts.onRemove ?? jest.fn();
  const onAddFromQuestionBank = opts.onAddFromQuestionBank ?? jest.fn();
  const onAutoSelectQuestions = opts.onAutoSelectQuestions ?? jest.fn();
  render(
    <PracticeQuestionsEditor
      attachments={attachments}
      pendingEdits={opts.pendingEdits ?? {}}
      onUpsertLessonEdit={onUpsert}
      onClearLessonEdit={onClear}
      onDiscardPendingEdit={onDiscard}
      onRemoveQuestion={onRemove}
      onAddFromQuestionBank={onAddFromQuestionBank}
      onAutoSelectQuestions={onAutoSelectQuestions}
      autoSelectLoading={opts.autoSelectLoading}
    />
  );
  return {
    onUpsert,
    onClear,
    onDiscard,
    onRemove,
    onAddFromQuestionBank,
    onAutoSelectQuestions,
  };
}

describe("PracticeQuestionsEditor", () => {
  test("empty state shows guidance and action buttons", () => {
    renderEditor([]);
    expect(screen.getByText("No practice questions added yet.")).toBeInTheDocument();
    expect(
      screen.getByText("Add questions for students to practise at the end of the lesson.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add from Question Bank" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Auto-select questions" })).toBeInTheDocument();
    expect(screen.queryByText(/Auto-attach/i)).not.toBeInTheDocument();
  });

  test("empty state Add from Question Bank calls supplied handler", () => {
    const { onAddFromQuestionBank } = renderEditor([]);
    fireEvent.click(screen.getByRole("button", { name: "Add from Question Bank" }));
    expect(onAddFromQuestionBank).toHaveBeenCalledTimes(1);
  });

  test("empty state Auto-select questions calls supplied handler", () => {
    const { onAutoSelectQuestions } = renderEditor([]);
    fireEvent.click(screen.getByRole("button", { name: "Auto-select questions" }));
    expect(onAutoSelectQuestions).toHaveBeenCalledTimes(1);
  });

  test("non-empty state hides empty-state buttons", () => {
    renderEditor([mcqAttachment]);
    expect(screen.queryByText("No practice questions added yet.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auto-select questions" })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Bank MCQ stem?")).toBeInTheDocument();
  });

  test("attachment order maps to Q1–Qn tabs", () => {
    renderEditor([mcqAttachment, shortAttachment]);
    expect(screen.getByRole("button", { name: "Q1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Q2" })).toBeInTheDocument();
  });

  test("MCQ effective values render", () => {
    renderEditor([mcqAttachment]);
    expect(screen.getByDisplayValue("Bank MCQ stem?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alpha")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Beta")).toBeInTheDocument();
  });

  test("short shows question, marks, and mark-scheme rows only", () => {
    renderEditor([shortAttachment]);
    expect(screen.getByDisplayValue("Bank short stem?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Point one")).toBeInTheDocument();
    expect(screen.getByLabelText("Marks")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Model answer text")).not.toBeInTheDocument();
    expect(screen.queryByText(/Explanation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Question type/i)).not.toBeInTheDocument();
  });

  test("MCQ hides explanation and mark-scheme UI", () => {
    renderEditor([mcqAttachment]);
    expect(screen.queryByText(/Explanation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mark scheme/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Question type/i)).not.toBeInTheDocument();
  });

  test("editing MCQ creates lesson-edit intent", () => {
    const { onUpsert } = renderEditor([mcqAttachment]);
    fireEvent.change(screen.getByDisplayValue("Bank MCQ stem?"), {
      target: { value: "Teacher MCQ edit" },
    });
    expect(onUpsert).toHaveBeenCalledWith(
      "mcq-1",
      expect.objectContaining({
        type: "mcq",
        question: "Teacher MCQ edit",
      })
    );
  });

  test("editing MCQ question preserves hidden explanation and markScheme", () => {
    const { onUpsert } = renderEditor([mcqAttachment]);
    fireEvent.change(screen.getByDisplayValue("Bank MCQ stem?"), {
      target: { value: "Teacher MCQ edit" },
    });
    expect(onUpsert).toHaveBeenCalledWith(
      "mcq-1",
      expect.objectContaining({
        explanation: "Hidden MCQ explanation",
        markScheme: ["Alpha is correct because..."],
      })
    );
  });

  test("editing short mark scheme preserves hidden model answer and explanation", () => {
    const { onUpsert } = renderEditor([shortAttachment]);
    fireEvent.change(screen.getByDisplayValue("Point one"), {
      target: { value: "Updated point" },
    });
    expect(onUpsert).toHaveBeenCalledWith(
      "short-1",
      expect.objectContaining({
        type: "short",
        markScheme: expect.arrayContaining(["Updated point"]),
        correctAnswer: "Model answer text",
        explanation: "Hidden short explanation",
      })
    );
  });

  test("editing option preserves valid correct answer behaviour", () => {
    const { onUpsert } = renderEditor([mcqAttachment]);
    const betaInput = screen.getByDisplayValue("Beta");
    fireEvent.change(betaInput, { target: { value: "Beta revised" } });
    expect(onUpsert).toHaveBeenCalledWith(
      "mcq-1",
      expect.objectContaining({
        options: expect.arrayContaining(["Beta revised"]),
        correctAnswer: "Alpha",
      })
    );
  });

  test("selecting different MCQ correct answer works", () => {
    const { onUpsert } = renderEditor([mcqAttachment]);
    fireEvent.click(screen.getByLabelText("Mark option 2 as correct"));
    expect(onUpsert).toHaveBeenCalledWith(
      "mcq-1",
      expect.objectContaining({
        correctAnswer: "Beta",
      })
    );
  });

  test("short add mark point triggers edit save intent", () => {
    const { onUpsert } = renderEditor([shortAttachment]);
    fireEvent.click(screen.getByRole("button", { name: "+ Add mark point" }));
    expect(onUpsert).toHaveBeenCalledWith(
      "short-1",
      expect.objectContaining({
        type: "short",
        markScheme: expect.arrayContaining(["Point one", "Point two"]),
      })
    );
  });

  test("short remove mark point works", () => {
    const { onUpsert } = renderEditor([shortAttachment]);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove mark point" })[0]);
    expect(onUpsert).toHaveBeenCalledWith(
      "short-1",
      expect.objectContaining({
        markScheme: ["Point two"],
        correctAnswer: "Model answer text",
      })
    );
  });

  test("Undo pending edit restores base via discard intent", () => {
    const pending = {
      "mcq-1": {
        action: "upsert" as const,
        lessonEdit: {
          type: "mcq" as const,
          question: "Pending only",
          marks: 2,
          options: ["Alpha", "Beta", "Gamma"],
          correctAnswer: "Alpha",
        },
      },
    };
    const { onDiscard } = renderEditor([mcqAttachment], { pendingEdits: pending });
    fireEvent.click(screen.getByRole("button", { name: "Undo Edit" }));
    expect(onDiscard).toHaveBeenCalledWith("mcq-1");
  });

  test("Undo persisted edit emits clear intent", () => {
    const { onClear } = renderEditor([editedMcqAttachment]);
    fireEvent.click(screen.getByRole("button", { name: "Undo Edit" }));
    expect(onClear).toHaveBeenCalledWith("mcq-edited");
  });

  test("Remove Question is distinct from Undo Edit", () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    const { onRemove } = renderEditor([editedMcqAttachment]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Question" }));
    expect(onRemove).toHaveBeenCalledWith("mcq-edited");
    expect(screen.getByRole("button", { name: "Undo Edit" })).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  test("unsupported type shows concise Question Bank message only", () => {
    renderEditor([unsupportedAttachment]);
    expect(
      screen.getByText("This question is managed in the Question Bank.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Question" })).toBeInTheDocument();
    expect(screen.getByText("Not shown to students")).toBeInTheDocument();
  });

  test("missing master shows unavailable message", () => {
    renderEditor([unavailableAttachment]);
    expect(
      screen.getByText("Question unavailable — remove from lesson")
    ).toBeInTheDocument();
  });

  test("missing master tab says Unavailable, not Not shown", () => {
    renderEditor([unavailableAttachment, mcqAttachment]);
    expect(screen.getByRole("button", { name: /Q1 · Unavailable/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Q1 · Not shown/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Q2 · Student Q1/ })).toBeInTheDocument();
  });

  test(">10 student-visible note appears only when more than 10 shown questions", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      ...mcqAttachment,
      questionId: `mcq-${i}`,
      slotIndex: i,
    }));
    renderEditor(many);
    expect(
      screen.getByText("Students see the first 10 questions they can answer, in this order.")
    ).toBeInTheDocument();
  });

  test(">10 note hidden when many attachments include non-student-visible items", () => {
    const mixed = [
      unsupportedAttachment,
      ...Array.from({ length: 10 }, (_, i) => ({
        ...mcqAttachment,
        questionId: `mcq-${i}`,
        slotIndex: i + 1,
      })),
    ];
    renderEditor(mixed);
    expect(
      screen.queryByText("Students see the first 10 questions they can answer, in this order.")
    ).not.toBeInTheDocument();
  });

  test("student-hidden attachment is labelled on tab", () => {
    renderEditor([unsupportedAttachment, mcqAttachment]);
    expect(screen.getByRole("button", { name: /Q1 · Not shown/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Q2 · Student Q1/ })).toBeInTheDocument();
  });

  test("student numbering offset shown when first attachment hidden", () => {
    renderEditor([unsupportedAttachment, mcqAttachment]);
    expect(screen.getByRole("button", { name: /Q2 · Student Q1/ })).toBeInTheDocument();
  });

  test("edited state says Your edited question", () => {
    renderEditor([editedMcqAttachment]);
    expect(screen.getByText("Your edited question")).toBeInTheDocument();
  });

  test("unedited state says Question from bank — edit to customise", () => {
    renderEditor([mcqAttachment]);
    expect(screen.getByText("Question from bank — edit to customise")).toBeInTheDocument();
  });
});
