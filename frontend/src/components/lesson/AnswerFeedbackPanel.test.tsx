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
        improvementTip="Review why B (1) is correct."
      />
    );
    expect(screen.getByText(/Incorrect — 0\/1/)).toBeInTheDocument();
    expect(screen.getByText(/23 is the total number of chromosomes, not X chromosomes/i)).toBeInTheDocument();
    expect(screen.getByTestId("answer-feedback-tip")).toHaveTextContent(/Review why B/i);
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
