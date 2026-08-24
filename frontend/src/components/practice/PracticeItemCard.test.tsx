/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PracticeItemCard } from "./PracticeItemCard";

const item = {
  contentType: "quiz_mcq" as const,
  contentId: "q1",
  topicKey: "edexcel-igcse-biology:sexual-and-asexual-reproduction-differences",
  prompt: "Which comparison is correct?",
  choices: [
    "Option A long text for wrapping",
    "Option B long text for wrapping",
    "Option C long text for wrapping",
    "Option D long text for wrapping",
  ],
  metadata: { skill: "application", estimatedTimeSec: 55 },
};

describe("PracticeItemCard", () => {
  test("renders stacked selectable answer options with skill and time", () => {
    render(<PracticeItemCard item={item} />);
    expect(screen.getByTestId("practice-skill-chip")).toHaveTextContent("APPLY");
    expect(screen.getByTestId("practice-time-estimate")).toHaveTextContent("About 55 seconds");
    expect(screen.getByText("Choose one answer")).toBeInTheDocument();
    const group = screen.getByTestId("practice-answer-options");
    expect(group).toHaveAttribute("role", "radiogroup");
    expect(group).toHaveClass("fp-options");
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByTestId("practice-answer-option-0")).toHaveClass("fp-option");
  });

  test("selected answer exposes selected state", () => {
    const onSelect = jest.fn();
    render(
      <PracticeItemCard item={item} selectedChoiceIndex={1} onSelectChoice={onSelect} />
    );
    expect(screen.getByTestId("practice-answer-option-1")).toHaveAttribute(
      "data-selected",
      "true"
    );
    expect(screen.getByTestId("practice-answer-option-1")).toHaveAttribute(
      "aria-checked",
      "true"
    );
    fireEvent.click(screen.getByTestId("practice-answer-option-2"));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  test("radio control sits after answer text (right-aligned layout)", () => {
    render(<PracticeItemCard item={item} selectedChoiceIndex={0} />);
    const option = screen.getByTestId("practice-answer-option-0");
    expect(option.innerHTML.indexOf("fp-option__text")).toBeGreaterThan(-1);
    expect(option.innerHTML.indexOf("fp-option__radio")).toBeGreaterThan(
      option.innerHTML.indexOf("fp-option__text")
    );
  });

  test("does not expose correctness before submission", () => {
    render(<PracticeItemCard item={item} selectedChoiceIndex={0} />);
    expect(screen.queryByText(/^Correct$/i)).toBeNull();
    expect(screen.queryByText(/incorrect/i)).toBeNull();
    expect(screen.queryByText(/mark scheme/i)).toBeNull();
    expect(screen.queryByText(/Answer saved/i)).toBeNull();
    expect(screen.getByTestId("practice-answer-option-0")).not.toHaveAttribute("data-correct");
  });

  test("after submission styles correct and incorrect options from server feedback", () => {
    render(
      <PracticeItemCard
        item={item}
        selectedChoiceIndex={0}
        submitted
        feedback={{ isCorrect: false, correctChoiceIndex: 2 }}
      />
    );
    expect(screen.getByTestId("practice-answer-option-0")).toHaveAttribute("data-incorrect", "true");
    expect(screen.getByTestId("practice-answer-option-2")).toHaveAttribute("data-correct", "true");
  });
});
