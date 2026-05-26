import {
  truncateDragDropCardLabel,
  computeDiagramZoneChipMaxWidthPx,
  computeScaleToFit,
  DRAG_DROP_BANK_LABEL_MAX_CHARS,
} from "./dragDropCardLayout";

describe("dragDropCardLayout", () => {
  it("truncates long draggable labels", () => {
    const long =
      "Process occurring in muscle cells without oxygen producing lactic acid";
    const short = truncateDragDropCardLabel(long, DRAG_DROP_BANK_LABEL_MAX_CHARS);
    expect(short.length).toBeLessThanOrEqual(DRAG_DROP_BANK_LABEL_MAX_CHARS);
    expect(short.endsWith("…")).toBe(true);
    expect(short).not.toBe(long);
  });

  it("keeps short labels unchanged", () => {
    expect(truncateDragDropCardLabel("Anaerobic respiration")).toBe("Anaerobic respiration");
  });

  it("limits zone chip width on diagram edges", () => {
    const left = computeDiagramZoneChipMaxWidthPx(15, true);
    const right = computeDiagramZoneChipMaxWidthPx(85, false);
    expect(left).toBeLessThanOrEqual(220);
    expect(right).toBeLessThanOrEqual(220);
    expect(left).toBeGreaterThan(90);
  });

  it("computeScaleToFit never upscales and caps minimum scale", () => {
    expect(computeScaleToFit(100, 200)).toBe(1);
    expect(computeScaleToFit(150, 100)).toBeCloseTo(0.667, 2);
    expect(computeScaleToFit(400, 100)).toBe(0.62);
  });
});
