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

describe("PracticeRunner attempt payload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    submit.mockResolvedValue({ ok: true });
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

  test("successful save exposes Next question", async () => {
    const items = [
      { ...item, contentId: "a", prompt: "Q1" },
      { ...item, contentId: "b", prompt: "Q2" },
    ];
    render(
      <PracticeRunner items={items} teacherId="teacher-1" practiceSetId="set-1" />
    );
    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(await screen.findByTestId("practice-next")).toHaveTextContent("Next question");
    expect(screen.getByTestId("practice-saved-panel")).toBeInTheDocument();
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

  test("last question uses Finish practice label after save", async () => {
    render(
      <PracticeRunner items={[item]} teacherId="teacher-1" practiceSetId="set-1" />
    );
    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(await screen.findByTestId("practice-next")).toHaveTextContent("Finish practice");
  });
});
