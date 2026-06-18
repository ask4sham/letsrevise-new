import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PracticeShortQuestion, type PracticeQuestionLite } from "./PracticeShortQuestion";

jest.mock("../../utils/attempts", () => ({
  logAttempt: jest.fn(),
}));

const baseQuestion: PracticeQuestionLite = {
  id: "pq-1",
  question: "Name the organelle that contains DNA.",
  type: "short",
  marks: 4,
  correctAnswer: "The nucleus contains DNA in eukaryotic cells.",
  markScheme: ["Mentions nucleus", "DNA stored in nucleus"],
  explanation: "DNA is found in the nucleus.",
};

describe("PracticeShortQuestion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps student answer visible after Check answer", () => {
    render(<PracticeShortQuestion q={baseQuestion} />);
    fireEvent.change(screen.getByPlaceholderText("Type your answer…"), {
      target: { value: "The nucleus has genetic material" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    expect(screen.getByTestId("practice-short-your-answer")).toHaveTextContent(
      "The nucleus has genetic material"
    );
    expect(screen.queryByPlaceholderText("Type your answer…")).not.toBeInTheDocument();
  });

  it("shows model answer after check", () => {
    render(<PracticeShortQuestion q={baseQuestion} />);
    fireEvent.change(screen.getByPlaceholderText("Type your answer…"), {
      target: { value: "nucleus" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    expect(screen.getByTestId("practice-short-model-answer")).toHaveTextContent(
      "The nucleus contains DNA in eukaryotic cells."
    );
  });

  it("shows mark scheme when present", () => {
    render(<PracticeShortQuestion q={baseQuestion} />);
    fireEvent.change(screen.getByPlaceholderText("Type your answer…"), {
      target: { value: "nucleus" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    const scheme = screen.getByTestId("practice-short-mark-scheme");
    expect(scheme).toHaveTextContent("Mentions nucleus");
    expect(scheme).toHaveTextContent("DNA stored in nucleus");
  });

  it("shows max marks when present", () => {
    render(<PracticeShortQuestion q={baseQuestion} />);
    fireEvent.change(screen.getByPlaceholderText("Type your answer…"), {
      target: { value: "nucleus" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    expect(screen.getByText("This question is worth 4 marks.")).toBeInTheDocument();
  });

  it("disables Check answer when empty and shows gentle hint", () => {
    render(<PracticeShortQuestion q={baseQuestion} />);
    const checkBtn = screen.getByRole("button", { name: "Check answer" });
    expect(checkBtn).toBeDisabled();
    expect(screen.getByText("Type an answer before checking.")).toBeInTheDocument();
  });

  it("labels self-check instead of was your answer correct", () => {
    render(<PracticeShortQuestion q={baseQuestion} />);
    fireEvent.change(screen.getByPlaceholderText("Type your answer…"), {
      target: { value: "nucleus" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    expect(screen.getByText("Self-check your answer")).toBeInTheDocument();
    expect(screen.queryByText("Was your answer correct?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I was partly correct" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I need to revise this" })).toBeInTheDocument();
  });

  it("shows confidence buttons after self-check selection", () => {
    render(<PracticeShortQuestion q={baseQuestion} lessonId="lesson-1" />);
    fireEvent.change(screen.getByPlaceholderText("Type your answer…"), {
      target: { value: "nucleus" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    fireEvent.click(screen.getByRole("button", { name: "I was correct" }));

    expect(screen.getByText("Confidence?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Low (1)" })).toBeInTheDocument();
  });

  it("wraps long student answers in the your-answer panel", () => {
    const longAnswer = "A".repeat(120);
    render(<PracticeShortQuestion q={baseQuestion} />);
    fireEvent.change(screen.getByPlaceholderText("Type your answer…"), {
      target: { value: longAnswer },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    const panel = screen.getByTestId("practice-short-your-answer");
    expect(panel).toHaveTextContent(longAnswer);
    expect(panel.style.overflowWrap).toBe("anywhere");
  });

  it("shows estimated score guide when model answer is available", () => {
    render(<PracticeShortQuestion q={baseQuestion} />);
    fireEvent.change(screen.getByPlaceholderText("Type your answer…"), {
      target: { value: "The nucleus contains DNA" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    expect(screen.getByText(/Estimated score \(guide\):/)).toBeInTheDocument();
    expect(screen.getByText(/Not an official mark/)).toBeInTheDocument();
  });
});
