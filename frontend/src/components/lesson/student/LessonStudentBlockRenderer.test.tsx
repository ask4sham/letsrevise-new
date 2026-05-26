import React from "react";
import { render, screen } from "@testing-library/react";
import { LessonStudentBlockRenderer } from "./LessonStudentBlockRenderer";

jest.mock("../LessonCheckpoint", () => ({
  LessonCheckpoint: () => <div data-testid="lesson-checkpoint" />,
}));

jest.mock("../DragDropMatchBlock", () => ({
  DragDropMatchBlock: ({ block }: { block: { matchMode?: string } }) => (
    <div data-testid="drag-drop-match" data-match-mode={block.matchMode ?? ""} />
  ),
}));

jest.mock("../InlineSelfCheckBlock", () => ({
  InlineSelfCheckBlock: () => <div data-testid="self-check" />,
}));

jest.mock("../InteractiveSequenceBlock", () => ({
  InteractiveSequenceBlock: () => <div data-testid="interactive-sequence" />,
}));

jest.mock("../InteractiveDiagramBlock", () => ({
  InteractiveDiagramBlock: () => <div data-testid="interactive-diagram" />,
}));

jest.mock("../GraphBlock", () => ({
  GraphBlock: () => <div data-testid="graph-block" />,
}));

jest.mock("./studentLessonBlocks", () => ({
  StudentExplanationBlock: () => <div data-testid="explanation" />,
  StudentExamTechniqueBlock: () => <div data-testid="exam-technique" />,
  StudentExamTipBlock: () => <div data-testid="exam-tip" />,
  StudentSynopticLinkBlock: () => <div data-testid="synoptic" />,
  StudentWhyThisMattersBlock: () => <div data-testid="why" />,
  StudentHookBlock: () => <div data-testid="hook" />,
  StudentKeyIdeaBlock: () => <div data-testid="key-idea" />,
  StudentKeyWordsBlock: () => <div data-testid="keywords" />,
  StudentMisconceptionBlock: () => <div data-testid="misconception" />,
  StudentSynthesisBlock: () => <div data-testid="synthesis" />,
  StudentWorkedExampleBlock: () => <div data-testid="worked-example" />,
}));

const baseProps = {
  blockIndex: 0,
  markdownComponents: {},
  stripVideoMarkdown: (s: string) => s,
  maybeParseKeywordsFromText: () => null,
  renderDiagramBlock: () => null,
};

describe("LessonStudentBlockRenderer", () => {
  it("does not duplicate diagram block title via StudentBlockHeading", () => {
    render(
      <LessonStudentBlockRenderer
        {...baseProps}
        renderDiagramBlock={() => <div data-testid="diagram-inner">Diagram</div>}
        block={{
          type: "diagram",
          number: 9,
          title: "Exercise Pathway During Aerobic and Anaerobic Respiration",
          imageUrl: "/uploads/diagram.png",
        }}
      />
    );
    expect(screen.getByTestId("diagram-inner")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("renders checkpoint blocks inline", () => {
    render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "checkpoint",
          prompt: "Pick one",
          options: ["A", "B"],
          correctAnswer: "A",
        }}
      />
    );
    expect(screen.getByTestId("lesson-checkpoint")).toBeInTheDocument();
  });

  it("passes text-to-image matchMode from dragDropLayout after reload", () => {
    render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "dragDropMatch",
          dragDropLayout: "textToImage",
          pairs: [
            {
              id: "p1",
              prompt: "Aerobic respiration",
              answer: "Mitochondria",
              imageUrl: "https://example.com/mito.png",
            },
          ],
        }}
      />
    );
    expect(screen.getByTestId("drag-drop-match")).toHaveAttribute(
      "data-match-mode",
      "text-to-image"
    );
  });
});
