import { applyAccessMode } from "../applyAccessMode";

describe("applyAccessMode", () => {
  test("returns full payload unchanged in full mode", () => {
    const payload = {
      slots: [{ id: "s1", content: "FULL", prompt: "FULL" }],
      metadata: {},
    };

    const result = applyAccessMode(payload, "full");
    expect(result).toEqual(payload);
  });

  test("strips content and limits slots in preview mode", () => {
    const payload = {
      slots: [
        { id: "s1", content: "A" },
        { id: "s2", content: "B" },
        { id: "s3", content: "C" },
        { id: "s4", content: "D" },
      ],
      metadata: {},
    };

    const result = applyAccessMode(payload, "preview");

    expect(result.slots.length).toBe(3);
    expect(result.slots[0].content).toBe("[PREVIEW]");
    expect((result as unknown as { metadata: { preview: boolean } }).metadata.preview).toBe(true);
  });
});
