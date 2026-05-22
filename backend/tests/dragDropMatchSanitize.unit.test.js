/**
 * dragDropMatch sanitisation — text-to-image matchMode must survive save pipeline.
 */
const { describe, it, expect } = require("@jest/globals");
const { sanitisePagesInput } = require("../routes/lessons");

describe("sanitisePagesInput dragDropMatch text-to-image", () => {
  it("preserves matchMode text-to-image and pair imageUrl", () => {
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
    expect(block.imageUrl).toBeUndefined();
    expect(block.dropZones).toBeUndefined();
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
