import {
  applyKeyTermsToBlockContent,
  buildKeyTermSpanHtml,
  findFirstUnmarkedTermOccurrence,
  MAX_KEY_TERM_DATA_ATTR_LEN,
  removeDataKeyTermSpansInRange,
  resolveSelectionForRemoveKeyTerm,
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
    const { nextContent, notFoundTerms } = applyKeyTermsToBlockContent(wrapped, [
      { term: "osmosis", definition: "" },
    ]);
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

describe("removeDataKeyTermSpansInRange", () => {
  it("removes one data-key-term span and keeps the text", () => {
    const c = '<p><span data-key-term="Gamete">Gamete</span> means sex cell.</p>';
    const start = c.indexOf("<span");
    const end = c.indexOf("</span>") + "</span>".length;
    const { nextContent, removed } = removeDataKeyTermSpansInRange(c, start, end);
    expect(removed).toBe(1);
    expect(nextContent).toBe("<p>Gamete means sex cell.</p>");
  });

  it("removes key term inside bold and keeps bold", () => {
    const c =
      '<p><strong><span data-key-term="Meiosis">Meiosis</span></strong> halves the chromosome number.</p>';
    const start = c.indexOf("<span");
    const { nextContent, removed } = removeDataKeyTermSpansInRange(c, start + 10, start + 12);
    expect(removed).toBe(1);
    expect(nextContent).toBe(
      "<p><strong>Meiosis</strong> halves the chromosome number.</p>"
    );
  });

  it("removes multiple selected key-term spans", () => {
    const c =
      'A <span data-key-term="Meiosis">Meiosis</span> and <span data-key-term="Mitosis">Mitosis</span> end.';
    const { nextContent, removed } = removeDataKeyTermSpansInRange(c, 0, c.length);
    expect(removed).toBe(2);
    expect(nextContent).toBe("A Meiosis and Mitosis end.");
  });

  it("does not remove unrelated spans", () => {
    const c =
      '<span class="lesson-inline lesson-fc-red">Red</span> and <span data-key-term="Clone">Clone</span>.';
    const start = c.indexOf("data-key-term");
    const open = c.lastIndexOf("<span", start);
    const end = c.indexOf("</span>", start) + "</span>".length;
    const { nextContent, removed } = removeDataKeyTermSpansInRange(c, open, end);
    expect(removed).toBe(1);
    expect(nextContent).toBe(
      '<span class="lesson-inline lesson-fc-red">Red</span> and Clone.'
    );
  });

  it("does not change plain text with no key terms", () => {
    const c = "<p><strong>Meiosis</strong> halves the chromosome number.</p>";
    const { nextContent, removed } = removeDataKeyTermSpansInRange(c, 0, c.length);
    expect(removed).toBe(0);
    expect(nextContent).toBe(c);
  });

  it("unwraps when caret is inside a key-term span", () => {
    const c = 'See <span data-key-term="x">xyz</span> here.';
    const inner = c.indexOf("xyz") + 1;
    const { nextContent, removed } = removeDataKeyTermSpansInRange(c, inner, inner);
    expect(removed).toBe(1);
    expect(nextContent).toBe("See xyz here.");
  });

  it("existing add key-term behaviour still works after remove helpers exist", () => {
    const html = buildKeyTermSpanHtml("osmosis", "osmosis");
    expect(html).toBe('<span data-key-term="osmosis">osmosis</span>');
    const { nextContent } = applyKeyTermsToBlockContent("osmosis in water.", [
      { term: "osmosis", definition: "…" },
    ]);
    expect(nextContent).toContain('data-key-term="osmosis"');
  });
});

describe("resolveSelectionForRemoveKeyTerm", () => {
  it("uses last remembered selection when live selection was cleared by toolbar blur", () => {
    const c =
      '<strong><span data-key-term="Sexual reproduction">Sexual reproduction</span></strong>';
    const open = c.indexOf("<span");
    const close = c.indexOf("</span>") + "</span>".length;
    // Live selection collapsed after button mousedown blur.
    const resolved = resolveSelectionForRemoveKeyTerm(c, 0, 0, open + 10, open + 12);
    expect(resolved.source).toBe("last");
    const { nextContent, removed } = removeDataKeyTermSpansInRange(
      c,
      resolved.start,
      resolved.end
    );
    expect(removed).toBe(1);
    expect(nextContent).toBe("<strong>Sexual reproduction</strong>");
  });

  it("prefers live selection when it still overlaps a key-term span", () => {
    const c =
      '<strong><span data-key-term="Meiosis">Meiosis</span></strong>';
    const open = c.indexOf("<span");
    const resolved = resolveSelectionForRemoveKeyTerm(c, open + 8, open + 12, 0, 0);
    expect(resolved.source).toBe("live");
  });

  it("reports none when neither live nor last selection hits a key term", () => {
    const c = "<p>plain text only</p>";
    const resolved = resolveSelectionForRemoveKeyTerm(c, 0, 0, 2, 4);
    expect(resolved.source).toBe("none");
  });
});
