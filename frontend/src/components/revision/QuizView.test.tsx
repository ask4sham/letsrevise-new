import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

describe("QuizView MCQ feedback", () => {
  test("shows shared feedback panel with correct marks for a correct answer", () => {
    render(<QuizView questions={[MCQ_QUESTIONS[0]]} title="Quiz" />);
    fireEvent.click(screen.getByLabelText("Mitochondria"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    expect(screen.getByTestId("answer-feedback-hero")).toHaveTextContent(/Correct/i);
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/1 \/ 1 marks/i);
    expect(screen.getByTestId("answer-feedback-your-answer")).toHaveTextContent(/✅ Your answer:/);
    expect(screen.getByTestId("answer-feedback-your-answer").querySelector(".answer-feedback-panel__value-text--correct")).toBeTruthy();
    expect(screen.getByText(/why this is correct/i)).toBeInTheDocument();
  });

  test("shows red selected option, green correct option, and structured incorrect feedback", () => {
    render(<QuizView questions={[MCQ_QUESTIONS[0]]} title="Quiz" />);
    fireEvent.click(screen.getByLabelText("Nucleus"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    expect(screen.getByTestId("answer-feedback-hero")).toHaveTextContent(/Incorrect/i);
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/0 \/ 1 marks/i);
    expect(screen.getByTestId("answer-feedback-your-answer")).toHaveTextContent(/❌ Your answer:/);
    expect(screen.getByTestId("answer-feedback-your-answer").querySelector(".answer-feedback-panel__value-text--incorrect")).toBeTruthy();
    expect(screen.getByTestId("answer-feedback-correct-answer")).toHaveTextContent(/✅ Correct answer:/);
    expect(screen.getByTestId("answer-feedback-correct-answer").querySelector(".answer-feedback-panel__value-text--correct")).toBeTruthy();
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
