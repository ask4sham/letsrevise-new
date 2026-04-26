import React, { useMemo, createContext, useContext } from "react";
import type { Components } from "react-markdown";
import { useKeywordGlossaryOptional } from "./keywordGlossaryContext";
import { pickRelatedFlashcardsForKeyword } from "./keywordGlossaryFlashcards";

function keyTermDataAttrToString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** Plain text from markdown span children (author-marked key terms are usually one text node). */
function reactChildrenToPlainText(children: React.ReactNode): string {
  if (children == null || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map((c) => reactChildrenToPlainText(c)).join("");
  if (React.isValidElement(children)) {
    const ch = (children.props as { children?: React.ReactNode }).children;
    return reactChildrenToPlainText(ch);
  }
  return "";
}

/** First occurrence per page (or per mount): claim(termLower) returns true the first time, then false. */
type KeywordHighlightOnceContextValue = {
  claim: (termLower: string) => boolean;
};

const KeywordHighlightOnceContext = createContext<KeywordHighlightOnceContextValue | null>(null);

export function useKeywordHighlightOnceOptional(): KeywordHighlightOnceContextValue | null {
  return useContext(KeywordHighlightOnceContext);
}

export type KeywordHighlightOnceProviderProps = {
  children: React.ReactNode;
  /** When this changes, the “already highlighted” set is cleared (e.g. current page id). */
  resetKey: string | number;
};

/**
 * One highlight per term for this full render: a brand-new Set + new `claim` each render, so
 * we never read stale data from a ref/callback (React 18 StrictMode / React 19) and the same
 * `claim` always closes over the same Set for that render only.
 */
export function KeywordHighlightOnceProvider({
  children,
  resetKey,
}: KeywordHighlightOnceProviderProps): React.ReactElement {
  const usedThisRender = new Set<string>();
  const value: KeywordHighlightOnceContextValue = {
    claim: (termLower: string) => {
      if (usedThisRender.has(termLower)) return false;
      usedThisRender.add(termLower);
      return true;
    },
  };
  return (
    <KeywordHighlightOnceContext.Provider value={value}>
      <React.Fragment key={String(resetKey)}>{children}</React.Fragment>
    </KeywordHighlightOnceContext.Provider>
  );
}
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
  const p0 = node.props as { "dataKeyTerm"?: string; "data-key-term"?: string };
  const d0 = p0["dataKeyTerm"] ?? p0["data-key-term"];
  if (d0 != null && keyTermDataAttrToString(d0) !== "") {
    return true;
  }
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
  /** True when rendered from `<span data-key-term="…">` (author-marked); keeps auto-matched styling separate. */
  fromDataKeyTerm = false,
}: {
  kw: ContentKeywordItem;
  text: string;
  /** 1-based index of this term within the current text node — 3+ uses lighter repeat styling */
  occurrenceIndex: number;
  fromDataKeyTerm?: boolean;
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
  const baseMark = `lesson-keyword-highlight${repeat ? " lesson-keyword-highlight--repeat" : ""}${
    fromDataKeyTerm ? " lesson-keyword-highlight--data-key-term" : ""
  }`;
  const isExpanded = Boolean(ctx?.isOpen && ctx?.activeTerm === kw.term);
  if (!ctx || (!hasDef && !hasFlash)) {
    return (
      <mark className={baseMark} title={kw.definition?.trim() || undefined}>
        <span className="keyword-term">
          <span className="keyword-text">{text}</span>
          <span className="keyword-icon" aria-hidden="true">
            i
          </span>
        </span>
      </mark>
    );
  }
  return (
    <mark className={`${baseMark} lesson-keyword-highlight--interactive`}>
      <button
        type="button"
        className="lesson-keyword-highlight__btn"
        aria-label={`View definition for ${kw.term}`}
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
        <span className="keyword-term">
          <span className="keyword-text">{text}</span>
          <span className="keyword-icon" aria-hidden="true">
            i
          </span>
        </span>
      </button>
    </mark>
  );
}

type ClaimTermFn = (termLower: string) => boolean;

/**
 * @param claimTerm — When set (e.g. from KeywordHighlightOnceProvider), each term is wrapped at most
 *   once in global reading order; later matches are emitted as plain text. When omitted, every match
 *   is highlighted (repeat styling via occurrenceIndex).
 */
export function highlightPlainTextToNodes(
  text: string,
  sorted: ContentKeywordItem[],
  claimTerm?: ClaimTermFn
): React.ReactNode[] {
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
      const tk = matchedKw.term.toLowerCase();
      if (claimTerm) {
        if (!claimTerm(tk)) {
          buf += text.slice(i, i + matchedLen);
          i += matchedLen;
          continue;
        }
        flush();
        const pk = `lr-kw-${i}-${partKey++}`;
        nodes.push(
          <KeywordMark
            key={pk}
            kw={matchedKw}
            text={text.slice(i, i + matchedLen)}
            occurrenceIndex={1}
          />
        );
        i += matchedLen;
        continue;
      }
      flush();
      const pk = `lr-kw-${i}-${partKey++}`;
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

function walk(node: React.ReactNode, sorted: ContentKeywordItem[], claimTerm?: ClaimTermFn): React.ReactNode {
  if (node == null || typeof node === "boolean") return node;
  if (typeof node === "string") {
    const parts = highlightPlainTextToNodes(node, sorted, claimTerm);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    return <>{parts}</>;
  }
  if (typeof node === "number") return node;
  if (Array.isArray(node)) {
    return node.map((n, idx) => (
      <React.Fragment key={idx}>{walk(n, sorted, claimTerm)}</React.Fragment>
    ));
  }
  if (React.isValidElement(node)) {
    if (shouldSkipElement(node)) return node;
    const ch = (node.props as { children?: React.ReactNode }).children;
    if (ch === undefined || ch === null) return node;
    return React.cloneElement(node, { ...(node.props as object), children: walk(ch, sorted, claimTerm) } as never);
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
  const once = useKeywordHighlightOnceOptional();
  if (!sortedKeywords.length) return <>{children}</>;
  const claimTerm = once?.claim;
  return <>{walk(children, sortedKeywords, claimTerm)}</>;
}

const MARKDOWN_TAGS_TO_HIGHLIGHT: (keyof Components)[] = [
  "p",
  "div",
  "section",
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
  if (
    process.env.NODE_ENV === "development" &&
    typeof window !== "undefined" &&
    (window as { __LR_DEBUG_STUDENT_KEYWORDS__?: boolean }).__LR_DEBUG_STUDENT_KEYWORDS__ === true
  ) {
    // eslint-disable-next-line no-console
    console.log("[contentKeyword] mergeLessonMarkdownComponentsWithKeywordHighlight", {
      keywordCount: keywords?.length ?? 0,
      terms: keywords?.map((k) => k.term) ?? [],
    });
  }
  const sorted = keywords?.length
    ? [...keywords].sort((a, b) => b.term.length - a.term.length)
    : [];
  const out: Record<string, unknown> = { ...components };
  const OriginalSpan = out.span;
  out.span = (props: { children?: React.ReactNode; "dataKeyTerm"?: string; "data-key-term"?: string; [k: string]: unknown }) => {
    const raw = props["dataKeyTerm"] ?? props["data-key-term"];
    const dk = keyTermDataAttrToString(raw);
    if (dk) {
      const text = reactChildrenToPlainText(props.children);
      const hit = sorted.find((k) => k.term.toLowerCase() === dk.toLowerCase());
      const kw: ContentKeywordItem = hit ?? { term: dk };
      return (
        <KeywordMark kw={kw} text={text || dk} occurrenceIndex={1} fromDataKeyTerm />
      );
    }
    if (OriginalSpan != null) {
      return React.createElement(OriginalSpan as React.ElementType, props);
    }
    // eslint-disable-next-line react/no-unknown-property
    return <span {...props} />;
  };
  if (!sorted.length) {
    return out as Partial<Components>;
  }
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
