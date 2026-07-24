/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PracticeRunner } from "./PracticeRunner";
import { submitPracticeAttempt } from "../../api/practiceAttempts";

jest.mock("../../api/practiceAttempts", () => ({
  submitPracticeAttempt: jest.fn(),
}));

const submit = submitPracticeAttempt as jest.MockedFunction<typeof submitPracticeAttempt>;

const item = {
  contentType: "quiz_mcq" as const,
  contentId: "507f1f77bcf86cd799439011",
  topicKey: "aqa-gcse-biology:cell-structure",
  prompt: "What is a cell?",
  choices: ["A", "B", "C"],
};

async function answerCurrent(choiceLabel = "A") {
  fireEvent.click(screen.getByText(choiceLabel));
  fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
  await screen.findByTestId("practice-feedback-panel");
}

describe("PracticeRunner attempt payload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    submit.mockResolvedValue({
      ok: true,
      isCorrect: true,
      correctChoiceIndex: 0,
      attemptId: "att-1",
      explanation: "Because A is right.",
    });
  });

  test("includes practiceSetId when provided (frozen-set resume)", async () => {
    render(
      <PracticeRunner items={[item]} teacherId="teacher-1" practiceSetId="set-abc" />
    );

    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({
          practiceSetId: "set-abc",
          contentType: "quiz_mcq",
          contentId: item.contentId,
          teacherId: "teacher-1",
          selectedChoiceIndex: 0,
        })
      );
    });
    const payload = submit.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("isCorrect");
    expect(payload).not.toHaveProperty("correctChoiceIndex");
  });

  test("omits practiceSetId for ordinary dashboard practice", async () => {
    render(<PracticeRunner items={[item]} teacherId="teacher-1" />);

    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    await waitFor(() => {
      expect(submit).toHaveBeenCalled();
    });
    const payload = submit.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.practiceSetId).toBeUndefined();
    expect(payload.teacherId).toBe("teacher-1");
  });

  test("Check answer disabled before selection and enabled after", () => {
    render(<PracticeRunner items={[item]} teacherId="teacher-1" practiceSetId="set-1" />);
    const check = screen.getByTestId("practice-check-answer");
    expect(check).toBeDisabled();
    fireEvent.click(screen.getByText("A"));
    expect(check).not.toBeDisabled();
  });

  test("correct server result displays Correct and explanation", async () => {
    render(<PracticeRunner items={[item]} teacherId="teacher-1" practiceSetId="set-1" />);
    await answerCurrent("A");
    expect(screen.getByTestId("practice-feedback-title")).toHaveTextContent("Correct");
    expect(screen.getByTestId("practice-feedback-explanation")).toHaveTextContent(
      "Because A is right."
    );
    expect(screen.getByTestId("practice-answer-option-0")).toHaveAttribute("data-correct", "true");
  });

  test("incorrect server result displays Not quite", async () => {
    submit.mockResolvedValue({
      ok: true,
      isCorrect: false,
      correctChoiceIndex: 1,
      attemptId: "att-2",
      explanation: "B is the answer.",
    });
    render(<PracticeRunner items={[item]} teacherId="teacher-1" practiceSetId="set-1" />);
    await answerCurrent("A");
    expect(screen.getByTestId("practice-feedback-title")).toHaveTextContent("Not quite");
    expect(screen.getByTestId("practice-feedback-explanation")).toHaveTextContent(
      "B is the answer."
    );
    expect(screen.getByTestId("practice-answer-option-0")).toHaveAttribute("data-incorrect", "true");
    expect(screen.getByTestId("practice-answer-option-1")).toHaveAttribute("data-correct", "true");
  });

  test("unknown result safely displays Answer saved", async () => {
    submit.mockResolvedValue({ ok: true });
    render(<PracticeRunner items={[item]} teacherId="teacher-1" practiceSetId="set-1" />);
    await answerCurrent("A");
    expect(screen.getByTestId("practice-feedback-title")).toHaveTextContent("Answer saved");
    expect(screen.queryByText(/^Correct$/)).toBeNull();
    expect(screen.queryByText(/^Not quite$/)).toBeNull();
  });

  test("correctness is not shown before submission", () => {
    render(<PracticeRunner items={[item]} teacherId="teacher-1" practiceSetId="set-1" />);
    expect(screen.queryByTestId("practice-feedback-panel")).toBeNull();
    expect(screen.queryByText(/^Correct$/)).toBeNull();
    expect(screen.queryByText(/^Not quite$/)).toBeNull();
  });

  test("successful save exposes Next question", async () => {
    const items = [
      { ...item, contentId: "a", prompt: "Q1" },
      { ...item, contentId: "b", prompt: "Q2" },
    ];
    render(
      <PracticeRunner items={items} teacherId="teacher-1" practiceSetId="set-1" />
    );
    await answerCurrent("A");
    expect(screen.getByTestId("practice-next")).toHaveTextContent("Next question");
  });

  test("initialIndex starts on first unanswered item", () => {
    const items = [
      { ...item, contentId: "a", prompt: "Q1" },
      { ...item, contentId: "b", prompt: "Q2" },
      { ...item, contentId: "c", prompt: "Q3" },
    ];
    render(
      <PracticeRunner items={items} teacherId="teacher-1" practiceSetId="set-1" initialIndex={1} />
    );
    expect(screen.getByTestId("practice-runner-progress")).toHaveTextContent(
      "Question 2 of 3"
    );
    expect(screen.getByText("Q2")).toBeInTheDocument();
  });

  test("initialIndex 0 starts at Question 1", () => {
    const items = [
      { ...item, contentId: "a", prompt: "Q1" },
      { ...item, contentId: "b", prompt: "Q2" },
    ];
    render(
      <PracticeRunner items={items} teacherId="teacher-1" practiceSetId="set-1" initialIndex={0} />
    );
    expect(screen.getByTestId("practice-runner-progress")).toHaveTextContent(
      "Question 1 of 2"
    );
    expect(screen.getByText("Q1")).toBeInTheDocument();
  });

  test("last question uses View results label after save", async () => {
    render(
      <PracticeRunner items={[item]} teacherId="teacher-1" practiceSetId="set-1" />
    );
    await answerCurrent("A");
    expect(screen.getByTestId("practice-next")).toHaveTextContent("View results");
  });

  test("View results shows completion score and does not auto-call return", async () => {
    const onReturn = jest.fn();
    const onResultsReady = jest.fn();
    render(
      <PracticeRunner
        items={[item]}
        teacherId="teacher-1"
        practiceSetId="set-1"
        onReturnToLesson={onReturn}
        onResultsReady={onResultsReady}
      />
    );
    await answerCurrent("A");
    fireEvent.click(screen.getByTestId("practice-next"));
    expect(await screen.findByTestId("practice-complete-card")).toBeInTheDocument();
    expect(screen.getByTestId("practice-complete-score")).toHaveTextContent("1 / 1");
    expect(screen.getByTestId("practice-complete-copy")).toHaveTextContent(/Excellent/);
    expect(onReturn).not.toHaveBeenCalled();
    expect(onResultsReady).toHaveBeenCalledWith({ correctCount: 1, total: 1 });
  });

  test("prior outcomes contribute to completion score without double-count", async () => {
    const items = [
      { ...item, contentId: "a", prompt: "Q1" },
      { ...item, contentId: "b", prompt: "Q2" },
      { ...item, contentId: "c", prompt: "Q3" },
      { ...item, contentId: "d", prompt: "Q4" },
      { ...item, contentId: "e", prompt: "Q5" },
    ];
    submit.mockResolvedValue({
      ok: true,
      isCorrect: true,
      correctChoiceIndex: 0,
      attemptId: "att-n",
    });
    render(
      <PracticeRunner
        items={items}
        teacherId="teacher-1"
        practiceSetId="set-1"
        initialIndex={4}
        priorOutcomes={[
          { contentType: "quiz_mcq", contentId: "a", isCorrect: true },
          { contentType: "quiz_mcq", contentId: "b", isCorrect: true },
          { contentType: "quiz_mcq", contentId: "c", isCorrect: false },
          { contentType: "quiz_mcq", contentId: "d", isCorrect: true },
        ]}
      />
    );
    await answerCurrent("A");
    // Re-submit same item should not double-count
    fireEvent.click(screen.getByTestId("practice-next"));
    expect(await screen.findByTestId("practice-complete-score")).toHaveTextContent("4 / 5");
    expect(screen.getByTestId("practice-complete-copy")).toHaveTextContent(/Good work/);
  });

  test("low score copy for 0–2 correct", async () => {
    submit.mockResolvedValue({
      ok: true,
      isCorrect: false,
      correctChoiceIndex: 1,
      attemptId: "att-low",
    });
    render(
      <PracticeRunner items={[item]} teacherId="teacher-1" practiceSetId="set-1" />
    );
    await answerCurrent("A");
    fireEvent.click(screen.getByTestId("practice-next"));
    expect(await screen.findByTestId("practice-complete-copy")).toHaveTextContent(
      /Keep practising/
    );
  });

  test("Try another set hidden unless availability confirmed", async () => {
    render(
      <PracticeRunner
        items={[item]}
        teacherId="teacher-1"
        practiceSetId="set-1"
        tryAnotherSetAvailable={false}
      />
    );
    await answerCurrent("A");
    fireEvent.click(screen.getByTestId("practice-next"));
    expect(await screen.findByTestId("practice-complete-card")).toBeInTheDocument();
    expect(screen.queryByTestId("practice-try-another-set")).toBeNull();
  });

  test("Try another set shown when confirmed available", async () => {
    const onTry = jest.fn();
    render(
      <PracticeRunner
        items={[item]}
        teacherId="teacher-1"
        practiceSetId="set-1"
        tryAnotherSetAvailable
        onTryAnotherSet={onTry}
      />
    );
    await answerCurrent("A");
    fireEvent.click(screen.getByTestId("practice-next"));
    expect(await screen.findByTestId("practice-try-another-set")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("practice-try-another-set"));
    expect(onTry).toHaveBeenCalled();
  });

  test("Return to lesson works from completion", async () => {
    const onReturn = jest.fn();
    render(
      <PracticeRunner
        items={[item]}
        teacherId="teacher-1"
        practiceSetId="set-1"
        onReturnToLesson={onReturn}
      />
    );
    await answerCurrent("A");
    fireEvent.click(screen.getByTestId("practice-next"));
    fireEvent.click(await screen.findByTestId("practice-return-to-lesson"));
    expect(onReturn).toHaveBeenCalled();
  });

  test("client does not invent correctness when server omits it", async () => {
    submit.mockResolvedValue({ ok: true });
    render(<PracticeRunner items={[item]} teacherId="teacher-1" practiceSetId="set-1" />);
    await answerCurrent("A");
    fireEvent.click(screen.getByTestId("practice-next"));
    expect(await screen.findByTestId("practice-complete-score")).toHaveTextContent("0 / 1");
  });
});
