/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { StudentRetrievalSection } from "./StudentRetrievalSection";

jest.mock("../../ai/ExplainMyMistakeButton", () => ({
  ExplainMyMistakeButton: () => null,
}));

jest.mock("../TryFreshPracticeCta", () => ({
  TryFreshPracticeCta: () => <div data-testid="try-fresh-practice">Try N new questions</div>,
}));

describe("StudentRetrievalSection fresh CTA gate", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const pool = [
    {
      id: "rev-bank-0",
      type: "mcq" as const,
      question: "How does sexual reproduction produce variation?",
      options: ["Cloning", "Mixing alleles", "Mitosis only"],
      correctAnswer: "Mixing alleles",
      questionSource: "topic-bank" as const,
      sourceQuestionId: "507f1f77bcf86cd799439011",
      sourceType: "quiz_mcq",
    },
  ];

  test("incomplete quiz does not mount TryFreshPracticeCta", () => {
    render(
      <StudentRetrievalSection
        pages={[]}
        storedFlashcards={[]}
        revisionQuizPool={pool as any}
        hasFullAccess
        enableFreshPractice
        lessonId="les1"
        pageId="END"
        studentId="stu1"
        specKey="spec"
        topicKey="topic"
      />
    );
    expect(screen.queryByTestId("try-fresh-practice")).toBeNull();
  });

  test("Finish quiz mounts TryFreshPracticeCta", async () => {
    render(
      <StudentRetrievalSection
        pages={[]}
        storedFlashcards={[]}
        revisionQuizPool={pool as any}
        hasFullAccess
        enableFreshPractice
        lessonId="les1"
        pageId="END"
        studentId="stu1"
        specKey="spec"
        topicKey="topic"
      />
    );
    fireEvent.click(screen.getByLabelText("Mixing alleles"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /finish quiz/i }));
    expect(await screen.findByTestId("try-fresh-practice")).toBeInTheDocument();
  });

  test("enableFreshPractice false never mounts CTA after finish", async () => {
    render(
      <StudentRetrievalSection
        pages={[]}
        storedFlashcards={[]}
        revisionQuizPool={pool as any}
        hasFullAccess
        enableFreshPractice={false}
        lessonId="les1"
        pageId="END"
        studentId="stu1"
        specKey="spec"
        topicKey="topic"
      />
    );
    fireEvent.click(screen.getByLabelText("Mixing alleles"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /finish quiz/i }));
    expect(screen.getByText(/Quiz complete/i)).toBeInTheDocument();
    expect(screen.queryByTestId("try-fresh-practice")).toBeNull();
  });
});
