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
      <DiagramBlockPedagogy subtitle="Label the diagram.">
        <img alt="fig" src="/x.png" />
      </DiagramBlockPedagogy>
    );
    const img = screen.getByAltText("fig");
    const instructions = container.querySelector('[data-testid="diagram-task"]');
    const media = container.querySelector(".lr-diagram-pedagogy__media");

    expect(instructions).toHaveTextContent("Label the diagram.");
    expect(media?.contains(img)).toBe(true);
    expect(nodeFollows(img, instructions!)).toBe(true);
    expect(container.querySelectorAll('[data-testid="diagram-task"]')).toHaveLength(1);
  });

  it("left-aligns task/instructions", () => {
    const { container } = render(
      <DiagramBlockPedagogy subtitle={"Task:\n- Identify one pathway\n- Identify another"}>
        <img alt="fig" src="/x.png" />
      </DiagramBlockPedagogy>
    );
    const task = container.querySelector('[data-testid="diagram-task"]');
    expect(task).toHaveStyle({ textAlign: "left" });
    expect(task).toHaveClass("lr-diagram-pedagogy__subtitle");
  });

  it("places reveal answer directly below instructions", () => {
    const display = diagramPedagogyDisplayFromBlock({
      ...DIAGRAM_WITH_REVEAL_BLOCK,
      subtitle: "Instruction: Label the organelles on the diagram.",
    });
    const { container } = render(
      <DiagramBlockPedagogy subtitle={display.instructions} reveal={display.reveal}>
        <img alt="fig" src="/x.png" />
      </DiagramBlockPedagogy>
    );
    const instructions = container.querySelector('[data-testid="diagram-task"]');
    const reveal = container.querySelector(".lr-diagram-pedagogy-reveal");
    expect(nodeFollows(instructions!, reveal)).toBe(true);
  });

  it("hides reveal body until summary is opened", async () => {
    const display = diagramPedagogyDisplayFromBlock(DIAGRAM_WITH_REVEAL_BLOCK);
    render(
      <DiagramBlockPedagogy subtitle={display.instructions} reveal={display.reveal}>
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
        subtitle={display.visibleInstructions}
        reveal={display.hiddenAnswer}
      >
        <img alt="metabolism map" src="/map.png" />
      </DiagramBlockPedagogy>
    );
    const img = screen.getByAltText("metabolism map");
    const instructions = container.querySelector('[data-testid="diagram-task"]');
    const reveal = container.querySelector(".lr-diagram-pedagogy-reveal");

    expect(nodeFollows(img, instructions!)).toBe(true);
    expect(nodeFollows(instructions!, reveal)).toBe(true);
    expect(instructions).toHaveTextContent(/Task:/i);
    expect(instructions).toHaveTextContent(/Identify one pathway where glucose is broken down/i);
    expect(screen.getByText(/Catabolic reactions such as respiration/i)).not.toBeVisible();
    await userEvent.click(screen.getByText(/Reveal answer/i));
    expect(screen.getByText(/Catabolic reactions such as respiration/i)).toBeVisible();
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
    expect(screen.queryByTestId("diagram-task")).not.toBeInTheDocument();
  });
});
