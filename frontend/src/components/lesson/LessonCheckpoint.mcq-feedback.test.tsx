import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LessonCheckpoint } from "./LessonCheckpoint";

jest.mock("../../utils/attempts", () => ({
  logAttempt: jest.fn(),
}));

describe("LessonCheckpoint MCQ feedback", () => {
  const options = ["0", "1", "2", "23"];

  it("shows marks and feedback after check for entitled students", async () => {
    render(
      <LessonCheckpoint
        mode="mcq"
        prompt="What is the maximum number of X chromosomes in a sperm cell nucleus?"
        options={options}
        correctAnswer="1"
        explanation="A sperm cell is haploid and has one sex chromosome."
        markScheme={[
          "Correct answer: B — 1",
          "Why D is wrong: 23 is the total chromosome number, not the X chromosome count.",
        ]}
        name="checkpoint-test"
        entitled
      />
    );

    await userEvent.click(screen.getByText("1"));
    await userEvent.click(screen.getByRole("button", { name: /Check answer/i }));

    expect(screen.getByTestId("answer-feedback-panel")).toHaveAttribute("data-status", "correct");
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/1 \/ 1 marks/i);
    expect(screen.getByText(/haploid/i)).toBeInTheDocument();
  });

  it("shows wrong-answer feedback for an incorrect MCQ selection", async () => {
    render(
      <LessonCheckpoint
        mode="mcq"
        prompt="What is the maximum number of X chromosomes in a sperm cell nucleus?"
        options={options}
        correctAnswer="1"
        explanation="A sperm cell is haploid and has one sex chromosome."
        markScheme={[
          "Correct answer: B — 1",
          "Why D is wrong: 23 is the total chromosome number, not the X chromosome count.",
        ]}
        name="checkpoint-test-wrong"
        entitled
      />
    );

    await userEvent.click(screen.getByText("23"));
    await userEvent.click(screen.getByRole("button", { name: /Check answer/i }));

    expect(screen.getByTestId("answer-feedback-panel")).toHaveAttribute("data-status", "incorrect");
    expect(screen.getByTestId("answer-feedback-score-badge")).toHaveTextContent(/0 \/ 1 marks/i);
    expect(screen.getByText(/Why your answer is wrong/i)).toBeInTheDocument();
    expect(screen.getAllByText(/total chromosome number/i).length).toBeGreaterThan(0);
  });
});
