/**
 * P1.3B — Unit tests for Visual Explanation diagram profile prompt builder (no LLM spend).
 */
const {
  buildFinalImagePrompt,
  resolveTopicDiagramProfile,
} = require("../../lib/visualExplanation/buildVisualExplanationPrompt");
const { buildVisualStyleContract } = require("../../lib/visualExplanation/visualStyleContract");

describe("resolveTopicDiagramProfile", () => {
  test("Reflex Arc profile resolves from lesson title", () => {
    const resolved = resolveTopicDiagramProfile({
      topic: "The reflex arc – Homeostasis and Response",
      context: "Anchor: Core Learning. Reflex arc pathway from stimulus to response via sensory neurone and relay neurone.",
      subject: "GCSE Biology",
      examBoard: "AQA",
    });
    expect(resolved).not.toBeNull();
    expect(resolved.profileId).toBe("reflex-arc");
  });
});

describe("buildFinalImagePrompt — topic profiles", () => {
  const reflexTopic = "The reflex arc – Homeostasis and Response";
  const reflexContext =
    "Topic: Nervous system. Anchor: Core Learning. Reflex arc from stimulus to effector via sensory neurone, relay neurone, motor neurone.";

  test("Reflex Arc prompt contains all required labels", () => {
    const { finalImagePrompt, profileId } = buildFinalImagePrompt({
      topic: reflexTopic,
      context: reflexContext,
      subject: "GCSE Biology",
      examBoard: "AQA",
      llmImagePrompt: "Simple reflex diagram.",
    });
    expect(profileId).toBe("reflex-arc");
    for (const label of [
      "STIMULUS",
      "RECEPTOR",
      "SENSORY NEURONE",
      "RELAY NEURONE",
      "SPINAL CORD",
      "MOTOR NEURONE",
      "EFFECTOR",
      "RESPONSE",
    ]) {
      expect(finalImagePrompt.toUpperCase()).toContain(label);
    }
  });

  test("Photosynthesis prompt contains chloroplast and reactants/products", () => {
    const { finalImagePrompt, profileId } = buildFinalImagePrompt({
      topic: "Photosynthesis",
      context: "Chloroplast absorbs sunlight. Carbon dioxide and water form glucose and oxygen.",
      subject: "GCSE Biology",
      examBoard: "AQA",
    });
    expect(profileId).toBe("photosynthesis");
    for (const term of [
      "CHLOROPLAST",
      "CARBON DIOXIDE",
      "WATER",
      "GLUCOSE",
      "OXYGEN",
      "CHLOROPHYLL",
      "SUNLIGHT",
    ]) {
      expect(finalImagePrompt.toUpperCase()).toContain(term);
    }
  });

  test("Diffusion prompt contains concentration and net movement", () => {
    const { finalImagePrompt, profileId } = buildFinalImagePrompt({
      topic: "Diffusion",
      context: "Particles move from high concentration to low concentration across a partially permeable membrane.",
      subject: "GCSE Biology",
      examBoard: "AQA",
    });
    expect(profileId).toBe("diffusion");
    for (const term of [
      "HIGH CONCENTRATION",
      "LOW CONCENTRATION",
      "NET MOVEMENT",
      "PARTIALLY PERMEABLE MEMBRANE",
      "PARTICLES",
    ]) {
      expect(finalImagePrompt.toUpperCase()).toContain(term);
    }
  });

  test("Enzymes prompt contains enzyme-substrate complex and products", () => {
    const { finalImagePrompt, profileId } = buildFinalImagePrompt({
      topic: "Enzymes",
      context: "Substrate binds at the active site forming enzyme-substrate complex; products are released.",
      subject: "GCSE Biology",
      examBoard: "AQA",
    });
    expect(profileId).toBe("enzymes");
    for (const term of [
      "ENZYME",
      "ACTIVE SITE",
      "SUBSTRATE",
      "ENZYME-SUBSTRATE COMPLEX",
      "PRODUCTS",
    ]) {
      expect(finalImagePrompt.toUpperCase()).toContain(term);
    }
  });

  test("Reaction time practical prompt contains ruler setup labels", () => {
    const { finalImagePrompt, profileId } = buildFinalImagePrompt({
      topic: "Reaction time required practical",
      context: "Ruler drop test: zero mark at catcher's hand, measure drop distance, repeats improve reliability, control variable.",
      subject: "GCSE Biology",
      examBoard: "AQA",
    });
    expect(profileId).toBe("reaction-time-practical");
    for (const term of [
      "RULER",
      "ZERO MARK",
      "CATCHER'S HAND",
      "DROP DISTANCE",
      "REACTION TIME",
      "CONTROL VARIABLE",
      "REPEATS",
    ]) {
      expect(finalImagePrompt.toUpperCase()).toContain(term);
    }
  });

  test("Unknown topic falls back to generic style contract without profile id", () => {
    const { finalImagePrompt, profileId } = buildFinalImagePrompt({
      topic: "The structure of the leaf",
      context: "Epidermis, palisade mesophyll, stomata.",
      subject: "GCSE Biology",
      examBoard: "AQA",
    });
    expect(profileId).toBeNull();
    expect(finalImagePrompt).toMatch(/clear labelled GCSE diagram/i);
    expect(finalImagePrompt).toMatch(/Let[\u2019']s Revise visual style/i);
  });

  test("Final prompt includes LetsRevise visual style rules", () => {
    const style = buildVisualStyleContract({ subject: "GCSE Biology", examBoard: "AQA" });
    expect(style).toMatch(/White background/i);
    expect(style).toMatch(/No photorealism/i);
    expect(style).toMatch(/UPPERCASE labels/i);

    const { finalImagePrompt } = buildFinalImagePrompt({
      topic: "Cell structure",
      subject: "GCSE Biology",
      examBoard: "AQA",
    });
    expect(finalImagePrompt).toMatch(/Let[\u2019']s Revise visual style/i);
    expect(finalImagePrompt).toMatch(/White background/i);
    expect(finalImagePrompt).toMatch(/No photorealism/i);
  });
});
