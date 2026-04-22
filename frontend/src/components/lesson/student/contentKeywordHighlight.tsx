import React, { useMemo } from "react";
import type { Components } from "react-markdown";
import { useKeywordGlossaryOptional } from "./keywordGlossaryContext";
import { pickRelatedFlashcardsForKeyword } from "./keywordGlossaryFlashcards";
/** Optional glossary-style metadata; render-time only — never persisted into block HTML. */
export type ContentKeywordItem = {
  term: string;
  type?: string;
  definition?: string;
  specKey?: string;
  topicKey?: string;
  flashcardIds?: string[];
};

export function normalizeContentKeywords(raw: unknown): ContentKeywordItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ContentKeywordItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const term = typeof o.term === "string" ? o.term.trim() : "";
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const flashcardIds = Array.isArray(o.flashcardIds)
      ? o.flashcardIds
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim())
          .filter(Boolean)
      : undefined;
    out.push({
      term,
      type: typeof o.type === "string" ? o.type : undefined,
      definition: typeof o.definition === "string" ? o.definition : undefined,
      specKey: typeof o.specKey === "string" && o.specKey.trim() ? o.specKey.trim() : undefined,
      topicKey: typeof o.topicKey === "string" && o.topicKey.trim() ? o.topicKey.trim() : undefined,
      flashcardIds: flashcardIds?.length ? flashcardIds : undefined,
    });
  }
  out.sort((a, b) => b.term.length - a.term.length);
  return out;
}

/** Lesson-level + page-level: page wins on duplicate terms (case-insensitive). */
export function mergeContentKeywordLists(
  lessonKeywords: ContentKeywordItem[],
  pageKeywords: ContentKeywordItem[]
): ContentKeywordItem[] {
  const map = new Map<string, ContentKeywordItem>();
  for (const k of lessonKeywords) map.set(k.term.toLowerCase(), k);
  for (const k of pageKeywords) map.set(k.term.toLowerCase(), k);
  return Array.from(map.values()).sort((a, b) => b.term.length - a.term.length);
}

function shouldSkipElement(node: React.ReactElement): boolean {
  const t = node.type;
  if (t === "a" || t === "code" || t === "pre" || t === "button" || t === "img" || t === "video" || t === "svg") {
    return true;
  }
  if (t === "mark") {
    const cn = (node.props as { className?: string }).className;
    if (typeof cn === "string" && cn.includes("lesson-keyword-highlight")) return true;
  }
  return false;
}

function KeywordMark({
  kw,
  text,
  occurrenceIndex,
}: {
  kw: ContentKeywordItem;
  text: string;
  /** 1-based index of this term within the current text node — 3+ uses lighter repeat styling */
  occurrenceIndex: number;
}): React.ReactElement {
  const ctx = useKeywordGlossaryOptional();
  const related = useMemo(() => {
    if (!ctx) return [];
    return pickRelatedFlashcardsForKeyword(kw, ctx.flashcards, {
      topicKey: ctx.topicKey,
      specKey: ctx.specKey,
    });
  }, [ctx, kw]);
  const hasDef = Boolean(kw.definition?.trim());
  const hasFlash = related.length > 0;
  const repeat = occurrenceIndex > 2;
  const baseMark = `lesson-keyword-highlight${repeat ? " lesson-keyword-highlight--repeat" : ""}`;
  const isExpanded = Boolean(ctx?.isOpen && ctx?.activeTerm === kw.term);
  if (!ctx || (!hasDef && !hasFlash)) {
    return (
      <mark className={baseMark} title={kw.definition?.trim() || undefined}>
        {text}
      </mark>
    );
  }
  return (
    <mark className={`${baseMark} lesson-keyword-highlight--interactive`}>
      <button
        type="button"
        className="lesson-keyword-highlight__btn"
        aria-label={`Open glossary for ${kw.term}`}
        aria-haspopup="dialog"
        aria-expanded={isExpanded}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          ctx.open({
            kw: {
              term: kw.term,
              definition: kw.definition,
              type: kw.type,
              topicKey: kw.topicKey,
              specKey: kw.specKey,
              flashcardIds: kw.flashcardIds,
            },
            related,
            anchor: e.currentTarget,
          });
        }}
      >
        {text}
      </button>
    </mark>
  );
}

function highlightPlainTextToNodes(text: string, sorted: ContentKeywordItem[]): React.ReactNode[] {
  if (!text) return [];
  if (!sorted.length) return [text];
  const nodes: React.ReactNode[] = [];
  const occurrenceByTerm = new Map<string, number>();
  let buf = "";
  let i = 0;
  let partKey = 0;
  const flush = () => {
    if (buf) {
      nodes.push(buf);
      buf = "";
    }
  };
  while (i < text.length) {
    let matchedLen = 0;
    let matchedKw: ContentKeywordItem | null = null;
    for (const k of sorted) {
      const t = k.term;
      if (text.length - i < t.length) continue;
      if (text.slice(i, i + t.length).toLowerCase() === t.toLowerCase()) {
        matchedLen = t.length;
        matchedKw = k;
        break;
      }
    }
    if (matchedLen && matchedKw) {
      flush();
      const pk = `lr-kw-${i}-${partKey++}`;
      const tk = matchedKw.term.toLowerCase();
      const occurrenceIndex = (occurrenceByTerm.get(tk) ?? 0) + 1;
      occurrenceByTerm.set(tk, occurrenceIndex);
      nodes.push(
        <KeywordMark
          key={pk}
          kw={matchedKw}
          text={text.slice(i, i + matchedLen)}
          occurrenceIndex={occurrenceIndex}
        />
      );
      i += matchedLen;
    } else {
      buf += text[i];
      i++;
    }
  }
  flush();
  return nodes;
}

function walk(node: React.ReactNode, sorted: ContentKeywordItem[]): React.ReactNode {
  if (node == null || typeof node === "boolean") return node;
  if (typeof node === "string") {
    const parts = highlightPlainTextToNodes(node, sorted);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    return <>{parts}</>;
  }
  if (typeof node === "number") return node;
  if (Array.isArray(node)) {
    return node.map((n, idx) => <React.Fragment key={idx}>{walk(n, sorted)}</React.Fragment>);
  }
  if (React.isValidElement(node)) {
    if (shouldSkipElement(node)) return node;
    const ch = (node.props as { children?: React.ReactNode }).children;
    if (ch === undefined || ch === null) return node;
    return React.cloneElement(node, { ...(node.props as object), children: walk(ch, sorted) } as never);
  }
  return node;
}

export function KeywordHighlightBoundary({
  sortedKeywords,
  children,
}: {
  sortedKeywords: ContentKeywordItem[];
  children: React.ReactNode;
}): React.ReactElement {
  if (!sortedKeywords.length) return <>{children}</>;
  return <>{walk(children, sortedKeywords)}</>;
}

const MARKDOWN_TAGS_TO_HIGHLIGHT: (keyof Components)[] = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "li",
  "blockquote",
  "td",
  "th",
];

/**
 * Wraps react-markdown typography components so keyword spans apply to visible text only;
 * links / code / pre / media subtrees are left unchanged.
 */
export function mergeLessonMarkdownComponentsWithKeywordHighlight(
  components: Partial<Components>,
  keywords: ContentKeywordItem[] | undefined
): Partial<Components> {
  if (!keywords?.length) return components;
  const sorted = [...keywords].sort((a, b) => b.term.length - a.term.length);
  const out: Record<string, unknown> = { ...components };
  for (const tag of MARKDOWN_TAGS_TO_HIGHLIGHT) {
    const Original = out[tag as string];
    if (typeof Original !== "function") continue;
    const Orig = Original as React.ComponentType<any>;
    out[tag as string] = (props: { children?: React.ReactNode }) => (
      <Orig {...props}>
        <KeywordHighlightBoundary sortedKeywords={sorted}>{props.children}</KeywordHighlightBoundary>
      </Orig>
    );
  }
  return out as Partial<Components>;
}
