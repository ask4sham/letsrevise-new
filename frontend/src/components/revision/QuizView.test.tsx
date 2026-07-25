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
    const onContinueLesson = jest.fn();
    render(
      <QuizView
        questions={MCQ_QUESTIONS}
        onQuizComplete={onQuizComplete}
        onContinueLesson={onContinueLesson}
        completeExtra={<div data-testid="try-fresh-practice">Try another set</div>}
      />
    );
    answerAllAndFinish();
    expect(screen.getByText(/Quiz complete/i)).toBeInTheDocument();
    expect(screen.getByText(/Score:\s*2\s*\/\s*2/i)).toBeInTheDocument();
    expect(onQuizComplete).toHaveBeenCalledTimes(1);
    expect(onQuizComplete.mock.calls[0][0].questionCount).toBe(2);
    expect(onQuizComplete.mock.calls[0][0].score).toBe(2);
    expect(onQuizComplete.mock.calls[0][0].gradableCount).toBe(2);
    // Perfect: no retry / review; fresh set + continue + green card.
    expect(screen.queryByTestId("revision-try-again")).toBeNull();
    expect(screen.queryByTestId("revision-review-mistakes")).toBeNull();
    expect(screen.getByTestId("try-fresh-practice")).toBeInTheDocument();
    expect(screen.getByTestId("revision-continue-lesson")).toBeInTheDocument();
    expect(screen.getByTestId("revision-quiz-result-score")).toHaveTextContent("2/2");
    expect(screen.queryByText(/1 \/ 1\.0/)).toBeNull();
  });

  test("perfect score with no fresh CTA shows Continue lesson only among forward actions", () => {
    render(
      <QuizView
        questions={MCQ_QUESTIONS}
        initialComplete
        restoredResult={{ score: 2, questionCount: 2 }}
        onContinueLesson={() => undefined}
      />
    );
    expect(screen.getByTestId("revision-quiz-result-score")).toHaveTextContent("2/2");
    expect(screen.getByTestId("revision-quiz-result-card")).toHaveTextContent(/Great job/i);
    expect(screen.queryByTestId("revision-try-again")).toBeNull();
    expect(screen.queryByTestId("revision-review-mistakes")).toBeNull();
    expect(screen.queryByTestId("try-fresh-practice")).toBeNull();
    expect(screen.getByTestId("revision-continue-lesson")).toBeInTheDocument();
  });

  test("restoredResult shows saved score without answers", () => {
    render(
      <QuizView
        questions={MCQ_QUESTIONS}
        initialComplete
        restoredResult={{ score: 2, questionCount: 2 }}
      />
    );
    expect(screen.getByText(/Quiz complete/i)).toBeInTheDocument();
    expect(screen.getByText(/Score:\s*2\s*\/\s*2/i)).toBeInTheDocument();
    expect(screen.queryByText(/Score:\s*0\s*\/\s*2/i)).toBeNull();
    expect(screen.queryByTestId("revision-try-again")).toBeNull();
    expect(screen.getByTestId("revision-quiz-result-score")).toHaveTextContent("2/2");
  });

  test("legacy unknown restored score omits Score 0/N and green card", () => {
    render(
      <QuizView
        questions={MCQ_QUESTIONS}
        initialComplete
        restoredResult={{ score: null, questionCount: 2 }}
        onContinueLesson={() => undefined}
        completeExtra={<div data-testid="try-fresh-practice">Try another set</div>}
      />
    );
    expect(screen.getByText(/Quiz complete/i)).toBeInTheDocument();
    expect(screen.queryByText(/Score:/i)).toBeNull();
    expect(screen.queryByTestId("revision-try-again")).toBeNull();
    expect(screen.queryByTestId("revision-review-mistakes")).toBeNull();
    expect(screen.queryByTestId("try-fresh-practice")).toBeNull();
    expect(screen.queryByTestId("revision-quiz-result-card")).toBeNull();
    expect(screen.getByTestId("revision-continue-lesson")).toBeInTheDocument();
  });

  test("imperfect finish shows Review mistakes and Retry same quiz; retry clears via onQuizReset", () => {
    const onQuizReset = jest.fn();
    render(<QuizView questions={MCQ_QUESTIONS} onQuizReset={onQuizReset} />);
    fireEvent.click(screen.getByLabelText("Nucleus"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByLabelText("Sperm cell"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /finish quiz/i }));
    expect(screen.getByText(/Score:\s*1\s*\/\s*2/i)).toBeInTheDocument();
    expect(screen.getByTestId("revision-quiz-result-score")).toHaveTextContent("1/2");
    expect(screen.queryByText(/Great job — you understand this topic well/i)).toBeNull();
    expect(screen.getByTestId("revision-review-mistakes")).toBeInTheDocument();
    expect(screen.getByTestId("revision-try-again")).toHaveTextContent(/Retry same quiz/i);
    expect(screen.queryByTestId("try-fresh-practice")).toBeNull();
    fireEvent.click(screen.getByTestId("revision-try-again"));
    expect(onQuizReset).toHaveBeenCalled();
    expect(screen.queryByText(/Quiz complete/i)).toBeNull();
  });

  test("Review mistakes reopens first incorrect question without clearing answers", () => {
    const onQuizReset = jest.fn();
    render(<QuizView questions={MCQ_QUESTIONS} onQuizReset={onQuizReset} />);
    fireEvent.click(screen.getByLabelText("Nucleus"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByLabelText("Sperm cell"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /finish quiz/i }));
    fireEvent.click(screen.getByTestId("revision-review-mistakes"));
    expect(onQuizReset).not.toHaveBeenCalled();
    expect(screen.queryByText(/Quiz complete/i)).toBeNull();
    expect(screen.getByText(/Question 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Nucleus")).toBeChecked();
  });

  test("perfect restored score hides Retry and keeps completeExtra", () => {
    render(
      <QuizView
        questions={MCQ_QUESTIONS}
        initialComplete
        restoredResult={{ score: 2, questionCount: 2 }}
        completeExtra={<div data-testid="try-fresh-practice">Try another set</div>}
        onContinueLesson={() => undefined}
      />
    );
    expect(screen.queryByTestId("revision-try-again")).toBeNull();
    expect(screen.queryByTestId("revision-review-mistakes")).toBeNull();
    expect(screen.getByTestId("try-fresh-practice")).toBeInTheDocument();
    expect(screen.getByTestId("revision-continue-lesson")).toBeInTheDocument();
    expect(screen.getByTestId("revision-quiz-result-card")).toHaveTextContent(/Great job/i);
  });

  test("imperfect restored score shows Retry but not Review mistakes without live answers", () => {
    render(
      <QuizView
        questions={MCQ_QUESTIONS}
        initialComplete
        restoredResult={{ score: 1, questionCount: 2 }}
        onContinueLesson={() => undefined}
      />
    );
    expect(screen.getByTestId("revision-quiz-result-score")).toHaveTextContent("1/2");
    expect(screen.getByTestId("revision-try-again")).toHaveTextContent(/Retry same quiz/i);
    expect(screen.queryByTestId("revision-review-mistakes")).toBeNull();
    expect(screen.queryByText(/Great job — you understand this topic well/i)).toBeNull();
  });
});
