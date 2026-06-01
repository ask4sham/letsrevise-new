/**
 * dragDropMatch sanitisation — text-to-image matchMode must survive save pipeline.
 */
const { describe, it, expect } = require("@jest/globals");
const { sanitisePagesInput } = require("../routes/lessons");

describe("sanitisePagesInput dragDropMatch text-to-image", () => {
  it("preserves matchMode text-to-image, pair imageUrl, and main block imageUrl", () => {
    const pages = sanitisePagesInput(
      [
        {
          pageId: "p1",
          title: "Test",
          order: 1,
          hero: { type: "none", src: "", caption: "" },
          blocks: [
            {
              type: "dragDropMatch",
              matchMode: "textToImage",
              dragDropLayout: "textToImage",
              imageUrl: "/uploads/main-diagram.png",
              pairs: [
                {
                  id: "pair_1",
                  prompt: "Respiration",
                  answer: "Mitochondria",
                  imageUrl: "/uploads/resp.png",
                },
              ],
            },
          ],
        },
      ],
      true
    );

    const block = pages[0].blocks[0];
    expect(block.type).toBe("dragDropMatch");
    expect(block.matchMode).toBe("textToImage");
    expect(block.dragDropLayout).toBe("textToImage");
    expect(block.pairs[0].imageUrl).toBe("/uploads/resp.png");
    expect(block.imageUrl).toBe("/uploads/main-diagram.png");
    expect(block.dropZones).toBeUndefined();
  });

  it("preserves main imageUrl for text-to-image when only block-level image is set", () => {
    const pages = sanitisePagesInput(
      [
        {
          pageId: "p1",
          title: "Test",
          order: 1,
          hero: { type: "none", src: "", caption: "" },
          blocks: [
            {
              type: "dragDropMatch",
              matchMode: "textToImage",
              dragDropLayout: "textToImage",
              imageUrl: "/uploads/main-only.png",
              pairs: [{ id: "pair_1", prompt: "Clue", answer: "Label" }],
            },
          ],
        },
      ],
      true
    );
    const block = pages[0].blocks[0];
    expect(block.matchMode).toBe("textToImage");
    expect(block.imageUrl).toBe("/uploads/main-only.png");
  });

  it("infers text-to-image from pair imageUrl when matchMode omitted", () => {
    const pages = sanitisePagesInput(
      [
        {
          pageId: "p1",
          title: "Test",
          order: 1,
          hero: { type: "none", src: "", caption: "" },
          blocks: [
            {
              type: "dragDropMatch",
              pairs: [
                {
                  id: "pair_1",
                  prompt: "Aerobic",
                  answer: "Mitochondria",
                  imageUrl: "/uploads/mito.png",
                },
              ],
            },
          ],
        },
      ],
      true
    );
    const block = pages[0].blocks[0];
    expect(block.matchMode).toBe("textToImage");
    expect(block.pairs[0].imageUrl).toBe("/uploads/mito.png");
  });
});
