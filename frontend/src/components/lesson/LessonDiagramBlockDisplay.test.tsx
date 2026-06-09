import React from "react";
import { render, screen } from "@testing-library/react";
import { LessonDiagramBlockDisplay } from "./LessonDiagramBlockDisplay";
import { METABOLISM_DEFINED_DIAGRAM_BLOCK } from "../../utils/diagramPedagogyDisplay.fixtures";

jest.mock("./DiagramBlockPedagogy", () => ({
  DiagramBlockPedagogy: ({
    instructions,
    studentTask,
    caption,
    reveal,
    children,
  }: {
    instructions?: string;
    studentTask?: string;
    caption?: string;
    reveal?: { body: string };
    children: React.ReactNode;
  }) => (
    <div data-testid="pedagogy">
      {children}
      {instructions ? <div data-testid="instructions">{instructions}</div> : null}
      {studentTask ? <div data-testid="student-task">{studentTask}</div> : null}
      {reveal?.body ? <div data-testid="reveal">{reveal.body}</div> : null}
      {caption ? <div data-testid="caption">{caption}</div> : null}
    </div>
  ),
}));

describe("LessonDiagramBlockDisplay", () => {
  it("passes cleaned instructions below the diagram image", () => {
    render(
      <LessonDiagramBlockDisplay
        block={{
          title: "Cell diagram",
          subtitle: "<p>Instruction: Study the labels.</p>",
        }}
      >
        <img alt="cell" src="/cell.png" />
      </LessonDiagramBlockDisplay>
    );
    const pedagogy = screen.getByTestId("pedagogy");
    const img = screen.getByAltText("cell");
    const instructions = screen.getByTestId("instructions");
    expect(pedagogy.contains(img)).toBe(true);
    expect(Boolean(img.compareDocumentPosition(instructions) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true
    );
    expect(instructions.textContent).not.toMatch(/<p>/i);
    expect(instructions.textContent).toMatch(/Instruction:/i);
    expect(instructions.textContent).toContain("Study the labels.");
  });

  it("omits duplicate HTML caption when instructions already shown below image", () => {
    render(
      <LessonDiagramBlockDisplay
        block={{
          subtitle: "<p>Task: Label the diagram.</p>",
          caption: "<p>Label the diagram.</p>",
          content: "<p>Label the diagram.</p>",
        }}
      >
        <img alt="cell" src="/cell.png" />
      </LessonDiagramBlockDisplay>
    );
    expect(screen.getByTestId("instructions").textContent).toContain("Label the diagram");
    expect(screen.queryByTestId("caption")).toBeNull();
  });

  it("metabolism fixture: source caption only, no teaching prose below", () => {
    render(
      <LessonDiagramBlockDisplay block={METABOLISM_DEFINED_DIAGRAM_BLOCK}>
        <img alt="metabolism" src="/m.png" />
      </LessonDiagramBlockDisplay>
    );
    expect(screen.queryByTestId("instructions")).toBeNull();
    expect(screen.getByTestId("caption")).toHaveTextContent("Metabolism defined");
    expect(screen.getByTestId("caption").textContent).not.toMatch(/economy|Catabolism/i);
  });

  it("falls back to raw authoring fields when display normalizer omits them", () => {
    render(
      <LessonDiagramBlockDisplay
        block={{
          subtitle: "Study the reflex arc shown in the diagram.",
          studentTask: "Task\n\n1. Name the five stages.",
          caption: "GCSE AQA Biology",
        }}
      >
        <img alt="reflex" src="/reflex.png" />
      </LessonDiagramBlockDisplay>
    );
    expect(screen.getByTestId("instructions")).toHaveTextContent("Study the reflex arc");
    expect(screen.getByTestId("student-task")).toHaveTextContent("Name the five stages");
    expect(screen.getByTestId("caption")).toHaveTextContent("GCSE AQA Biology");
  });

  it("passes dedicated student task below instructions", () => {
    render(
      <LessonDiagramBlockDisplay
        block={{
          title: "Reflex arc",
          subtitle: "Study the reflex arc shown in the diagram.",
          studentTask: "Task\n\n1. Name the five stages.",
          caption: "GCSE AQA Biology",
        }}
      >
        <img alt="reflex" src="/reflex.png" />
      </LessonDiagramBlockDisplay>
    );
    expect(screen.getByTestId("instructions")).toHaveTextContent("Study the reflex arc");
    expect(screen.getByTestId("student-task")).toHaveTextContent("Name the five stages");
    expect(screen.getByTestId("caption")).toHaveTextContent("GCSE AQA Biology");
  });

  it("renders children only when block has no chrome fields", () => {
    render(
      <LessonDiagramBlockDisplay block={{}}>
        <img alt="only" src="/x.png" />
      </LessonDiagramBlockDisplay>
    );
    expect(screen.queryByTestId("pedagogy")).toBeNull();
    expect(screen.getByAltText("only")).toBeInTheDocument();
  });
});
