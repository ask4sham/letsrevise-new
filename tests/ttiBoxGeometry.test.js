/**
 * Canonical Text-to-Image box geometry — shared spec loader tests.
 */

const {
  TTI_BOX_GEOMETRY_V1,
  normalizeTtiBoxGeometryVersion,
  getTtiBoxGeometryLayout,
  formatTtiBoxGeometryContractLines,
  formatTtiImageMarkerContractLines,
} = require("../lib/ttiBoxGeometry");

describe("ttiBoxGeometry", () => {
  test("loads v1 square-display box dimensions", () => {
    const sq = getTtiBoxGeometryLayout("square-display");
    expect(sq.box.widthPx).toBe(156);
    expect(sq.box.heightPx).toBe(76);
    expect(sq.box.centerXPx).toBe(421.5);
    expect(sq.box.centerXPct).toBe(70.25);
  });

  test("loads v1 A/B/C/D centre Y values on 600×600 display", () => {
    const sq = getTtiBoxGeometryLayout("square-display");
    expect(sq.zones.map((z) => z.letter)).toEqual(["A", "B", "C", "D"]);
    expect(sq.zones.map((z) => z.centerYPct)).toEqual([25.42, 47.17, 67.83, 88.75]);
    expect(sq.zones.map((z) => z.centerYPx)).toEqual([152.5, 283, 407, 532.5]);
  });

  test("loads v1 portrait derivative geometry", () => {
    const pt = getTtiBoxGeometryLayout("portrait");
    expect(pt.box.widthPx).toBe(234);
    expect(pt.box.heightPx).toBe(114);
    expect(pt.box.centerXPct).toBeCloseTo(82.67, 2);
    expect(pt.zones[0].centerYPct).toBe(25.42);
    expect(pt.zones[3].centerYPct).toBe(88.75);
  });

  test("legacy version preserves pre-v1 runtime overlay geometry", () => {
    const legacy = getTtiBoxGeometryLayout("square-display", "legacy");
    expect(legacy.box.heightPct).toBe(14);
    expect(legacy.zones[0].centerYPct).toBe(25.92);
    expect(legacy.zones[3].centerYPct).toBe(91.08);
  });

  test("normalizeTtiBoxGeometryVersion defaults to v1", () => {
    expect(normalizeTtiBoxGeometryVersion(null)).toBe("tti-box-geometry-v1");
    expect(normalizeTtiBoxGeometryVersion("legacy")).toBe("legacy");
  });

  test("formatTtiBoxGeometryContractLines includes canonical dimensions", () => {
    const lines = formatTtiBoxGeometryContractLines();
    const text = lines.join("\n");
    expect(text).toMatch(/156×76 px/);
    expect(text).toMatch(/234×114 px/);
    expect(text).toMatch(/421\.5 px \(70\.25%\)/);
    expect(text).toMatch(/A 152\.5 px \(25\.42%\)/);
    expect(text).toMatch(/tti-box-geometry-v1/);
  });

  test("formatTtiImageMarkerContractLines forbids printed rectangles", () => {
    const lines = formatTtiImageMarkerContractLines();
    const text = lines.join("\n");
    expect(text).toMatch(/Marker centre X on 600×600 display: 421\.5 px/);
    expect(text).toMatch(/reserve clean blank white space 156×76 px/);
    expect(text).toMatch(/do NOT draw a rectangle or border around it/i);
    expect(text).toMatch(/application draws all drop-zone rectangles/i);
    expect(text).not.toMatch(/four identical empty boxes/i);
  });

  test("shared JSON version field matches module constant", () => {
    expect(TTI_BOX_GEOMETRY_V1.version).toBe("tti-box-geometry-v1");
    expect(TTI_BOX_GEOMETRY_V1.displayArtboard).toEqual({ width: 600, height: 600 });
  });

  test("shared JSON matches frontend bundle copy", () => {
    const frontendCopy = require("../frontend/src/shared/ttiBoxGeometry.v1.json");
    expect(frontendCopy).toEqual(TTI_BOX_GEOMETRY_V1);
  });
});
