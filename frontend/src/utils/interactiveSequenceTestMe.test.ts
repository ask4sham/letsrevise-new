import {
  deriveSequenceTestMeQuestion,
  isLikelyLabelCaption,
  resolveSequenceTestMeAnswer,
} from "./interactiveSequenceTestMe";

describe("interactiveSequenceTestMe", () => {
  it("derives question from step title", () => {
    expect(
      deriveSequenceTestMeQuestion({ title: "Step 3: Glucose production" })
    ).toBe('What is the key idea for “Glucose production”?');
  });

  it("uses explicit testQuestion when set", () => {
    expect(
      deriveSequenceTestMeQuestion({
        title: "Step 1",
        testQuestion: "What is absorbed in the chloroplast?",
      })
    ).toBe("What is absorbed in the chloroplast?");
  });

  it("treats short hotspot-style captions as labels when not in description", () => {
    const desc =
      "Glucose is used in respiration, converted to starch, fats/oils, cellulose or amino acids.";
    expect(isLikelyLabelCaption("Oxygen release", "Step 4", desc)).toBe(true);
    expect(
      isLikelyLabelCaption(
        "Glucose is stored as starch and used in respiration.",
        "Step 4",
        desc
      )
    ).toBe(false);
  });

  it("falls back to description when caption is a label", () => {
    const desc =
      "Glucose is used in respiration, converted to starch, fats/oils, cellulose or amino acids.";
    expect(
      resolveSequenceTestMeAnswer(
        { title: "Step 4", caption: "Oxygen release" },
        desc
      )
    ).toBe(desc);
  });
});
