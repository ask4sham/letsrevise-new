import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExamQuestionBlock } from "./ExamQuestionBlock";
import type { ExamQuestion } from "../../api/examQuestions";

jest.mock("./ZoomableImageLightbox", () => ({
  ZoomableImageTrigger: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} data-testid="zoomable-image" />
  ),
}));

jest.mock("./examComposite/featureFlags", () => {
  const actual = jest.requireActual("./examComposite/featureFlags");
  return {
    ...actual,
    isCompositePartTypeEnabled: (partType: string) => {
      if (partType === "table") return true;
      return actual.isCompositePartTypeEnabled(partType);
    },
  };
});

const TABLE_PART_DATA = {
  headers: ["Hormone", "Role"],
  rows: [
    {
      cells: [
        { value: "FSH", blank: false },
        { blank: true, correctAnswer: "Stimulates follicles" },
      ],
    },
    {
      cells: [
        { value: "LH", blank: false },
        { blank: true, correctAnswer: "Triggers ovulation" },
      ],
    },
  ],
};

const TABLE_COMPOSITE: ExamQuestion = {
  _id: "exam-composite-table",
  questionMode: "composite",
  type: "composite",
  schemaVersion: 2,
  question: "The table shows hormones in the menstrual cycle.",
  sharedStem: "The table shows hormones in the menstrual cycle.",
  totalMarks: 2,
  parts: [
    {
      label: "a",
      type: "table",
      marks: 2,
      questionText: "Complete the table.",
      markScheme: ["FSH stimulates follicles", "LH triggers ovulation"],
      partData: TABLE_PART_DATA,
    },
  ],
};

const MIXED_COMPOSITE: ExamQuestion = {
  _id: "exam-composite-mixed",
  questionMode: "composite",
  type: "composite",
  schemaVersion: 2,
  question: "Read the information about hormones.",
  sharedStem: "Read the information about hormones.",
  totalMarks: 4,
  parts: [
    {
      label: "a",
      type: "mcq",
      marks: 1,
      questionText: "Which hormone triggers ovulation?",
      options: ["FSH", "LH"],
      correctIndex: 1,
      markScheme: ["Correct answer: B — LH"],
    },
    {
      label: "b",
      type: "table",
      marks: 2,
      questionText: "Complete the table.",
      markScheme: ["FSH stimulates follicles", "LH triggers ovulation"],
      partData: TABLE_PART_DATA,
    },
    {
      label: "c",
      type: "short",
      marks: 1,
      questionText: "Name the gland that secretes FSH.",
      markScheme: ["Pituitary gland"],
    },
  ],
};

describe("ExamQuestionBlock table composite (TABLE_PARTS_ENABLED ON)", () => {
  test("renders table with editable blank cells", () => {
    render(<ExamQuestionBlock question={TABLE_COMPOSITE} mode="student" />);

    expect(screen.getByTestId("exam-composite-table-0")).toBeInTheDocument();
    expect(screen.getByText("Hormone")).toBeInTheDocument();
    expect(screen.getByTestId("exam-composite-table-input-0-0-1")).toBeInTheDocument();
    expect(screen.getByTestId("exam-composite-table-input-0-1-1")).toBeInTheDocument();
  });

  test("marks table part with feedback panel", () => {
    render(<ExamQuestionBlock question={TABLE_COMPOSITE} mode="student" />);

    fireEvent.change(screen.getByTestId("exam-composite-table-input-0-0-1"), {
      target: { value: "Stimulates follicles" },
    });
    fireEvent.change(screen.getByTestId("exam-composite-table-input-0-1-1"), {
      target: { value: "Triggers ovulation" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    expect(screen.getByTestId("exam-composite-part-marking-0")).toBeInTheDocument();
    expect(screen.getByTestId("answer-feedback-hero")).toHaveTextContent(/Correct/i);
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/2 \/ 2 marks/i);
  });

  test("reveal answers shows table correct cells and mark scheme", () => {
    render(<ExamQuestionBlock question={TABLE_COMPOSITE} mode="student" />);
    fireEvent.click(screen.getByRole("button", { name: /reveal answers \/ mark scheme/i }));

    const reveal = document.querySelector(".exam-composite__reveal");
    expect(reveal).toHaveTextContent(/Correct cell answers/i);
    expect(reveal).toHaveTextContent(/Stimulates follicles/i);
    expect(reveal).toHaveTextContent(/Triggers ovulation/i);
    expect(reveal).toHaveTextContent(/FSH stimulates follicles/i);
  });

  test("mixed composite: MCQ → Table → Short all render and mark", () => {
    render(<ExamQuestionBlock question={MIXED_COMPOSITE} mode="student" />);

    expect(screen.getByRole("radio", { name: /LH/i })).toBeInTheDocument();
    expect(screen.getByTestId("exam-composite-table-1")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /your answer/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /LH/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /check answer/i })[0]);
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/1 \/ 1 marks/i);

    fireEvent.change(screen.getByTestId("exam-composite-table-input-1-0-1"), {
      target: { value: "Stimulates follicles" },
    });
    fireEvent.change(screen.getByTestId("exam-composite-table-input-1-1-1"), {
      target: { value: "Triggers ovulation" },
    });
    expect(screen.getByTestId("exam-composite-table-input-1-0-1")).toHaveValue("Stimulates follicles");

    fireEvent.click(screen.getAllByRole("button", { name: /check answer/i })[0]);

    const tableMarking = screen.getByTestId("exam-composite-part-marking-1");
    expect(tableMarking).toBeInTheDocument();
    expect(tableMarking.querySelector('[data-testid="answer-feedback-score-badge"]')).toHaveTextContent(
      /2 \/ 2 marks/i
    );

    fireEvent.change(screen.getByRole("textbox", { name: /your answer/i }), {
      target: { value: "Pituitary gland" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /check answer/i })[0]);

    expect(screen.getByTestId("exam-composite-result-summary")).toBeInTheDocument();
    expect(screen.getByTestId("exam-composite-overall-score")).toHaveTextContent(/4 \/ 4 marks/i);
  });
});
