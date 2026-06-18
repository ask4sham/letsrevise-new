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

  it("shows structured included and to-improve feedback for thermoregulation", () => {
    const thermoQuestion: PracticeQuestionLite = {
      id: "pq-thermo",
      question: "Explain how the hypothalamus contributes to thermoregulation in the body. (4 marks)",
      type: "short",
      marks: 4,
      correctAnswer:
        "The hypothalamus monitors blood temperature and coordinates responses such as sweating, vasodilation, shivering, and vasoconstriction. Negative feedback returns body temperature to normal.",
      markScheme: [
        "Blood vessels widen and sweating occurs to cool the body",
        "Blood vessels narrow and shivering occurs to warm the body",
      ],
    };
    const fullAnswer =
      "The hypothalamus monitors the temperature of the blood flowing through the brain. If body temperature rises above the optimum level, the hypothalamus detects the change and triggers responses such as sweating and vasodilation to increase heat loss. If body temperature falls below the optimum level, the hypothalamus triggers responses such as shivering and vasoconstriction to reduce heat loss and generate heat. These responses act through negative feedback to return body temperature to its normal level.";

    render(<PracticeShortQuestion q={thermoQuestion} />);
    fireEvent.change(screen.getByPlaceholderText("Type your answer…"), {
      target: { value: fullAnswer },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    expect(screen.getByText(/Estimated score \(guide\): 4 \/ 4/)).toBeInTheDocument();
    const included = screen.getByTestId("practice-short-included");
    expect(included.querySelectorAll("li").length).toBeGreaterThanOrEqual(3);
    expect(included).toHaveTextContent(/hypothalamus|sweat|vasodilat|shiver|temperature/i);
    expect(screen.queryByTestId("practice-short-to-improve")).not.toBeInTheDocument();
  });

  it("shows to-improve feedback for a weak thermoregulation answer", () => {
    const thermoQuestion: PracticeQuestionLite = {
      id: "pq-thermo-weak",
      question: "Explain how the hypothalamus contributes to thermoregulation in the body. (4 marks)",
      type: "short",
      marks: 4,
      correctAnswer:
        "The hypothalamus monitors blood temperature and coordinates sweating, vasodilation, shivering, and vasoconstriction. Negative feedback restores normal temperature.",
      markScheme: [
        "Blood vessels widen and sweating occurs to cool the body",
        "Blood vessels narrow and shivering occurs to warm the body",
      ],
    };

    render(<PracticeShortQuestion q={thermoQuestion} />);
    fireEvent.change(screen.getByPlaceholderText("Type your answer…"), {
      target: { value: "The hypothalamus controls body temperature." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    expect(screen.getByText(/Estimated score \(guide\): 1 \/ 4/)).toBeInTheDocument();
    const toImprove = screen.getByTestId("practice-short-to-improve");
    expect(toImprove).toHaveTextContent(/sweat|vasodilat/i);
    expect(toImprove).toHaveTextContent(/shiver|vasoconstric/i);
    expect(toImprove).toHaveTextContent(/negative feedback|normal|homeostasis/i);
  });

  it("does not repeat mark scheme text after self-check when explanation duplicates mark scheme", () => {
    const bankStyleQuestion: PracticeQuestionLite = {
      id: "pq-bank-dup",
      question: "Explain thermoregulation.",
      type: "short",
      marks: 4,
      correctAnswer: "The hypothalamus monitors blood temperature.",
      markScheme: ["Detects temperature change", "Triggers sweating when hot"],
      explanation: "Detects temperature change\nTriggers sweating when hot",
    };

    render(<PracticeShortQuestion q={bankStyleQuestion} />);
    fireEvent.change(screen.getByPlaceholderText("Type your answer…"), {
      target: { value: "The hypothalamus monitors blood temperature and triggers sweating when hot." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    expect(screen.getByTestId("practice-short-mark-scheme")).toBeInTheDocument();
    expect(screen.queryByTestId("practice-short-explanation")).not.toBeInTheDocument();
    expect(screen.getByText("Self-check your answer")).toBeInTheDocument();
    const markSchemeItems = screen.getByTestId("practice-short-mark-scheme").querySelectorAll("li");
    expect(markSchemeItems).toHaveLength(2);
    expect(markSchemeItems[0]).toHaveTextContent(/Detects temperature change/i);
  });

  it("shows guided self-check without estimated score for low-confidence marking", () => {
    const vagueQuestion: PracticeQuestionLite = {
      id: "pq-vague",
      question: "Discuss the importance of biodiversity. (4 marks)",
      type: "short",
      marks: 4,
      correctAnswer: "Biodiversity matters.",
      markScheme: ["Mentions biodiversity"],
    };

    render(<PracticeShortQuestion q={vagueQuestion} />);
    fireEvent.change(screen.getByPlaceholderText("Type your answer…"), {
      target: { value: "Biodiversity is important for ecosystems." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    expect(screen.getByTestId("practice-short-guided-self-check")).toBeInTheDocument();
    expect(screen.getByText(/No estimated score shown because this answer needs teacher\/examiner judgement/)).toBeInTheDocument();
    expect(screen.queryByText(/Estimated score \(guide\):/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("practice-short-included")).not.toBeInTheDocument();
  });
});
