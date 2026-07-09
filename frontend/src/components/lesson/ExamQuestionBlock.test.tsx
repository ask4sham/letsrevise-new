import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExamQuestionBlock } from "./ExamQuestionBlock";
import type { ExamQuestion } from "../../api/examQuestions";

jest.mock("./ZoomableImageLightbox", () => ({
  ZoomableImageTrigger: ({
    alt,
    src,
    imageClassName,
  }: {
    alt: string;
    src: string;
    imageClassName?: string;
  }) => <img alt={alt} src={src} className={imageClassName} data-testid="zoomable-image" />,
}));

const MCQ_QUESTION: ExamQuestion = {
  _id: "exam-mcq-1",
  question: "Which organelle releases energy?",
  type: "mcq",
  options: ["Nucleus", "Mitochondria", "Ribosome"],
  correctIndex: 1,
  marks: 1,
  markScheme: [
    "Correct answer: B — Mitochondria",
    "Why A is wrong: The nucleus controls the cell, it does not release energy.",
    "Memory rule: Mitochondria are the powerhouse of the cell.",
  ],
  metadata: {
    modelAnswer: "Mitochondria release energy through aerobic respiration.",
  },
};

const SHORT_QUESTION: ExamQuestion = {
  _id: "exam-short-1",
  question: "Describe what happens during mitosis.",
  type: "short",
  marks: 4,
  markScheme: [
    "DNA replicates before mitosis",
    "Chromosomes line up at the equator",
    "Chromosomes are pulled to opposite poles",
    "Two genetically identical daughter cells are formed",
  ],
  metadata: {
    modelAnswer:
      "DNA replicates, chromosomes line up, are pulled apart, and two identical cells form.",
  },
};

const COMPOSITE_QUESTION: ExamQuestion = {
  _id: "exam-composite-1",
  questionMode: "composite",
  type: "composite",
  question: "Read the information about cell division.",
  sharedStem: "Read the information about cell division.",
  totalMarks: 3,
  parts: [
    {
      label: "a",
      type: "mcq",
      marks: 1,
      questionText: "Which phase comes first?",
      options: ["Prophase", "Metaphase"],
      correctIndex: 0,
      markScheme: ["Correct answer: A — Prophase"],
    },
    {
      label: "b",
      type: "short",
      marks: 2,
      questionText: "Name one change in prophase.",
      markScheme: ["Chromosomes condense", "Nuclear envelope breaks down"],
    },
  ],
};

describe("ExamQuestionBlock single question marking", () => {
  test("single MCQ marks correct answer 1/1 with shared feedback panel", () => {
    render(<ExamQuestionBlock question={MCQ_QUESTION} mode="student" />);
    fireEvent.click(screen.getByRole("button", { name: "Mitochondria" }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    expect(screen.getByTestId("answer-feedback-hero")).toHaveTextContent(/Correct/i);
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/1 \/ 1 marks/i);
    expect(screen.getByTestId("answer-feedback-panel")).toHaveAttribute("data-status", "correct");
  });

  test("single MCQ marks wrong answer 0/1 with green/red styling", () => {
    render(<ExamQuestionBlock question={MCQ_QUESTION} mode="student" />);
    fireEvent.click(screen.getByRole("button", { name: "Nucleus" }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    expect(screen.getByTestId("answer-feedback-hero")).toHaveTextContent(/Incorrect/i);
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/0 \/ 1 marks/i);
    expect(screen.getByTestId("answer-feedback-correct-answer")).toBeInTheDocument();
    expect(screen.getByText(/why your answer is wrong/i)).toBeInTheDocument();
  });

  test("single short answer awards partial marks and shows missing points", () => {
    render(<ExamQuestionBlock question={SHORT_QUESTION} mode="student" />);
    fireEvent.change(screen.getByPlaceholderText(/write your answer here/i), {
      target: { value: "DNA replicates before mitosis" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    expect(screen.getByTestId("answer-feedback-hero")).toHaveTextContent(/Partially correct/i);
    expect(screen.getByTestId("answer-feedback-panel")).toHaveAttribute("data-status", "partial");
    expect(screen.getByText(/Mark scheme points matched/i)).toBeInTheDocument();
    expect(screen.getByText(/Still needed for full marks/i)).toBeInTheDocument();
    expect(screen.getByTestId("answer-feedback-tip")).toHaveTextContent(/Revise:/i);
  });

  test("student reveal is disabled until single short answer is checked", () => {
    render(<ExamQuestionBlock question={SHORT_QUESTION} mode="student" />);
    const revealBtn = screen.getByTestId("exam-question-reveal-btn");
    expect(revealBtn).toBeDisabled();
    expect(revealBtn).toHaveAttribute("title", "Check your answer first.");

    fireEvent.change(screen.getByPlaceholderText(/write your answer here/i), {
      target: { value: "DNA replicates" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(revealBtn).not.toBeDisabled();

    fireEvent.click(revealBtn);
    const revealPanel = document.querySelector(".exam-question-block__reveal");
    expect(revealPanel).toHaveTextContent(/DNA replicates before mitosis/i);
    expect(revealPanel).toHaveTextContent(/two identical cells form/i);
  });

  test("student reveal is disabled until single MCQ is checked", () => {
    render(<ExamQuestionBlock question={MCQ_QUESTION} mode="student" />);
    const revealBtn = screen.getByTestId("exam-question-reveal-btn");
    expect(revealBtn).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /^Mitochondria$/i }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(revealBtn).not.toBeDisabled();

    fireEvent.click(revealBtn);
    expect(screen.getByText(/Correct answer: B — Mitochondria/i)).toBeInTheDocument();
  });

  test("editor preview does not show Check answer for MCQ", () => {
    render(<ExamQuestionBlock question={MCQ_QUESTION} mode="editor" />);
    expect(screen.queryByRole("button", { name: /check answer/i })).not.toBeInTheDocument();
  });

  test("editor preview keeps reveal enabled without checking", () => {
    render(<ExamQuestionBlock question={SHORT_QUESTION} mode="editor" />);
    const revealBtn = screen.getByTestId("exam-question-reveal-btn");
    expect(revealBtn).not.toBeDisabled();
    fireEvent.click(revealBtn);
    expect(document.querySelector(".exam-question-block__reveal")).toBeInTheDocument();
  });
});

describe("ExamQuestionBlock composite question marking", () => {
  test("part (a) MCQ marks correctly with per-part feedback", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="student" />);
    fireEvent.click(screen.getByRole("radio", { name: /Prophase/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /check answer/i })[0]);

    expect(screen.getByTestId("exam-composite-part-marking-0")).toBeInTheDocument();
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/1 \/ 1 marks/i);
    expect(screen.getByTestId("exam-composite-total-score")).toHaveTextContent(/1 \/ 3 marks/i);
  });

  test("part (b) written answer marks partially with feedback", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="student" />);
    fireEvent.change(screen.getByRole("textbox", { name: /your answer/i }), {
      target: { value: "Chromosomes condense" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /check answer/i })[1]);

    expect(screen.getByTestId("exam-composite-part-marking-1")).toBeInTheDocument();
    expect(screen.getByTestId("answer-feedback-panel")).toHaveAttribute("data-status", "partial");
    expect(screen.getByText(/Still needed for full marks/i)).toBeInTheDocument();
  });

  test("total score updates when multiple parts are checked", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="student" />);
    fireEvent.click(screen.getByRole("radio", { name: /Prophase/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /your answer/i }), {
      target: { value: "Chromosomes condense" },
    });
    fireEvent.click(screen.getByTestId("exam-composite-check-all-btn"));

    const summary = screen.getByTestId("exam-composite-result-summary");
    expect(summary).toHaveTextContent(/📝 Exam question result/i);
    expect(screen.getByTestId("exam-composite-overall-score")).toHaveTextContent(/2 \/ 3 marks/i);
    expect(summary).toHaveTextContent(/Strengths/i);
    expect(summary).toHaveTextContent(/Focus your revision/i);
    expect(summary).toHaveTextContent(/Chromosomes condense/i);
    expect(summary).toHaveTextContent(/Nuclear envelope breaks down/i);
  });

  test("student reveal stays disabled until all composite parts are checked", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="student" />);
    const revealBtn = screen.getByTestId("exam-composite-reveal-btn");
    expect(revealBtn).toBeDisabled();
    expect(revealBtn).toHaveAttribute("title", "Check your answer first.");

    fireEvent.click(screen.getByRole("radio", { name: /Prophase/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /check answer/i })[0]);
    expect(revealBtn).toBeDisabled();
    expect(document.querySelector(".exam-composite__reveal")).not.toBeInTheDocument();

    // Filled-in answers alone must not unlock reveal — gate is checked, not merely answered.
    fireEvent.change(screen.getByRole("textbox", { name: /your answer/i }), {
      target: { value: "Chromosomes condense" },
    });
    expect(revealBtn).toBeDisabled();
    expect(document.querySelector(".exam-composite__reveal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("exam-composite-check-all-btn"));
    expect(revealBtn).not.toBeDisabled();

    fireEvent.click(revealBtn);
    expect(document.querySelector(".exam-composite__reveal")).toHaveTextContent(/Correct answer:/i);
    expect(document.querySelector(".exam-composite__reveal")).toHaveTextContent(/Chromosomes condense/i);
  });

  test("editor preview has no composite marking controls", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="editor" />);
    expect(screen.queryByRole("button", { name: /check answer/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("exam-composite-total-score")).not.toBeInTheDocument();
    expect(screen.queryByTestId("exam-composite-result-summary")).not.toBeInTheDocument();
  });

  test("editor composite reveal stays enabled without checking", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="editor" />);
    const revealBtn = screen.getByTestId("exam-composite-reveal-btn");
    expect(revealBtn).not.toBeDisabled();
    fireEvent.click(revealBtn);
    expect(document.querySelector(".exam-composite__reveal")).toBeInTheDocument();
  });

  test("classroom mode has no composite marking controls and reveal stays enabled", () => {
    render(<ExamQuestionBlock question={COMPOSITE_QUESTION} mode="classroom" />);
    expect(screen.queryByRole("button", { name: /check answer/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("exam-composite-result-summary")).not.toBeInTheDocument();
    const revealBtn = screen.getByTestId("exam-composite-reveal-btn");
    expect(revealBtn).not.toBeDisabled();
  });
});

describe("ExamQuestionBlock inline exam images", () => {
  const DISPLAY_URL = "https://cdn.example.com/exam-questions/fetus-in-uterus.display.png";
  const ORIGINAL_URL = "https://cdn.example.com/exam-questions/fetus-in-uterus.png";

  test("single exam question uses original .png inline when stored URL is .display.png", () => {
    render(
      <ExamQuestionBlock
        question={{ ...SHORT_QUESTION, imageUrl: DISPLAY_URL }}
        mode="student"
      />
    );
    const img = screen.getByTestId("zoomable-image");
    expect(img).toHaveAttribute("src", ORIGINAL_URL);
    expect(img.getAttribute("src")).not.toContain(".display.png");
  });

  test("single exam question leaves non-display image URL unchanged", () => {
    render(
      <ExamQuestionBlock
        question={{ ...SHORT_QUESTION, imageUrl: ORIGINAL_URL }}
        mode="student"
      />
    );
    expect(screen.getByTestId("zoomable-image")).toHaveAttribute("src", ORIGINAL_URL);
  });

  test("composite exam question uses original .png inline when stored URL is .display.png", () => {
    render(
      <ExamQuestionBlock
        question={{ ...COMPOSITE_QUESTION, imageUrl: DISPLAY_URL }}
        mode="student"
      />
    );
    const img = screen.getByTestId("zoomable-image");
    expect(img).toHaveAttribute("src", ORIGINAL_URL);
    expect(img).toHaveClass("exam-composite__image");
  });
});
