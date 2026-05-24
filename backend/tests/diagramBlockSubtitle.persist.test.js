/**
 * Diagram block subtitle must survive lesson save sanitisation.
 */
const { sanitisePagesInput } = require("../routes/lessons");

const SUBTITLE =
  "Follow how oxygen, carbon dioxide, and energy move through the body during exercise. Compare what happens during aerobic respiration and anaerobic respiration in muscle cells.";

describe("diagram block subtitle persistence", () => {
  test("sanitisePagesInput preserves diagram title and subtitle", () => {
    const pages = sanitisePagesInput(
      [
        {
          pageId: "page-1",
          title: "Respiration",
          order: 1,
          blocks: [
            {
              type: "diagram",
              title: "Respiration during exercise",
              subtitle: SUBTITLE,
              caption: "Source: exam board specimen",
              imageUrl: "/uploads/lesson-media/diagram.png",
              mode: "static",
            },
          ],
        },
      ],
      true
    );

    const diagram = pages[0].blocks[0];
    expect(diagram.type).toBe("diagram");
    expect(diagram.title).toBe("Respiration during exercise");
    expect(diagram.subtitle).toBe(SUBTITLE);
    expect(diagram.caption).toBe("Source: exam board specimen");
    expect(diagram.imageUrl).toBe("/uploads/lesson-media/diagram.png");
  });

  test("omits subtitle when empty (backward compatible)", () => {
    const pages = sanitisePagesInput(
      [
        {
          pageId: "page-1",
          title: "Old lesson",
          order: 1,
          blocks: [{ type: "diagram", caption: "Cell diagram", mode: "static" }],
        },
      ],
      true
    );
    expect(pages[0].blocks[0].subtitle).toBeUndefined();
  });
});
