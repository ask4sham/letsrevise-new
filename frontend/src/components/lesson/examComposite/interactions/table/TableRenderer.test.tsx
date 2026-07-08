import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TableRenderer } from "./TableRenderer";
import { serializeTableStudentAnswers } from "./tableTypes";

const SAMPLE_TABLE = {
  headers: ["Hormone", "Role"],
  rows: [
    {
      cells: [
        { value: "FSH", blank: false },
        { blank: true, correctAnswer: "Stimulates follicles" },
      ],
    },
    {
      cells: [
        { value: "LH", blank: false },
        { blank: true, correctAnswer: "Triggers ovulation" },
      ],
    },
  ],
};

function InteractiveHarness({
  partData,
  partIndex = 0,
  initialAnswer,
  marked,
}: {
  partData: unknown;
  partIndex?: number;
  initialAnswer?: string;
  marked?: boolean;
}) {
  const [answer, setAnswer] = useState(initialAnswer ?? "");
  return (
    <TableRenderer
      partData={partData}
      partIndex={partIndex}
      answerValue={answer}
      onAnswerChange={setAnswer}
      interactive
      marked={marked}
    />
  );
}

describe("TableRenderer", () => {
  test("renders headers and label cells", () => {
    render(<TableRenderer partData={SAMPLE_TABLE} partIndex={0} interactive={false} />);

    expect(screen.getByTestId("exam-composite-table-0")).toBeInTheDocument();
    expect(screen.getByText("Hormone")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("FSH")).toBeInTheDocument();
    expect(screen.getByText("LH")).toBeInTheDocument();
  });

  test("renders blank lines when not interactive", () => {
    render(<TableRenderer partData={SAMPLE_TABLE} partIndex={0} interactive={false} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".exam-composite__table-blank-line").length).toBe(2);
  });

  test("renders editable inputs for blank cells when interactive", () => {
    render(<InteractiveHarness partData={SAMPLE_TABLE} />);

    expect(screen.getByTestId("exam-composite-table-input-0-0-1")).toBeInTheDocument();
    expect(screen.getByTestId("exam-composite-table-input-0-1-1")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("FSH")).not.toBeInTheDocument();
  });

  test("student can type into blank cells", () => {
    render(<InteractiveHarness partData={SAMPLE_TABLE} />);

    fireEvent.change(screen.getByTestId("exam-composite-table-input-0-0-1"), {
      target: { value: "Stimulates follicles" },
    });
    fireEvent.change(screen.getByTestId("exam-composite-table-input-0-1-1"), {
      target: { value: "Triggers ovulation" },
    });

    expect(screen.getByDisplayValue("Stimulates follicles")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Triggers ovulation")).toBeInTheDocument();
  });

  test("shows correct/incorrect styling after marking", () => {
    const answers = serializeTableStudentAnswers({
      "0:1": "Stimulates follicles",
      "1:1": "wrong",
    });

    render(<InteractiveHarness partData={SAMPLE_TABLE} initialAnswer={answers} marked />);

    expect(screen.getByTestId("exam-composite-table-input-0-0-1")).toHaveClass(
      "exam-composite__table-input--correct"
    );
    expect(screen.getByTestId("exam-composite-table-input-0-1-1")).toHaveClass(
      "exam-composite__table-input--incorrect"
    );
  });

  test("shows fallback when partData is invalid", () => {
    render(<TableRenderer partData={null} partIndex={2} interactive />);
    expect(screen.getByTestId("exam-composite-table-fallback-2")).toHaveTextContent(/invalid/i);
  });

  test("disables inputs when disabled prop is set", () => {
    render(
      <TableRenderer
        partData={SAMPLE_TABLE}
        partIndex={0}
        interactive
        disabled
        answerValue={serializeTableStudentAnswers({ "0:1": "x" })}
        onAnswerChange={() => {}}
      />
    );

    expect(screen.getByTestId("exam-composite-table-input-0-0-1")).toBeDisabled();
  });
});
