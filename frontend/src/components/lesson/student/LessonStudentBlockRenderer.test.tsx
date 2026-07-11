import React from "react";
import { render, screen } from "@testing-library/react";
import { LessonStudentBlockRenderer } from "./LessonStudentBlockRenderer";
import { TEACHER_BRAIN_DESIGN_BRIEF_MARKER } from "../../../utils/teacherBrainDesignBrief";

jest.mock("../LessonCheckpoint", () => ({
  LessonCheckpoint: () => <div data-testid="lesson-checkpoint" />,
}));

jest.mock("../DragDropMatchBlock", () => ({
  DragDropMatchBlock: ({
    block,
    hideTitle,
  }: {
    block: { matchMode?: string };
    hideTitle?: boolean;
  }) => (
    <div
      data-testid="drag-drop-match"
      data-match-mode={block.matchMode ?? ""}
      data-hide-title={hideTitle ? "1" : "0"}
    />
  ),
}));

jest.mock("../InlineSelfCheckBlock", () => ({
  InlineSelfCheckBlock: ({ hideHeadingLabel }: { hideHeadingLabel?: boolean }) => (
    <div data-testid="self-check" data-hide-heading={hideHeadingLabel ? "1" : "0"} />
  ),
}));

jest.mock("../InteractiveSequenceBlock", () => ({
  InteractiveSequenceBlock: ({ hideBlockTitle }: { hideBlockTitle?: boolean }) => (
    <div data-testid="interactive-sequence" data-hide-title={hideBlockTitle ? "1" : "0"} />
  ),
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

  it("does not surface Teacher Brain design brief note in student view", () => {
    const { container } = render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "dragDropMatch",
          title: "Drag and Drop",
          instructions: "Match each label.",
          note: `${TEACHER_BRAIN_DESIGN_BRIEF_MARKER}\n\nDRAG & DROP BRIEF\n\nTitle:\nMetabolism`,
          pairs: [{ id: "p1", prompt: "ATP", answer: "Energy currency" }],
        }}
      />
    );
    expect(screen.getByTestId("drag-drop-match")).toBeInTheDocument();
    expect(screen.queryByText(/Teacher Brain Design Brief/i)).not.toBeInTheDocument();
    expect(String(container.textContent ?? "")).not.toMatch(/TEACHER BRAIN DESIGN BRIEF/);
    expect(String(container.textContent ?? "")).not.toMatch(/DRAG & DROP BRIEF/);
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

  it("shows outer SS1 heading and suppresses duplicate inner activity titles", () => {
    render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "interactiveSequence",
          number: 14,
          title: "STEP-BY-STEP PROCESS",
          sequenceSteps: [
            {
              id: "s1",
              title: "Glucose uptake",
              description: "Glucose enters the cell through transport proteins.",
              imageUrl: "https://example.com/step1.png",
              caption: "",
            },
          ],
        }}
      />
    );
    expect(screen.getByRole("heading", { level: 2, name: /14 — STEP-BY-STEP PROCESS/i })).toBeInTheDocument();
    expect(screen.getByTestId("interactive-sequence")).toHaveAttribute("data-hide-title", "1");
  });

  it("suppresses duplicate drag-drop inner title when outer heading is present", () => {
    render(
      <LessonStudentBlockRenderer
        {...baseProps}
        block={{
          type: "dragDropMatch",
          number: 12,
          title: "DRAG AND DROP MATCH",
          pairs: [{ id: "p1", prompt: "ATP", answer: "Energy currency" }],
        }}
      />
    );
    expect(screen.getByRole("heading", { level: 2, name: /12 — DRAG AND DROP MATCH/i })).toBeInTheDocument();
    expect(screen.getByTestId("drag-drop-match")).toHaveAttribute("data-hide-title", "1");
  });
});
