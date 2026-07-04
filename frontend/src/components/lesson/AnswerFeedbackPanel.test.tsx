import React from "react";
import { render, screen } from "@testing-library/react";
import { AnswerFeedbackPanel } from "./AnswerFeedbackPanel";

describe("AnswerFeedbackPanel", () => {
  test("renders correct state with marks", () => {
    render(
      <AnswerFeedbackPanel
        status="correct"
        marksAwarded={1}
        totalMarks={1}
        correctAnswer="B — 1"
        mcqFeedback={{ whyCorrect: "Haploid cell with one sex chromosome.", wrongOptionExplanations: [] }}
      />
    );
    expect(screen.getByTestId("answer-feedback-panel")).toHaveAttribute("data-status", "correct");
    expect(screen.getByText(/Correct — 1\/1/)).toBeInTheDocument();
    expect(screen.getByText(/Haploid cell with one sex chromosome/i)).toBeInTheDocument();
    expect(screen.getByText(/🎉 Why this is correct/i)).toBeInTheDocument();
  });

  test("renders incorrect state with wrong-answer explanation", () => {
    render(
      <AnswerFeedbackPanel
        status="incorrect"
        marksAwarded={0}
        totalMarks={1}
        correctAnswer="B — 1"
        mcqFeedback={{
          whySelectedWrong: "23 is the total number of chromosomes, not X chromosomes.",
          wrongOptionExplanations: [
            { label: "D", option: "23", explanation: "23 is the total number of chromosomes." },
          ],
        }}
        improvementTip="Revise: A sperm cell is haploid."
      />
    );
    expect(screen.getByText(/Incorrect — 0\/1/)).toBeInTheDocument();
    expect(screen.getByText(/23 is the total number of chromosomes, not X chromosomes/i)).toBeInTheDocument();
    expect(screen.getByText(/🔍 Why your answer is wrong/i)).toBeInTheDocument();
    expect(screen.getByTestId("answer-feedback-tip")).toHaveTextContent(/Revise:/i);
  });

  test("renders structured MCQ layout with your answer, correct answer, and revision target", () => {
    render(
      <AnswerFeedbackPanel
        layout="mcq"
        status="incorrect"
        marksAwarded={0}
        totalMarks={1}
        yourAnswer="D — 23"
        correctAnswer="B — 1"
        mcqFeedback={{
          whySelectedWrong: "23 is the total number of chromosomes, not X chromosomes.",
          wrongOptionExplanations: [],
        }}
        improvementTip="Revise: A sperm cell is haploid and contains one sex chromosome."
      />
    );
    expect(screen.getByText(/❌ Incorrect — 0\/1/)).toBeInTheDocument();
    expect(screen.getByTestId("answer-feedback-your-answer")).toHaveTextContent(/❌ Your answer/);
    expect(screen.getByTestId("answer-feedback-your-answer")).toHaveTextContent(/D — 23/);
    expect(screen.getByTestId("answer-feedback-correct-answer")).toHaveTextContent(/✅ Correct answer/);
    expect(screen.getByTestId("answer-feedback-correct-answer")).toHaveTextContent(/B — 1/);
    expect(screen.getByTestId("answer-feedback-why-wrong")).toHaveTextContent(/23 is the total number of chromosomes/i);
    expect(screen.getByTestId("answer-feedback-tip")).toHaveTextContent(/Revise this concept/i);
    expect(screen.getByTestId("answer-feedback-tip")).toHaveTextContent(/haploid/i);
    expect(screen.getByTestId("answer-feedback-your-answer").querySelector(".answer-feedback-panel__value-text--incorrect")).toBeTruthy();
    expect(screen.getByTestId("answer-feedback-correct-answer").querySelector(".answer-feedback-panel__value-text--correct")).toBeTruthy();
  });

  test("renders structured MCQ layout for a correct answer", () => {
    render(
      <AnswerFeedbackPanel
        layout="mcq"
        status="correct"
        marksAwarded={1}
        totalMarks={1}
        yourAnswer="B — 1"
        mcqFeedback={{ whyCorrect: "A sperm cell is haploid.", wrongOptionExplanations: [] }}
      />
    );
    expect(screen.getByText(/✅ Correct — 1\/1/)).toBeInTheDocument();
    expect(screen.getByTestId("answer-feedback-your-answer")).toHaveTextContent(/✅ Your answer/);
    expect(screen.getByText(/🎉 Why this is correct/i)).toBeInTheDocument();
    expect(screen.getByText(/haploid/i)).toBeInTheDocument();
    expect(screen.getByTestId("answer-feedback-your-answer").querySelector(".answer-feedback-panel__value-text--correct")).toBeTruthy();
  });

  test("renders partial state with mark scheme hits and missing points", () => {
    render(
      <AnswerFeedbackPanel
        status="partial"
        marksAwarded={1}
        totalMarks={2}
        markSchemeHits={["Release energy via aerobic respiration"]}
        markSchemeMissing={["Energy allows the tail to move so the sperm can swim"]}
        improvementTip="Try to include: Energy allows the tail to move so the sperm can swim."
      />
    );
    expect(screen.getByText(/Partially correct — 1\/2/)).toBeInTheDocument();
    expect(screen.getByText(/Release energy via aerobic respiration/)).toBeInTheDocument();
    expect(screen.getAllByText(/tail to move/i).length).toBeGreaterThan(0);
  });
});
