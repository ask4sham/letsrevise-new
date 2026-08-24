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

jest.mock("./InteractiveSequenceIntro", () => ({
  InteractiveSequenceIntro: ({ intro, className }: { intro?: string; className?: string }) =>
    intro ? <p className={className}>{intro}</p> : null,
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

  it("step navigation and images still work when intro contains plain-text step lines", () => {
    const stepIntro = [
      "Process",
      "Photosynthesis in a leaf",
      "- Step 1 — Light is absorbed.",
      "- Step 2 — Carbon dioxide enters.",
    ].join("\n");

    render(
      <div data-visual-block="interactive-sequence">
        <InteractiveSequenceBlock
          blockTitle="Photosynthesis steps"
          intro={stepIntro}
          steps={steps}
          resolveImageUrl={(u) => u}
          enableAiTestMe={false}
          viewMode="student"
        />
      </div>
    );

    expect(screen.getByRole("img", { name: /glucose uptake/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^next$/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByRole("img", { name: /respiration/i })).toBeInTheDocument();
    expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument();
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

  it("hides duplicate block title but keeps step titles", () => {
    render(
      <InteractiveSequenceBlock
        blockTitle="STEP-BY-STEP PROCESS"
        hideBlockTitle
        intro="Follow each stage."
        steps={steps}
        resolveImageUrl={(u) => u}
        enableAiTestMe={false}
        viewMode="student"
      />
    );
    expect(screen.queryByRole("heading", { level: 3, name: /step-by-step process/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: /glucose uptake/i })).toBeInTheDocument();
    expect(screen.getByText(/follow each stage/i)).toBeInTheDocument();
  });
});

const progressiveSteps = [
  {
    id: "p1",
    title: "Glucose uptake",
    description: "Glucose enters the cell.",
    imageUrl: "",
    caption: "Should not show",
  },
  {
    id: "p2",
    title: "Respiration",
    description: "Mitochondria release ATP.",
    imageUrl: "",
    caption: "Also hidden",
  },
  {
    id: "p3",
    title: "Energy use",
    description: "ATP powers cell processes.",
    imageUrl: "",
    caption: "",
  },
];

describe("InteractiveSequenceBlock progressiveReveal", () => {
  beforeAll(() => {
    window.scrollTo = jest.fn();
  });

  it("shows only the first step initially and reveals cumulatively on Continue", () => {
    render(
      <InteractiveSequenceBlock
        blockTitle="Metabolism"
        intro="Follow the process."
        steps={progressiveSteps}
        resolveImageUrl={(u) => u}
        presentationMode="progressiveReveal"
        enableTestMe={false}
        viewMode="student"
      />
    );

    expect(screen.getByText(/glucose enters the cell/i)).toBeInTheDocument();
    expect(screen.queryByText(/mitochondria release atp/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/test me/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continue to step 2 of 3/i }));
    expect(screen.getByText(/mitochondria release atp/i)).toBeInTheDocument();
    expect(screen.getByText(/glucose enters the cell/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continue to step 3 of 3/i }));
    expect(screen.getByText(/atp powers cell processes/i)).toBeInTheDocument();
  });

  it("marks completion after the final Continue and supports Reset", () => {
    render(
      <InteractiveSequenceBlock
        blockTitle="Metabolism"
        intro=""
        steps={progressiveSteps}
        resolveImageUrl={(u) => u}
        presentationMode="progressiveReveal"
        viewMode="student"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /continue to step 2 of 3/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue to step 3 of 3/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue to step 3 of 3/i }));
    expect(screen.getByText(/process complete/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reset activity/i }));
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
    expect(screen.queryByText(/process complete/i)).not.toBeInTheDocument();
  });

  it("does not render Previous, Test me, or caption reveal in progressive mode", () => {
    render(
      <InteractiveSequenceBlock
        blockTitle="Metabolism"
        intro=""
        steps={progressiveSteps}
        resolveImageUrl={(u) => u}
        presentationMode="progressiveReveal"
        viewMode="student"
      />
    );

    expect(screen.queryByRole("button", { name: /^previous$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reveal answer/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/should not show/i)).not.toBeInTheDocument();
  });

  it("shows single-step static completion without Continue", () => {
    render(
      <InteractiveSequenceBlock
        blockTitle="One step"
        intro=""
        steps={[progressiveSteps[0]]}
        resolveImageUrl={(u) => u}
        presentationMode="progressiveReveal"
        viewMode="student"
      />
    );

    expect(screen.getByText(/process complete/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
  });

  it("exposes aria-live progress and keyboard-accessible Continue", () => {
    render(
      <InteractiveSequenceBlock
        blockTitle="Metabolism"
        intro=""
        steps={progressiveSteps}
        resolveImageUrl={(u) => u}
        presentationMode="progressiveReveal"
        viewMode="student"
      />
    );

    const progress = screen.getByText(/step 1 of 3/i);
    expect(progress).toHaveAttribute("aria-live", "polite");

    const continueBtn = screen.getByRole("button", { name: /continue to step 2 of 3/i });
    fireEvent.click(continueBtn);
    expect(screen.getByText(/mitochondria release atp/i)).toBeInTheDocument();
  });

  it("keeps legacy carousel behaviour when presentationMode is absent", () => {
    render(
      <InteractiveSequenceBlock
        blockTitle="Carousel"
        intro=""
        steps={progressiveSteps}
        resolveImageUrl={(u) => u}
        enableAiTestMe={false}
        viewMode="student"
      />
    );

    expect(screen.getByRole("button", { name: /^next$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^previous$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^continue$/i })).not.toBeInTheDocument();
  });
});
