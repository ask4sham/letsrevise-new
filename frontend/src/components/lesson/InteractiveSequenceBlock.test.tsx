import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { InteractiveSequenceBlock } from "./InteractiveSequenceBlock";
import { INTERACTIVE_SEQUENCE_IMAGE_SPACING } from "./student/interactiveSequenceImageSpacing";
jest.mock("../../api/ai", () => ({
  generateSequenceRecallFromStep: jest.fn().mockResolvedValue({
    question: "What happens in this step?",
    answer: "Key idea",
    explanation: "",
  }),
}));

jest.mock("./LessonRichText", () => ({
  LessonRichText: ({ text, className }: { text?: string; className?: string }) =>
    text ? <p className={className}>{text}</p> : null,
}));

const steps = [
  {
    id: "s1",
    title: "Glucose uptake",
    description: "Glucose enters the cell through transport proteins.",
    imageUrl: "https://example.com/step1.display.png",
    caption: "Glucose is absorbed",
    testQuestion: "What enters the cell?",
  },
  {
    id: "s2",
    title: "Respiration",
    description: "Mitochondria release ATP.",
    imageUrl: "https://example.com/step2.png",
    caption: "ATP is released",
  },
];

const COMPACT_SEQUENCE_TEST_CSS = `
  [data-visual-block="interactive-sequence"] .interactive-sequence__main-column { gap: 14px; }
  [data-visual-block="interactive-sequence"] .interactive-sequence__media-zone[data-interactive-sequence-compact-image="compact-v1"] {
    padding: 8px 8px 0;
    min-height: 0;
    height: auto;
  }
`;

describe("InteractiveSequenceBlock compact image layout", () => {
  beforeAll(() => {
    const style = document.createElement("style");
    style.setAttribute("data-testid", "interactive-sequence-compact-test-css");
    style.textContent = COMPACT_SEQUENCE_TEST_CSS;
    document.head.appendChild(style);
    window.scrollTo = jest.fn();
  });

  afterAll(() => {
    document.querySelector('[data-testid="interactive-sequence-compact-test-css"]')?.remove();
  });

  it("renders step image with compact image lane marker", () => {
    const { container } = render(
      <div data-visual-block="interactive-sequence">
        <InteractiveSequenceBlock
          blockTitle="Metabolism steps"
          intro="Follow the process."
          steps={steps}
          resolveImageUrl={(u) => u}
          enableAiTestMe={false}
          viewMode="student"
        />
      </div>
    );

    const zone = container.querySelector(
      `[data-interactive-sequence-compact-image="${INTERACTIVE_SEQUENCE_IMAGE_SPACING.compactImageAttr}"]`
    );
    expect(zone).toBeTruthy();
    expect(screen.getByRole("img", { name: /glucose uptake/i })).toHaveAttribute(
      "src",
      "https://example.com/step1.png"
    );
  });

  it("step navigation and Test me reveal still work", () => {
    render(
      <div data-visual-block="interactive-sequence">
        <InteractiveSequenceBlock
          blockTitle="Metabolism steps"
          intro=""
          steps={steps}
          resolveImageUrl={(u) => u}
          enableAiTestMe={false}
          viewMode="student"
        />
      </div>
    );

    expect(screen.getByRole("button", { name: /^next$/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByRole("img", { name: /respiration/i })).toBeInTheDocument();
    expect(screen.getByText(/mitochondria release atp/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^previous$/i }));
    fireEvent.click(screen.getByRole("button", { name: /reveal answer/i }));
    expect(screen.getByText(/what enters the cell/i)).toBeInTheDocument();
    expect(screen.getAllByText(/glucose enters the cell through transport proteins/i).length).toBeGreaterThanOrEqual(1);
  });

  it("applies compact spacing tokens on media zone and main column", () => {
    const { container } = render(
      <div data-visual-block="interactive-sequence">
        <InteractiveSequenceBlock
          blockTitle="Process"
          intro=""
          steps={steps}
          resolveImageUrl={(u) => u}
          enableAiTestMe={false}
          viewMode="student"
        />
      </div>
    );

    const zone = container.querySelector(
      ".interactive-sequence__media-zone[data-interactive-sequence-compact-image]"
    ) as HTMLElement | null;
    const mainCol = container.querySelector(".interactive-sequence__main-column") as HTMLElement | null;
    expect(zone).toBeTruthy();
    expect(mainCol).toBeTruthy();

    if (typeof window.getComputedStyle === "function" && zone && mainCol) {
      const zoneStyle = window.getComputedStyle(zone);
      const colStyle = window.getComputedStyle(mainCol);
      expect(zoneStyle.paddingTop).toBe(INTERACTIVE_SEQUENCE_IMAGE_SPACING.mediaZonePaddingTop);
      expect(zoneStyle.paddingBottom).toBe(INTERACTIVE_SEQUENCE_IMAGE_SPACING.mediaZonePaddingBottom);
      expect(colStyle.gap).toBe(INTERACTIVE_SEQUENCE_IMAGE_SPACING.mainColumnGap);
    }
  });
});
