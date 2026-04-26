import { isValidElement, type ReactNode } from "react";
import {
  highlightPlainTextToNodes,
  mergeContentKeywordLists,
  normalizeContentKeywords,
  type ContentKeywordItem,
} from "./contentKeywordHighlight";

/** KeywordMark elements carry `kw` (metadata); plain strings do not. */
function countKeywordMarkElements(nodes: ReactNode[]): number {
  let c = 0;
  for (const n of nodes) {
    if (isValidElement(n) && (n.props as { kw?: ContentKeywordItem }).kw) c += 1;
  }
  return c;
}

describe("mergeContentKeywordLists", () => {
  it("keeps lesson definition when the page has the same term but no definition", () => {
    const lesson: ContentKeywordItem[] = [
      { term: "photosynthesise", definition: "The process by which plants make glucose." },
    ];
    const page: ContentKeywordItem[] = [{ term: "photosynthesise" }];
    const merged = mergeContentKeywordLists(lesson, page);
    expect(merged).toHaveLength(1);
    expect(merged[0].term).toBe("photosynthesise");
    expect(merged[0].definition).toBe("The process by which plants make glucose.");
  });

  it("prefers page definition when the page has one", () => {
    const lesson: ContentKeywordItem[] = [
      { term: "diffusion", definition: "From lesson" },
    ];
    const page: ContentKeywordItem[] = [{ term: "diffusion", definition: "From page — newer" }];
    const merged = mergeContentKeywordLists(lesson, page);
    expect(merged[0].definition).toBe("From page — newer");
  });
});

describe("normalizeContentKeywords (duplicate terms in one list)", () => {
  it("keeps a definition from a later duplicate row (first row term-only is common)", () => {
    const raw = [
      { term: "osmosis" },
      { term: "osmosis", definition: "Net movement of water through a semi-permeable membrane." },
    ];
    const n = normalizeContentKeywords(raw);
    expect(n).toHaveLength(1);
    expect(n[0].definition).toBe("Net movement of water through a semi-permeable membrane.");
  });
});

describe("highlightPlainTextToNodes (once per term via claim)", () => {
  const sorted: ContentKeywordItem[] = [
    { term: "photosynthesise" },
    { term: "diffusion" },
    { term: "osmosis" },
  ].sort((a, b) => b.term.length - a.term.length);

  it("emits three KeywordMark elements for first of each term only when claim allows one per term", () => {
    const used = new Set<string>();
    const claim = (t: string) => {
      if (used.has(t)) return false;
      used.add(t);
      return true;
    };
    const text = "photosynthesise diffusion osmosis diffusion osmosis";
    const out = highlightPlainTextToNodes(text, sorted, claim);
    expect(countKeywordMarkElements(out)).toBe(3);
  });

  it("emits a mark for every match when claim is undefined (legacy per-node behaviour)", () => {
    const text = "photosynthesise diffusion osmosis diffusion osmosis";
    const out = highlightPlainTextToNodes(text, sorted, undefined);
    expect(countKeywordMarkElements(out)).toBe(5);
  });
});
