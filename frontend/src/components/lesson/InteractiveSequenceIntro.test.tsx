import React from "react";
import { render, screen } from "@testing-library/react";
import { InteractiveSequenceIntro } from "./InteractiveSequenceIntro";

jest.mock("./LessonMarkdown", () => ({
  LessonMarkdown: ({ children }: { children: string }) => {
    const text = String(children ?? "");
    const heading = text.match(/^##\s+(.+)$/m);
    if (heading) return <h2>{heading[1]}</h2>;
    return <div data-testid="lesson-markdown">{text}</div>;
  },
}));

jest.mock("./LessonRichText", () => ({
  LessonRichText: ({ text, className }: { text: string; className?: string }) => (
    <div data-testid="lesson-rich-text" className={className}>
      {text}
    </div>
  ),
}));

const STRUCTURED_INTRO = [
  "🔍 BIG QUESTION How does your body react before you even think?",
  "🎯 YOUR MISSION Work through each stage of the reflex arc in order.",
  "📝 EXAM LINK Stimulus → Receptor → Sensory neurone → Relay neurone → Motor neurone → Effector → Response",
].join(" ");

const PLAIN_STEP_INTRO = [
  "Work through each step in order.",
  "",
  "Process",
  "Photosynthesis in a leaf",
  "",
  "- Step 1 — Light is absorbed by chlorophyll in chloroplasts.",
  "- Step 2 — Carbon dioxide and water enter the leaf.",
  "- Step 3 — Glucose is produced and stored.",
  "- Step 4 — Oxygen is released to the atmosphere.",
].join("\n");

const HTML_STEP_INTRO = `<ul>
<li><strong>Step 1</strong> — Light hits chloroplast</li>
<li><strong>Step 2</strong> — Water splits</li>
</ul>`;

describe("InteractiveSequenceIntro", () => {
  it("renders plain-text step lines as separate list items", () => {
    const { container } = render(<InteractiveSequenceIntro intro={PLAIN_STEP_INTRO} />);

    const items = container.querySelectorAll(".interactive-sequence__intro-step-item");
    expect(items).toHaveLength(4);
    expect(items[0].textContent).toMatch(/Step 1 — Light is absorbed/i);
    expect(items[1].textContent).toMatch(/Step 2 — Carbon dioxide/i);
    expect(items[3].textContent).toMatch(/Step 4 — Oxygen is released/i);

    expect(screen.getByTestId("lesson-rich-text")).toHaveTextContent(/Work through each step/i);
    expect(screen.getByTestId("lesson-rich-text")).toHaveTextContent(/Photosynthesis in a leaf/i);
    expect(container.querySelector(".interactive-sequence__intro-step-list")).toBeTruthy();
  });

  it("renders inline Step 1 — … Step 2 — … blob as separate list items", () => {
    const intro =
      "Step 1 — Light absorbed Step 2 — Water splits Step 3 — Glucose made Step 4 — Oxygen released";
    const { container } = render(<InteractiveSequenceIntro intro={intro} />);
    const items = container.querySelectorAll(".interactive-sequence__intro-step-item");
    expect(items).toHaveLength(4);
    expect(items[0].textContent).toMatch(/Step 1 — Light absorbed/i);
  });

  it("still renders HTML ul intro via LessonRichText", () => {
    render(<InteractiveSequenceIntro intro={HTML_STEP_INTRO} />);
    expect(screen.getByTestId("lesson-rich-text")).toHaveTextContent(/Step 1/);
    expect(screen.queryByRole("list", { name: /process steps/i })).not.toBeInTheDocument();
    expect(document.querySelector(".interactive-sequence__intro-step-list")).toBeNull();
  });

  it("renders three visually separated sections when teaching markers are present", () => {
    const { container } = render(<InteractiveSequenceIntro intro={STRUCTURED_INTRO} />);

    expect(screen.getByText("Learning goal")).toBeInTheDocument();
    expect(screen.getByText("What to do")).toBeInTheDocument();
    expect(screen.getByText("Exam tip")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { level: 2, name: /how does your body react before you even think/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /work through each stage of the reflex arc/i })
    ).toBeInTheDocument();

    const examLink = container.querySelector(".interactive-sequence__intro-exam-link");
    expect(examLink?.textContent).toContain("Stimulus");
    expect(examLink?.textContent).toContain("→ Receptor");
    expect(examLink?.textContent).toContain("→ Response");

    expect(container.querySelectorAll(".interactive-sequence__intro-section")).toHaveLength(3);
    expect(container.querySelector(".interactive-sequence__intro-step-list")).toBeNull();
  });

  it("falls back to legacy single-paragraph rendering without markers or step lines", () => {
    render(<InteractiveSequenceIntro intro="Follow each step carefully." />);
    expect(screen.getByTestId("lesson-rich-text")).toHaveTextContent("Follow each step carefully.");
    expect(screen.queryByText("Learning goal")).not.toBeInTheDocument();
    expect(document.querySelector(".interactive-sequence__intro-step-list")).toBeNull();
  });
});
