import {
  formatExamLinkIntroBody,
  hasInteractiveSequenceIntroMarkers,
  introSectionBodyToHeadingMarkdown,
  parseInteractiveSequenceIntro,
} from "./parseInteractiveSequenceIntro";

const SAMPLE_INTRO = [
  "🔍 BIG QUESTION How does your body react before you even think?",
  "🎯 YOUR MISSION Work through each stage of the reflex arc in order.",
  "📝 EXAM LINK Stimulus → Receptor → Sensory neurone → Relay neurone → Motor neurone → Effector → Response",
].join(" ");

describe("parseInteractiveSequenceIntro", () => {
  it("detects teaching markers", () => {
    expect(hasInteractiveSequenceIntroMarkers(SAMPLE_INTRO)).toBe(true);
    expect(hasInteractiveSequenceIntroMarkers("Follow the process.")).toBe(false);
  });

  it("parses three labelled sections from a single intro string", () => {
    const sections = parseInteractiveSequenceIntro(SAMPLE_INTRO);
    expect(sections).toHaveLength(3);
    expect(sections?.[0]).toMatchObject({
      id: "big-question",
      label: "🔍 BIG QUESTION",
      body: "How does your body react before you even think?",
    });
    expect(sections?.[1]).toMatchObject({
      id: "your-mission",
      body: "Work through each stage of the reflex arc in order.",
    });
    expect(sections?.[2]?.id).toBe("exam-link");
    expect(sections?.[2]?.body).toContain("Stimulus");
    expect(sections?.[2]?.body).toContain("Response");
  });

  it("returns null for legacy intros without markers", () => {
    expect(parseInteractiveSequenceIntro("Follow each step carefully.")).toBeNull();
  });

  it("formats exam link arrows onto separate lines", () => {
    expect(
      formatExamLinkIntroBody("Stimulus → Receptor → Sensory neurone → Response")
    ).toBe("Stimulus\n→ Receptor\n→ Sensory neurone\n→ Response");
  });

  it("wraps section bodies as markdown h2 headings", () => {
    expect(introSectionBodyToHeadingMarkdown("How does your body react?")).toBe(
      "## How does your body react?"
    );
    expect(introSectionBodyToHeadingMarkdown("## Already a heading")).toBe("## Already a heading");
  });
});
