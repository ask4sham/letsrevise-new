import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QuizView, type QuizQuestion } from "./QuizView";

jest.mock("../ai/ExplainMyMistakeButton", () => ({
  ExplainMyMistakeButton: () => null,
}));

const MCQ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    type: "mcq",
    question: "Which organelle releases energy?",
    options: ["Nucleus", "Mitochondria", "Ribosome"],
    correctAnswer: "Mitochondria",
    explanation: "Mitochondria release energy through aerobic respiration.",
    marks: 1,
  },
  {
    id: "q2",
    type: "mcq",
    question: "Which is haploid?",
    options: ["Skin cell", "Sperm cell"],
    correctAnswer: "Sperm cell",
    marks: 1,
  },
];

function expectInlineValueTone(testId: string, tone: "correct" | "incorrect") {
  const row = screen.getByTestId(testId);
  expect(
    within(row).getByText(
      (_content, element) =>
        !!element &&
        element.classList.contains(`answer-feedback-panel__value-text--${tone}`)
    )
  ).toBeInTheDocument();
}

describe("QuizView MCQ feedback", () => {
  test("shows shared feedback panel with correct marks for a correct answer", () => {
    render(<QuizView questions={[MCQ_QUESTIONS[0]]} title="Quiz" />);
    fireEvent.click(screen.getByLabelText("Mitochondria"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    expect(screen.getByTestId("answer-feedback-hero")).toHaveTextContent(/Correct/i);
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/1 \/ 1 marks/i);
    expect(screen.getByTestId("answer-feedback-your-answer")).toHaveTextContent(/✅ Your answer:/);
    expectInlineValueTone("answer-feedback-your-answer", "correct");
    expect(screen.getByText(/why this is correct/i)).toBeInTheDocument();
  });

  test("shows red selected option, green correct option, and structured incorrect feedback", () => {
    render(<QuizView questions={[MCQ_QUESTIONS[0]]} title="Quiz" />);
    fireEvent.click(screen.getByLabelText("Nucleus"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    expect(screen.getByTestId("answer-feedback-hero")).toHaveTextContent(/Incorrect/i);
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/0 \/ 1 marks/i);
    expect(screen.getByTestId("answer-feedback-your-answer")).toHaveTextContent(/❌ Your answer:/);
    expectInlineValueTone("answer-feedback-your-answer", "incorrect");
    expect(screen.getByTestId("answer-feedback-correct-answer")).toHaveTextContent(/✅ Correct answer:/);
    expectInlineValueTone("answer-feedback-correct-answer", "correct");
    expect(screen.getByText(/why your answer is wrong/i)).toBeInTheDocument();
    expect(screen.getByTestId("answer-feedback-tip")).toHaveTextContent(/Revise this concept/i);
  });

  test("reset clears feedback and next question starts clean", () => {
    render(<QuizView questions={MCQ_QUESTIONS} title="Quiz" />);
    fireEvent.click(screen.getByLabelText("Nucleus"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(screen.getByTestId("answer-feedback-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(screen.queryByTestId("answer-feedback-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.queryByTestId("answer-feedback-panel")).not.toBeInTheDocument();
    expect(screen.getByText(/Which is haploid/i)).toBeInTheDocument();
  });

  test("calls onQuestionAnswered with true when MCQ is correct", () => {
    const onQuestionAnswered = jest.fn();
    render(<QuizView questions={[MCQ_QUESTIONS[0]]} onQuestionAnswered={onQuestionAnswered} />);
    fireEvent.click(screen.getByLabelText("Mitochondria"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(onQuestionAnswered).toHaveBeenCalledWith(true);
  });

  test("calls onQuestionAnswered with false when MCQ is incorrect", () => {
    const onQuestionAnswered = jest.fn();
    render(<QuizView questions={[MCQ_QUESTIONS[0]]} onQuestionAnswered={onQuestionAnswered} />);
    fireEvent.click(screen.getByLabelText("Nucleus"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(onQuestionAnswered).toHaveBeenCalledWith(false);
  });
});

describe("QuizView revision completion signal", () => {
  function answerAllAndFinish() {
    fireEvent.click(screen.getByLabelText("Mitochondria"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByLabelText("Sperm cell"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /finish quiz/i }));
  }

  test("does not fire complete before Finish quiz", () => {
    const onQuizComplete = jest.fn();
    render(<QuizView questions={MCQ_QUESTIONS} onQuizComplete={onQuizComplete} />);
    fireEvent.click(screen.getByLabelText("Mitochondria"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(onQuizComplete).not.toHaveBeenCalled();
    expect(screen.queryByText(/Quiz complete/i)).toBeNull();
  });

  test("Finish quiz fires onQuizComplete once and shows complete screen", () => {
    const onQuizComplete = jest.fn();
    render(<QuizView questions={MCQ_QUESTIONS} onQuizComplete={onQuizComplete} />);
    answerAllAndFinish();
    expect(screen.getByText(/Quiz complete/i)).toBeInTheDocument();
    expect(onQuizComplete).toHaveBeenCalledTimes(1);
    expect(onQuizComplete.mock.calls[0][0].questionCount).toBe(2);
  });

  test("Retry quiz clears completion via onQuizReset", () => {
    const onQuizReset = jest.fn();
    render(<QuizView questions={MCQ_QUESTIONS} onQuizReset={onQuizReset} />);
    answerAllAndFinish();
    fireEvent.click(screen.getByRole("button", { name: /retry quiz/i }));
    expect(onQuizReset).toHaveBeenCalled();
    expect(screen.queryByText(/Quiz complete/i)).toBeNull();
  });

  test("completeExtra renders beneath Quiz complete", () => {
    render(
      <QuizView
        questions={MCQ_QUESTIONS}
        initialComplete
        completeExtra={<div data-testid="try-fresh-practice">Try 3 new questions</div>}
      />
    );
    expect(screen.getByText(/Quiz complete/i)).toBeInTheDocument();
    expect(screen.getByTestId("try-fresh-practice")).toBeInTheDocument();
  });
});
