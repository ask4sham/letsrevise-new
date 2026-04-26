import {
  applyKeyTermsToBlockContent,
  buildKeyTermSpanHtml,
  findFirstUnmarkedTermOccurrence,
  MAX_KEY_TERM_DATA_ATTR_LEN,
  selectionIntersectsDataKeyTermSpan,
  validateAndNormalizeKeyTermForSpan,
} from "./keyTermInlineMarkers";

describe("validateAndNormalizeKeyTermForSpan", () => {
  it('normalizes "osmosis i" to "osmosis"', () => {
    expect(validateAndNormalizeKeyTermForSpan("osmosis i")).toEqual({ ok: true, term: "osmosis" });
  });

  it("trims and strips trailing i (case)", () => {
    expect(validateAndNormalizeKeyTermForSpan("  Diffusion I  ")).toEqual({ ok: true, term: "Diffusion" });
  });

  it("rejects empty", () => {
    expect(validateAndNormalizeKeyTermForSpan("   ")).toEqual({ ok: false, reason: "empty term after trim" });
  });

  it("rejects < > / and newlines", () => {
    expect(validateAndNormalizeKeyTermForSpan("a<b").ok).toBe(false);
    expect(validateAndNormalizeKeyTermForSpan("a>b").ok).toBe(false);
    expect(validateAndNormalizeKeyTermForSpan("a/b").ok).toBe(false);
    expect(validateAndNormalizeKeyTermForSpan("a\nb").ok).toBe(false);
  });

  it(`rejects terms longer than ${MAX_KEY_TERM_DATA_ATTR_LEN} chars`, () => {
    const s = "x".repeat(MAX_KEY_TERM_DATA_ATTR_LEN + 1);
    const r = validateAndNormalizeKeyTermForSpan(s);
    expect(r.ok).toBe(false);
  });
});

describe("buildKeyTermSpanHtml", () => {
  it('builds span with normalized key from "osmosis i"', () => {
    const html = buildKeyTermSpanHtml("osmosis i", "osmosis");
    expect(html).toBe('<span data-key-term="osmosis">osmosis</span>');
  });

  it("returns null for invalid term (e.g. <) without inserting span", () => {
    expect(buildKeyTermSpanHtml("bad<term", "valid")).toBeNull();
  });
});

describe("double-wrap prevention", () => {
  it("applyKeyTermsToBlockContent does not wrap text already inside a data-key-term span", () => {
    const wrapped = '<span data-key-term="osmosis">osmosis</span> in water.';
    const { nextContent, notFoundTerms } = applyKeyTermsToBlockContent(wrapped, [{ term: "osmosis", definition: "" }]);
    expect(nextContent).toBe(wrapped);
    expect(notFoundTerms).toContain("osmosis");
  });

  it("findFirstUnmarkedTermOccurrence returns null for term only present inside a span", () => {
    const c = 'See <span data-key-term="x">x</span> for more.';
    expect(findFirstUnmarkedTermOccurrence(c, "x")).toBeNull();
  });

  it("findFirstUnmarkedTermOccurrence returns outer occurrence when unmarked", () => {
    const c = "x and more x";
    const p = findFirstUnmarkedTermOccurrence(c, "x");
    expect(p).not.toBeNull();
    expect(p!.visible).toBe("x");
  });

  it("selectionIntersectsDataKeyTermSpan is true when selection overlaps a span", () => {
    const c = 'aa<span data-key-term="t">t</span>bb';
    const open = c.indexOf("<span");
    const after = c.indexOf("</span>") + "</span>".length;
    expect(selectionIntersectsDataKeyTermSpan(c, open + 1, after - 1)).toBe(true);
  });
});
