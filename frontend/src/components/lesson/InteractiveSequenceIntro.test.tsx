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

const STRUCTURED_INTRO = [
  "🔍 BIG QUESTION How does your body react before you even think?",
  "🎯 YOUR MISSION Work through each stage of the reflex arc in order.",
  "📝 EXAM LINK Stimulus → Receptor → Sensory neurone → Relay neurone → Motor neurone → Effector → Response",
].join(" ");

describe("InteractiveSequenceIntro", () => {
  it("renders three visually separated sections when teaching markers are present", () => {
    const { container } = render(<InteractiveSequenceIntro intro={STRUCTURED_INTRO} />);

    expect(screen.getByText("🔍 BIG QUESTION")).toBeInTheDocument();
    expect(screen.getByText("🎯 YOUR MISSION")).toBeInTheDocument();
    expect(screen.getByText("📝 EXAM LINK")).toBeInTheDocument();

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
  });

  it("falls back to legacy single-paragraph rendering without markers", () => {
    render(<InteractiveSequenceIntro intro="Follow each step carefully." />);
    expect(screen.getByText("Follow each step carefully.")).toBeInTheDocument();
    expect(screen.queryByText("🔍 BIG QUESTION")).not.toBeInTheDocument();
  });
});
