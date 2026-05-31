/**
 * Ensures step-by-step compact image CSS does not alter uploaded diagram activity spacing.
 */
import { UPLOADED_DIAGRAM_ACTIVITY_SPACING } from "./uploadedDiagramActivitySpacing";
import { INTERACTIVE_SEQUENCE_IMAGE_SPACING } from "./interactiveSequenceImageSpacing";

describe("visual block spacing guards", () => {
  it("interactive sequence compact marker is distinct from uploaded diagram shell", () => {
    expect(INTERACTIVE_SEQUENCE_IMAGE_SPACING.compactImageAttr).toBe("compact-v1");
    expect(INTERACTIVE_SEQUENCE_IMAGE_SPACING.compactImageAttr).not.toBe("compact-v2");
    expect(UPLOADED_DIAGRAM_ACTIVITY_SPACING.shellFlexGap).toBe("8px");
    expect(INTERACTIVE_SEQUENCE_IMAGE_SPACING.mainColumnGap).toBe("14px");
  });

  it("uploaded diagram activity spacing constants unchanged", () => {
    expect(UPLOADED_DIAGRAM_ACTIVITY_SPACING).toEqual({
      shellFlexGap: "8px",
      blockHeadingMarginBottom: "0px",
      diagramSlotMarginTop: "0px",
      headingToImageMaxPx: 20,
    });
  });
});
