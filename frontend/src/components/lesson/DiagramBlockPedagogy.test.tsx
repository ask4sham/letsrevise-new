import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiagramBlockPedagogy } from "./DiagramBlockPedagogy";
import { diagramPedagogyDisplayFromBlock } from "../../utils/diagramPedagogyDisplay";
import {
  DIAGRAM_WITH_REVEAL_BLOCK,
  METABOLISM_GLUCOSE_JOURNEY_TASK_BLOCK,
  METABOLISM_MAP_DIAGRAM_BLOCK,
} from "../../utils/diagramPedagogyDisplay.fixtures";

jest.mock("./LessonMarkdown", () => ({
  LessonMarkdown: ({ children }: { children: string }) => (
    <div data-testid="lesson-markdown">{children}</div>
  ),
}));

function nodeFollows(reference: Node, target: Node | null): boolean {
  if (!target) return false;
  return Boolean(reference.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe("DiagramBlockPedagogy", () => {
  it("renders instructions below the image, not above", () => {
    const { container } = render(
      <DiagramBlockPedagogy instructions="Label the diagram.">
        <img alt="fig" src="/x.png" />
      </DiagramBlockPedagogy>
    );
    const img = screen.getByAltText("fig");
    const instructions = container.querySelector('[data-testid="diagram-instructions"]');
    const media = container.querySelector(".lr-diagram-pedagogy__media");

    expect(container.querySelector(".lr-diagram-pedagogy__instructions-heading")).toHaveTextContent(
      "Instructions"
    );
    expect(instructions).toHaveTextContent("Label the diagram.");
    expect(media?.contains(img)).toBe(true);
    expect(nodeFollows(img, instructions!)).toBe(true);
    expect(container.querySelectorAll('[data-testid="diagram-instructions"]')).toHaveLength(1);
  });

  it("renders student task box with Task heading", () => {
    const { container } = render(
      <DiagramBlockPedagogy studentTask={"Task:\n- Identify one pathway\n- Identify another"}>
        <img alt="fig" src="/x.png" />
      </DiagramBlockPedagogy>
    );
    const task = container.querySelector('[data-testid="diagram-student-task"]');
    expect(task).toHaveClass("lr-diagram-pedagogy__student-task");
    expect(container.querySelector(".lr-diagram-pedagogy__student-task-heading")).toHaveTextContent(
      "Task"
    );
    expect(task).toHaveTextContent("Identify one pathway");
  });

  it("places reveal answer directly below student task", () => {
    const display = diagramPedagogyDisplayFromBlock({
      ...DIAGRAM_WITH_REVEAL_BLOCK,
      subtitle: "Instruction: Label the organelles on the diagram.",
    });
    const { container } = render(
      <DiagramBlockPedagogy
        instructions={display.instructions}
        studentTask={display.studentTask}
        reveal={display.reveal}
      >
        <img alt="fig" src="/x.png" />
      </DiagramBlockPedagogy>
    );
    const studentTask = container.querySelector('[data-testid="diagram-student-task"]');
    const reveal = container.querySelector(".lr-diagram-pedagogy-reveal");
    expect(nodeFollows(studentTask!, reveal)).toBe(true);
  });

  it("hides reveal body until summary is opened", async () => {
    const display = diagramPedagogyDisplayFromBlock(DIAGRAM_WITH_REVEAL_BLOCK);
    render(
      <DiagramBlockPedagogy
        instructions={display.instructions}
        studentTask={display.studentTask}
        reveal={display.reveal}
      >
        <img alt="fig" src="/x.png" />
      </DiagramBlockPedagogy>
    );
    expect(screen.getByText(/mitochondria/i)).not.toBeVisible();
    await userEvent.click(screen.getByText(/Reveal answer/i));
    expect(screen.getByText(/mitochondria/i)).toBeVisible();
  });

  it("shows glucose journey task below image with hidden model answer", async () => {
    const display = diagramPedagogyDisplayFromBlock(METABOLISM_GLUCOSE_JOURNEY_TASK_BLOCK);
    const { container } = render(
      <DiagramBlockPedagogy
        title={display.title}
        studentTask={display.studentTask ?? display.visibleInstructions}
        reveal={display.hiddenAnswer}
      >
        <img alt="metabolism map" src="/map.png" />
      </DiagramBlockPedagogy>
    );
    const img = screen.getByAltText("metabolism map");
    const studentTask = container.querySelector('[data-testid="diagram-student-task"]');
    const reveal = container.querySelector(".lr-diagram-pedagogy-reveal");

    expect(nodeFollows(img, studentTask!)).toBe(true);
    expect(nodeFollows(studentTask!, reveal)).toBe(true);
    expect(container.querySelector(".lr-diagram-pedagogy__student-task-heading")).toHaveTextContent(
      "Task"
    );
    expect(studentTask).toHaveTextContent(/Identify one pathway where glucose is broken down/i);
    expect(screen.getByText(/Catabolic reactions such as respiration/i)).not.toBeVisible();
    await userEvent.click(screen.getByText(/Reveal answer/i));
    expect(screen.getByText(/Catabolic reactions such as respiration/i)).toBeVisible();
  });

  it("renders instructions and student task as separate sections", () => {
    const { container } = render(
      <DiagramBlockPedagogy
        instructions="Study the reflex arc shown in the diagram."
        studentTask={"Task\n\n1. Name the five stages."}
      >
        <img alt="fig" src="/x.png" />
      </DiagramBlockPedagogy>
    );
    expect(container.querySelector(".lr-diagram-pedagogy__instructions-heading")).toHaveTextContent(
      "Instructions"
    );
    expect(container.querySelector('[data-testid="diagram-instructions"]')).toHaveTextContent(
      "Study the reflex arc shown in the diagram."
    );
    expect(container.querySelector('[data-testid="diagram-student-task"]')).toHaveTextContent(
      "Name the five stages."
    );
  });

  it("does not render pedagogy title when it duplicates the block heading", () => {
    const display = diagramPedagogyDisplayFromBlock(METABOLISM_MAP_DIAGRAM_BLOCK);
    const { container } = render(
      <DiagramBlockPedagogy title={display.title} caption={display.caption}>
        <img alt="map" src="/map.png" />
      </DiagramBlockPedagogy>
    );
    expect(display.title).toBeUndefined();
    expect(container.querySelector(".lr-diagram-pedagogy__title")).toBeNull();
    expect(screen.queryByTestId("diagram-instructions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("diagram-student-task")).not.toBeInTheDocument();
  });
});
