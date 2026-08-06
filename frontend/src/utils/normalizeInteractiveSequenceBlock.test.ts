import { normalizeInteractiveSequenceBlockForEditor } from "./normalizeInteractiveSequenceBlock";

describe("normalizeInteractiveSequenceBlockForEditor", () => {
  it("preserves progressive-reveal block fields and step metadata", () => {
    const block = {
      id: "block-sequence-1",
      type: "interactiveSequence",
      role: "sequence",
      title: "Mitosis",
      intro: "Follow the stages.",
      presentationMode: "progressiveReveal",
      enableTestMe: false,
      sourceIds: ["spec:topic:ck1"],
      sequenceSteps: [
        {
          id: "step-1",
          title: "Prophase",
          description: "Chromosomes condense.",
          imageUrl: "",
          sourceIds: ["spec:topic:ck1"],
        },
        {
          id: "step-2",
          title: "Metaphase",
          description: "Chromosomes line up.",
          imageUrl: "",
        },
      ],
    };

    const out = normalizeInteractiveSequenceBlockForEditor(block);
    expect(out.id).toBe("block-sequence-1");
    expect(out.presentationMode).toBe("progressiveReveal");
    expect(out.enableTestMe).toBe(false);
    expect(out.sourceIds).toEqual(["spec:topic:ck1"]);
    const steps = out.sequenceSteps as Array<Record<string, unknown>>;
    expect(steps).toHaveLength(2);
    expect(steps[0].id).toBe("step-1");
    expect(steps[1].id).toBe("step-2");
    expect(steps[0].sourceIds).toEqual(["spec:topic:ck1"]);
    expect(steps.map((s) => s.title)).toEqual(["Prophase", "Metaphase"]);
  });

  it("leaves legacy carousel blocks without presentationMode unchanged", () => {
    const block = {
      type: "interactiveSequence",
      intro: "",
      content: "",
      sequenceSteps: [
        {
          id: "legacy-1",
          title: "Step 1",
          description: "Legacy description.",
          imageUrl: "",
          caption: "Key idea",
        },
      ],
    };

    const out = normalizeInteractiveSequenceBlockForEditor(block);
    expect(out.presentationMode).toBeUndefined();
    expect(out.enableTestMe).toBeUndefined();
    const steps = out.sequenceSteps as Array<Record<string, unknown>>;
    expect(steps[0].id).toBe("legacy-1");
    expect(steps[0].caption).toBe("Key idea");
  });
});
