import React from "react";
import { render, screen } from "@testing-library/react";
import { DiagramBlockPedagogy } from "./DiagramBlockPedagogy";
import { diagramPedagogyDisplayFromBlock } from "../../utils/diagramPedagogyDisplay";
import { METABOLISM_GLUCOSE_JOURNEY_TASK_BLOCK } from "../../utils/diagramPedagogyDisplay.fixtures";
import { DIAGRAM_PEDAGOGY_SPACING } from "./diagramPedagogySpacing";
import "./diagramBlockPedagogy.css";
import "./diagramPedagogyReveal.css";

jest.mock("./LessonMarkdown", () => ({
  LessonMarkdown: ({ children }: { children: string }) => (
    <div data-testid="lesson-markdown">{children}</div>
  ),
}));

function pedagogyLayoutSnapshot(container: HTMLElement): {
  spacing: typeof DIAGRAM_PEDAGOGY_SPACING;
  order: string[];
} {
  const root = container.querySelector(".lr-diagram-pedagogy");
  const order: string[] = [];
  if (root?.querySelector(".lr-diagram-pedagogy__title")) order.push("title");
  if (root?.querySelector(".lr-diagram-pedagogy__media")) order.push("media");
  if (root?.querySelector('[data-testid="diagram-task"]')) order.push("task");
  if (root?.querySelector(".lr-diagram-pedagogy-reveal")) order.push("reveal");
  if (root?.querySelector(".lr-diagram-pedagogy__caption")) order.push("caption");
  return { spacing: DIAGRAM_PEDAGOGY_SPACING, order };
}

function nodeFollows(reference: Node, target: Node | null): boolean {
  if (!target) return false;
  return Boolean(reference.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe("DiagramBlockPedagogy spacing regression", () => {
  it("matches compact spacing contract snapshot", () => {
    expect(DIAGRAM_PEDAGOGY_SPACING).toMatchSnapshot();
  });

  it("metabolism diagram block uses compact layout snapshot", () => {
    const display = diagramPedagogyDisplayFromBlock(METABOLISM_GLUCOSE_JOURNEY_TASK_BLOCK);
    const { container } = render(
      <DiagramBlockPedagogy subtitle={display.visibleInstructions} reveal={display.hiddenAnswer}>
        <img alt="metabolism map" src="/map.png" />
      </DiagramBlockPedagogy>
    );

    expect(pedagogyLayoutSnapshot(container)).toMatchSnapshot();
  });

  it("keeps DOM order title → image → task → reveal with no duplicate task above image", () => {
    const display = diagramPedagogyDisplayFromBlock(METABOLISM_GLUCOSE_JOURNEY_TASK_BLOCK);
    const { container } = render(
      <DiagramBlockPedagogy subtitle={display.visibleInstructions} reveal={display.hiddenAnswer}>
        <img alt="metabolism map" src="/map.png" />
      </DiagramBlockPedagogy>
    );

    const img = screen.getByAltText("metabolism map");
    const task = container.querySelector('[data-testid="diagram-task"]');
    const reveal = container.querySelector(".lr-diagram-pedagogy-reveal");

    expect(container.querySelectorAll('[data-testid="diagram-task"]')).toHaveLength(1);
    expect(nodeFollows(img, task)).toBe(true);
    expect(nodeFollows(task!, reveal)).toBe(true);

    const title = container.querySelector(".lr-diagram-pedagogy__title");
    if (title) expect(nodeFollows(title, img)).toBe(true);
  });
});
