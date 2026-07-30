/**
 * Unit: resolveImageContext — resolvable visual media only (V2.3B1 warning fix).
 * Empty/type-only stubs must not require image context.
 */
const {
  resolveImageContext,
  MIN_IMAGE_CONTEXT_CHARS,
} = require("../services/examQuestionRationaleCandidateService");
const mongoose = require("mongoose");

const TRUSTED_ALT = "Bar chart showing rate of photosynthesis against light intensity.";

describe("resolveImageContext resolvable-media rule", () => {
  test("A: no image fields → not required", () => {
    const r = resolveImageContext({});
    expect(r.ok).toBe(true);
    expect(r.imageContextText).toBe("");
    expect(r.code).toBeUndefined();
  });

  test("B: empty imageUrl and empty assets → not required", () => {
    const r = resolveImageContext({ imageUrl: "", assets: [] });
    expect(r.ok).toBe(true);
    expect(r.imageContextText).toBe("");
  });

  test("C: empty stub object → not required", () => {
    const r = resolveImageContext({ assets: [{}] });
    expect(r.ok).toBe(true);
    expect(r.imageContextText).toBe("");
  });

  test("D: typed blank stub → not required", () => {
    const r = resolveImageContext({
      assets: [{ type: "image", url: null, alt: null }],
    });
    expect(r.ok).toBe(true);
    expect(r.imageContextText).toBe("");
  });

  test("E: diagram stub with blank media → not required", () => {
    const r = resolveImageContext({
      assets: [{ type: "diagram", url: "", mediaId: null, alt: "" }],
    });
    expect(r.ok).toBe(true);
    expect(r.imageContextText).toBe("");
  });

  test("F: real asset URL without trusted context → IMAGE_CONTEXT_REQUIRED", () => {
    const r = resolveImageContext({
      assets: [{ type: "image", url: "https://example.com/fig.png", alt: "" }],
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("IMAGE_CONTEXT_REQUIRED");
  });

  test("G: real asset mediaId without trusted context → IMAGE_CONTEXT_REQUIRED", () => {
    const r = resolveImageContext({
      assets: [
        {
          type: "image",
          url: null,
          mediaId: new mongoose.Types.ObjectId(),
          alt: "",
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("IMAGE_CONTEXT_REQUIRED");
  });

  test("H: question-level imageUrl without trusted context → IMAGE_CONTEXT_REQUIRED", () => {
    const r = resolveImageContext({ imageUrl: "https://example.com/fig.png" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("IMAGE_CONTEXT_REQUIRED");
  });

  test("I: real visual reference with trusted alt → available", () => {
    expect(TRUSTED_ALT.length).toBeGreaterThanOrEqual(MIN_IMAGE_CONTEXT_CHARS);
    const r = resolveImageContext({
      imageUrl: "https://example.com/fig.png",
      assets: [{ type: "image", url: "https://example.com/fig.png", alt: TRUSTED_ALT }],
    });
    expect(r.ok).toBe(true);
    expect(r.imageContextText).toBe(TRUSTED_ALT);
  });

  test("J: trusted context shorter than minimum → IMAGE_CONTEXT_REQUIRED", () => {
    const short = "x".repeat(Math.max(0, MIN_IMAGE_CONTEXT_CHARS - 1));
    const r = resolveImageContext({
      assets: [{ type: "image", url: "https://example.com/fig.png", alt: short }],
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("IMAGE_CONTEXT_REQUIRED");
  });

  test("PDF URL alone is not treated as answer-critical visual media", () => {
    const r = resolveImageContext({
      assets: [{ type: "pdf", url: "https://example.com/notes.pdf", alt: "" }],
    });
    expect(r.ok).toBe(true);
    expect(r.imageContextText).toBe("");
  });

  test("question text mentioning diagram does not create dependency", () => {
    const r = resolveImageContext({
      sharedStem: "Look at the diagram above.",
      question: "Which statement about the graph is correct?",
    });
    expect(r.ok).toBe(true);
  });
});
