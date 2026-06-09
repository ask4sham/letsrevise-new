import {
  formatExamLinkIntroBody,
  hasInteractiveSequenceIntroMarkers,
  introSectionBodyToHeadingMarkdown,
  parseInteractiveSequenceIntro,
  parseInteractiveSequenceIntroStepList,
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

  it("parses plain-text step lines with preamble", () => {
    const intro = [
      "Work through each step in order.",
      "",
      "Process",
      "Photosynthesis in a leaf",
      "",
      "Exam link",
      "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂",
      "",
      "- Step 1 — Light is absorbed by chlorophyll in chloroplasts. ↓",
      "- Step 2 — Carbon dioxide and water enter the leaf. ↓",
      "- Step 3 — Glucose is produced and stored. ↓",
      "- Step 4 — Oxygen is released to the atmosphere.",
    ].join("\n");

    const parsed = parseInteractiveSequenceIntroStepList(intro);
    expect(parsed?.steps).toHaveLength(4);
    expect(parsed?.steps[0]).toMatch(/Step 1 — Light is absorbed/i);
    expect(parsed?.steps[3]).toMatch(/Step 4 — Oxygen is released/i);
    expect(parsed?.preamble).toContain("Work through each step");
    expect(parsed?.preamble).toContain("Photosynthesis in a leaf");
  });

  it("parses inline Step N — blob without newlines", () => {
    const intro =
      "Step 1 — Boil leaf in hot water Step 2 — Heat leaf in ethanol Step 3 — Rinse leaf Step 4 — Add iodine";
    const parsed = parseInteractiveSequenceIntroStepList(intro);
    expect(parsed?.steps).toHaveLength(4);
    expect(parsed?.steps[0]).toMatch(/Step 1 — Boil leaf/i);
    expect(parsed?.preamble).toBe("");
  });

  it("returns null for HTML intros (LessonRichText owns list rendering)", () => {
    const html = `<ul><li><strong>Step 1</strong> — Light hits chloroplast</li></ul>`;
    expect(parseInteractiveSequenceIntroStepList(html)).toBeNull();
  });

  it("returns null when teaching markers are present", () => {
    expect(parseInteractiveSequenceIntroStepList(SAMPLE_INTRO)).toBeNull();
  });
});
