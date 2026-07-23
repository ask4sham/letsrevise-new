/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { StudentRetrievalSection } from "./StudentRetrievalSection";
import {
  buildRevisionQuizCompletionKey,
  revisionCompletionScopeFromQuestions,
  resolveAuthUserId,
} from "../../../utils/revisionQuizCompletion";

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

  function finishQuiz() {
    fireEvent.click(screen.getByLabelText("Mixing alleles"));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /finish quiz/i }));
  }

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

  test("Finish quiz mounts TryFreshPracticeCta and writes completion for id-resolved student", async () => {
    const studentId = resolveAuthUserId({ id: "login-only-id" });
    render(
      <StudentRetrievalSection
        pages={[]}
        storedFlashcards={[]}
        revisionQuizPool={pool as any}
        hasFullAccess
        enableFreshPractice
        lessonId="les1"
        pageId="END"
        studentId={studentId}
        specKey="spec"
        topicKey="topic"
      />
    );
    finishQuiz();
    expect(await screen.findByTestId("try-fresh-practice")).toBeInTheDocument();
    const scope = revisionCompletionScopeFromQuestions({
      studentId,
      lessonId: "les1",
      pageId: "END",
      questions: pool as any,
    });
    expect(scope).not.toBeNull();
    expect(localStorage.getItem(buildRevisionQuizCompletionKey(scope!))).toBe("1");
  });

  test("Finish quiz with _id-only student persists under that id", async () => {
    const studentId = resolveAuthUserId({ _id: "mongo-only-id" });
    render(
      <StudentRetrievalSection
        pages={[]}
        storedFlashcards={[]}
        revisionQuizPool={pool as any}
        hasFullAccess
        enableFreshPractice
        lessonId="les1"
        pageId="END"
        studentId={studentId}
        specKey="spec"
        topicKey="topic"
      />
    );
    finishQuiz();
    expect(await screen.findByTestId("try-fresh-practice")).toBeInTheDocument();
    const scope = revisionCompletionScopeFromQuestions({
      studentId,
      lessonId: "les1",
      pageId: "END",
      questions: pool as any,
    });
    expect(localStorage.getItem(buildRevisionQuizCompletionKey(scope!))).toBe("1");
  });

  test("missing student id: Finish still shows CTA in-session but writes no completion key", async () => {
    render(
      <StudentRetrievalSection
        pages={[]}
        storedFlashcards={[]}
        revisionQuizPool={pool as any}
        hasFullAccess
        enableFreshPractice
        lessonId="les1"
        pageId="END"
        studentId={undefined}
        specKey="spec"
        topicKey="topic"
      />
    );
    finishQuiz();
    expect(await screen.findByTestId("try-fresh-practice")).toBeInTheDocument();
    expect(Object.keys(localStorage).filter((k) => k.includes("revision-quiz-complete"))).toEqual([]);
  });

  test("reload restores Quiz complete CTA for same student/lesson/page/set", async () => {
    const studentId = resolveAuthUserId({ id: "reload-user" });
    const scope = revisionCompletionScopeFromQuestions({
      studentId,
      lessonId: "les1",
      pageId: "END",
      questions: pool as any,
    })!;
    localStorage.setItem(buildRevisionQuizCompletionKey(scope), "1");

    render(
      <StudentRetrievalSection
        pages={[]}
        storedFlashcards={[]}
        revisionQuizPool={pool as any}
        hasFullAccess
        enableFreshPractice
        lessonId="les1"
        pageId="END"
        studentId={studentId}
        specKey="spec"
        topicKey="topic"
      />
    );
    expect(await screen.findByText(/Quiz complete/i)).toBeInTheDocument();
    expect(await screen.findByTestId("try-fresh-practice")).toBeInTheDocument();
  });

  test("Retry quiz clears matching persisted completion", async () => {
    const studentId = resolveAuthUserId({ id: "retry-user" });
    render(
      <StudentRetrievalSection
        pages={[]}
        storedFlashcards={[]}
        revisionQuizPool={pool as any}
        hasFullAccess
        enableFreshPractice
        lessonId="les1"
        pageId="END"
        studentId={studentId}
        specKey="spec"
        topicKey="topic"
      />
    );
    finishQuiz();
    expect(await screen.findByTestId("try-fresh-practice")).toBeInTheDocument();
    const scope = revisionCompletionScopeFromQuestions({
      studentId,
      lessonId: "les1",
      pageId: "END",
      questions: pool as any,
    })!;
    expect(localStorage.getItem(buildRevisionQuizCompletionKey(scope))).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: /retry quiz/i }));
    expect(screen.queryByTestId("try-fresh-practice")).toBeNull();
    expect(localStorage.getItem(buildRevisionQuizCompletionKey(scope))).toBeNull();
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
    finishQuiz();
    expect(screen.getByText(/Quiz complete/i)).toBeInTheDocument();
    expect(screen.queryByTestId("try-fresh-practice")).toBeNull();
  });

  test("null scope after finish does not wipe in-session completion on remount path", async () => {
    const { rerender } = render(
      <StudentRetrievalSection
        pages={[]}
        storedFlashcards={[]}
        revisionQuizPool={pool as any}
        hasFullAccess
        enableFreshPractice
        lessonId="les1"
        pageId="END"
        studentId={undefined}
        specKey="spec"
        topicKey="topic"
      />
    );
    finishQuiz();
    expect(await screen.findByTestId("try-fresh-practice")).toBeInTheDocument();

    rerender(
      <StudentRetrievalSection
        pages={[]}
        storedFlashcards={[]}
        revisionQuizPool={pool as any}
        hasFullAccess
        enableFreshPractice
        lessonId="les1"
        pageId="END"
        studentId={undefined}
        specKey="spec"
        topicKey="topic"
      />
    );
    expect(screen.getByTestId("try-fresh-practice")).toBeInTheDocument();
  });
});
