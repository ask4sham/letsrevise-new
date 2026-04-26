import { isValidElement, type ReactNode } from "react";
import { highlightPlainTextToNodes, type ContentKeywordItem } from "./contentKeywordHighlight";

/** KeywordMark elements carry `kw` (metadata); plain strings do not. */
function countKeywordMarkElements(nodes: ReactNode[]): number {
  let c = 0;
  for (const n of nodes) {
    if (isValidElement(n) && (n.props as { kw?: ContentKeywordItem }).kw) c += 1;
  }
  return c;
}

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
