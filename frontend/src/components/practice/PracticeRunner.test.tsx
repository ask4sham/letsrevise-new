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
      <PracticeRunner
        items={[item]}
        teacherId="teacher-1"
        practiceSetId="set-abc"
      />
    );

    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    await waitFor(() => {
      expect(submit).toHaveBeenCalled();
    });
    const payload = submit.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.practiceSetId).toBeUndefined();
    expect(payload.teacherId).toBe("teacher-1");
  });
});
