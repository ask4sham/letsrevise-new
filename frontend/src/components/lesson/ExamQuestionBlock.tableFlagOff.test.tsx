import React from "react";
import { render, screen } from "@testing-library/react";
import { ExamQuestionBlock } from "./ExamQuestionBlock";
import type { ExamQuestion } from "../../api/examQuestions";

jest.mock("./ZoomableImageLightbox", () => ({
  ZoomableImageTrigger: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} data-testid="zoomable-image" />
  ),
}));

/** Force flag OFF even when REACT_APP_TABLE_PARTS_ENABLED=true in the shell / .env.local */
jest.mock("./examComposite/featureFlags", () => {
  const actual = jest.requireActual("./examComposite/featureFlags");
  return {
    ...actual,
    isCompositePartTypeEnabled: (partType: string) => {
      if (String(partType).toLowerCase() === "table") return false;
      return actual.isCompositePartTypeEnabled(partType);
    },
  };
});

const TABLE_COMPOSITE: ExamQuestion = {
  _id: "exam-composite-table-off",
  questionMode: "composite",
  type: "composite",
  schemaVersion: 2,
  question: "The table shows hormones.",
  sharedStem: "The table shows hormones.",
  totalMarks: 2,
  parts: [
    {
      label: "a",
      type: "table",
      marks: 2,
      questionText: "Complete the table.",
      markScheme: ["FSH stimulates follicles"],
      partData: {
        headers: ["Hormone", "Role"],
        rows: [
          {
            cells: [
              { value: "FSH", blank: false },
              { blank: true, correctAnswer: "Stimulates follicles" },
            ],
          },
        ],
      },
    },
  ],
};

describe("ExamQuestionBlock table composite (TABLE_PARTS_ENABLED OFF)", () => {
  test("does not render table inputs when flag is OFF", () => {
    render(<ExamQuestionBlock question={TABLE_COMPOSITE} mode="student" />);

    expect(screen.queryByTestId("exam-composite-table-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("exam-composite-table-input-0-0-1")).not.toBeInTheDocument();
  });
});
