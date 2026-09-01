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
  },
  effective: {
    id: "mcq-1",
    question: "Bank MCQ stem?",
    type: "mcq",
    marks: 2,
    options: ["Alpha", "Beta", "Gamma"],
    correctAnswer: "Alpha",
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
    correctAnswer: "Model",
  },
  effective: {
    id: "short-1",
    question: "Bank short stem?",
    type: "short",
    marks: 3,
    markScheme: ["Point one", "Point two"],
    correctAnswer: "Model",
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
  slotIndex: 2,
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
  } = {}
) {
  const onUpsert = opts.onUpsert ?? jest.fn();
  const onClear = opts.onClear ?? jest.fn();
  const onDiscard = opts.onDiscard ?? jest.fn();
  const onRemove = opts.onRemove ?? jest.fn();
  render(
    <PracticeQuestionsEditor
      attachments={attachments}
      pendingEdits={opts.pendingEdits ?? {}}
      onUpsertLessonEdit={onUpsert}
      onClearLessonEdit={onClear}
      onDiscardPendingEdit={onDiscard}
      onRemoveQuestion={onRemove}
    />
  );
  return { onUpsert, onClear, onDiscard, onRemove };
}

describe("PracticeQuestionsEditor", () => {
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

  test("short effective values render", () => {
    renderEditor([mcqAttachment, shortAttachment]);
    fireEvent.click(screen.getByRole("button", { name: "Q2" }));
    expect(screen.getByDisplayValue("Bank short stem?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Point one")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Model")).toBeInTheDocument();
  });

  test("question type is visible but not editable", () => {
    renderEditor([mcqAttachment]);
    expect(screen.getByText("Multiple choice (MCQ)")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/question type/i)).not.toBeInTheDocument();
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

  test("short markScheme editing works", () => {
    const { onUpsert } = renderEditor([shortAttachment]);
    fireEvent.change(screen.getByDisplayValue("Point one"), {
      target: { value: "Updated point" },
    });
    expect(onUpsert).toHaveBeenCalledWith(
      "short-1",
      expect.objectContaining({
        type: "short",
        markScheme: expect.arrayContaining(["Updated point"]),
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

  test("unsupported type is read-only", () => {
    renderEditor([unsupportedAttachment]);
    fireEvent.click(screen.getByRole("button", { name: "Q1" }));
    expect(
      screen.getByText("This question type is managed in the Question Bank.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /question/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Question" })).toBeInTheDocument();
  });

  test("missing master shows unavailable message", () => {
    renderEditor([unavailableAttachment]);
    expect(
      screen.getByText("Question unavailable — remove from lesson")
    ).toBeInTheDocument();
  });

  test(">10 note appears", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      ...mcqAttachment,
      questionId: `mcq-${i}`,
      slotIndex: i,
    }));
    renderEditor(many);
    expect(
      screen.getByText("Students see the first 10 questions in this order.")
    ).toBeInTheDocument();
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
