/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { StudentRetrievalSection } from "./StudentRetrievalSection";
import {
  buildRevisionQuizCompletionKey,
  getRevisionQuizCompletion,
  revisionCompletionScopeFromQuestions,
  resolveAuthUserId,
} from "../../../utils/revisionQuizCompletion";

jest.mock("../../ai/ExplainMyMistakeButton", () => ({
  ExplainMyMistakeButton: () => null,
}));

jest.mock("../TryFreshPracticeCta", () => ({
  TryFreshPracticeCta: () => <div data-testid="try-fresh-practice">Try another set</div>,
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

  function finishQuizIncorrect() {
    fireEvent.click(screen.getByLabelText("Cloning"));
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

  test("Finish quiz mounts TryFreshPracticeCta and writes scored completion for id-resolved student", async () => {
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
    expect(screen.getByText(/Score:\s*1\s*\/\s*1/i)).toBeInTheDocument();
    expect(screen.getByTestId("revision-try-again")).toHaveTextContent(/Retry same quiz/i);
    expect(screen.getByTestId("revision-quiz-result-score")).toHaveTextContent("1/1");
    const scope = revisionCompletionScopeFromQuestions({
      studentId,
      lessonId: "les1",
      pageId: "END",
      questions: pool as any,
    });
    expect(scope).not.toBeNull();
    const stored = getRevisionQuizCompletion(scope!);
    expect(stored?.completed).toBe(true);
    expect(stored?.score).toBe(1);
    expect(stored?.questionCount).toBe(1);
    expect(localStorage.getItem(buildRevisionQuizCompletionKey(scope!))).not.toBe("1");
  });

  test("imperfect Finish shows Retry same quiz and does not mount fresh CTA", async () => {
    render(
      <StudentRetrievalSection
        pages={[]}
        storedFlashcards={[]}
        revisionQuizPool={pool as any}
        hasFullAccess
        enableFreshPractice
        lessonId="les1"
        pageId="END"
        studentId="stu-imperfect"
        specKey="spec"
        topicKey="topic"
      />
    );
    finishQuizIncorrect();
    expect(await screen.findByText(/Score:\s*0\s*\/\s*1/i)).toBeInTheDocument();
    expect(screen.getByTestId("revision-try-again")).toHaveTextContent(/Retry same quiz/i);
    expect(screen.getByTestId("revision-quiz-result-score")).toHaveTextContent("0/1");
    expect(screen.queryByTestId("try-fresh-practice")).toBeNull();
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
    expect(getRevisionQuizCompletion(scope!)?.score).toBe(1);
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

  test("reload restores scored Quiz complete CTA for same student/lesson/page/set", async () => {
    const studentId = resolveAuthUserId({ id: "reload-user" });
    const scope = revisionCompletionScopeFromQuestions({
      studentId,
      lessonId: "les1",
      pageId: "END",
      questions: pool as any,
    })!;
    localStorage.setItem(
      buildRevisionQuizCompletionKey(scope),
      JSON.stringify({
        version: 1,
        completed: true,
        score: 1,
        questionCount: 1,
        completedAt: new Date().toISOString(),
        setSignature: scope.setSignature,
      })
    );

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
    expect(screen.getByText(/Score:\s*1\s*\/\s*1/i)).toBeInTheDocument();
    expect(screen.queryByText(/Score:\s*0\s*\/\s*1/i)).toBeNull();
    expect(await screen.findByTestId("try-fresh-practice")).toBeInTheDocument();
  });

  test("legacy \"1\" restores completion without inventing 0/N score", async () => {
    const studentId = resolveAuthUserId({ id: "legacy-user" });
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
    expect(screen.queryByText(/Score:/i)).toBeNull();
    // Unknown score: not treated as perfect → no fresh CTA; Retry same quiz available.
    expect(screen.queryByTestId("try-fresh-practice")).toBeNull();
    expect(screen.getByTestId("revision-try-again")).toHaveTextContent(/Retry same quiz/i);
    expect(screen.queryByTestId("revision-quiz-result-card")).toBeNull();
  });

  test("Retry same quiz clears matching persisted completion", async () => {
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
    finishQuizIncorrect();
    expect(await screen.findByTestId("revision-try-again")).toBeInTheDocument();
    const scope = revisionCompletionScopeFromQuestions({
      studentId,
      lessonId: "les1",
      pageId: "END",
      questions: pool as any,
    })!;
    expect(getRevisionQuizCompletion(scope)?.completed).toBe(true);

    fireEvent.click(screen.getByTestId("revision-try-again"));
    expect(screen.queryByTestId("revision-try-again")).toBeNull();
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
