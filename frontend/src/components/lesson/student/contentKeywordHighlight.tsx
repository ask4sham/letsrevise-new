import React, { useMemo, createContext, useContext } from "react";
import type { Components } from "react-markdown";
import { useKeywordGlossaryOptional } from "./keywordGlossaryContext";
import { pickRelatedFlashcardsForKeyword } from "./keywordGlossaryFlashcards";
import { keywordTermLookupKey } from "./keywordTermLookupKey";

function keyTermDataAttrToString(v: unknown): string {
  if (v == null) return "";
  let s = String(v).trim();
  s = s.replace(/\s+$/g, "");
  s = s.replace(/\s+i$/i, "");
  s = s.normalize("NFC").trim();
  return s;
}

const normalizeKeyTermMatchKey = keywordTermLookupKey;

/**
 * Resolves a full `ContentKeywordItem` for an author `<span data-key-term="…">` using the same
 * sorted list as auto-highlight. Falls back to visible span text if the attr alone does not match
 * (e.g. ZWSP, nbsp, or attr/body drift).
 */
function findKeywordForDataKeyAttr(
  dataKey: string,
  visibleText: string,
  sorted: ContentKeywordItem[]
): ContentKeywordItem | undefined {
  if (!sorted.length) return undefined;
  const d = normalizeKeyTermMatchKey(dataKey);
  if (d) {
    const byAttr = sorted.find((k) => normalizeKeyTermMatchKey(k.term) === d);
    if (byAttr) return byAttr;
  }
  const t = normalizeKeyTermMatchKey(visibleText);
  if (t && t !== d) {
    return sorted.find((k) => normalizeKeyTermMatchKey(k.term) === t);
  }
  return undefined;
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

function contentKeywordItemFromRecord(o: Record<string, unknown>): ContentKeywordItem | null {
  const term = typeof o.term === "string" ? o.term.trim() : "";
  if (!term) return null;
  const flashcardIds = Array.isArray(o.flashcardIds)
    ? o.flashcardIds
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
    : undefined;
  const defRaw =
    typeof o.definition === "string"
      ? o.definition
      : typeof o.glossary === "string"
        ? o.glossary
        : typeof o.glossaryDefinition === "string"
          ? o.glossaryDefinition
          : undefined;
  const definitionTrim = typeof defRaw === "string" ? defRaw.trim() : "";
  return {
    term,
    type: typeof o.type === "string" ? o.type : undefined,
    definition: definitionTrim || undefined,
    specKey: typeof o.specKey === "string" && o.specKey.trim() ? o.specKey.trim() : undefined,
    topicKey: typeof o.topicKey === "string" && o.topicKey.trim() ? o.topicKey.trim() : undefined,
    flashcardIds: flashcardIds?.length ? flashcardIds : undefined,
  };
}

/**
 * Merges two rows for the same term (e.g. duplicate objects in the same `contentKeywords` array).
 * Prefers a non-empty `definition` on `incoming` (later in the array) when set; otherwise keeps `base`.
 */
function mergeContentKeywordRow(base: ContentKeywordItem, incoming: ContentKeywordItem): ContentKeywordItem {
  const bDef = base.definition?.trim();
  const iDef = incoming.definition?.trim();
  return {
    term: incoming.term || base.term,
    type: incoming.type ?? base.type,
    definition: iDef ? incoming.definition : bDef ? base.definition : undefined,
    specKey: incoming.specKey ?? base.specKey,
    topicKey: incoming.topicKey ?? base.topicKey,
    flashcardIds: incoming.flashcardIds?.length ? incoming.flashcardIds : base.flashcardIds,
  };
}

export function normalizeContentKeywords(raw: unknown): ContentKeywordItem[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, ContentKeywordItem>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const next = contentKeywordItemFromRecord(o);
    if (!next) continue;
    const key = next.term.toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, next);
      continue;
    }
    map.set(key, mergeContentKeywordRow(prev, next));
  }
  const out = Array.from(map.values());
  out.sort((a, b) => b.term.length - a.term.length);
  return out;
}

/**
 * Merge lesson-level + page-level `contentKeywords` (case-insensitive key).
 * When the same term exists in both, **field-merge** so a page entry without `definition` does
 * not wipe a lesson-level AI/manual definition (previously the page object replaced the map entry
 * entirely, which made student glossary popups show the term with no text).
 */
export function mergeContentKeywordLists(
  lessonKeywords: ContentKeywordItem[],
  pageKeywords: ContentKeywordItem[]
): ContentKeywordItem[] {
  const map = new Map<string, ContentKeywordItem>();
  for (const k of lessonKeywords) {
    const key = k.term.toLowerCase();
    if (key) map.set(key, k);
  }
  for (const k of pageKeywords) {
    const key = k.term.toLowerCase();
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, k);
      continue;
    }
    map.set(key, mergeContentKeywordRow(prev, k));
  }
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
  const repeat = occurrenceIndex > 2;
  const baseMark = `lesson-keyword-highlight${repeat ? " lesson-keyword-highlight--repeat" : ""}${
    fromDataKeyTerm ? " lesson-keyword-highlight--data-key-term" : ""
  }`;
  const isExpanded = Boolean(ctx?.isOpen && ctx?.activeTerm === kw.term);
  const noDefDataKey = fromDataKeyTerm && !hasDef ? " lesson-keyword-highlight--data-key-term--no-def" : "";
  const useInteractiveGlossary = Boolean(ctx && hasDef);
  if (
    fromDataKeyTerm &&
    process.env.NODE_ENV === "development" &&
    typeof window !== "undefined" &&
    (window as { __LR_DEBUG_STUDENT_KEYWORDS__?: boolean }).__LR_DEBUG_STUDENT_KEYWORDS__ === true
  ) {
    // eslint-disable-next-line no-console
    console.log("[KeywordMark data-key-term]", {
      term: kw.term,
      useInteractiveGlossary,
      hasCtx: Boolean(ctx),
      hasDef,
      openExists: Boolean(ctx?.open),
    });
  }
  if (!useInteractiveGlossary) {
    const markAuxClass = hasDef ? " keyword-highlight" : " keyword-highlight no-definition";
    return (
      <mark
        className={`${baseMark}${noDefDataKey}${markAuxClass}`}
        title={hasDef ? kw.definition?.trim() : "Definition not added yet"}
      >
        <span className="keyword-term">
          <span className="keyword-text">{text}</span>
        </span>
      </mark>
    );
  }
  return (
    <mark className={`${baseMark} lesson-keyword-highlight--interactive keyword-highlight interactive`}>
      <button
        type="button"
        className="lesson-keyword-highlight__btn"
        aria-label={`View definition for ${kw.term}`}
        aria-haspopup="dialog"
        aria-expanded={isExpanded}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (
            fromDataKeyTerm &&
            process.env.NODE_ENV === "development" &&
            typeof window !== "undefined" &&
            (window as { __LR_DEBUG_STUDENT_KEYWORDS__?: boolean }).__LR_DEBUG_STUDENT_KEYWORDS__ ===
              true
          ) {
            // eslint-disable-next-line no-console
            console.log("[inline data-key-term click]", {
              term: kw.term,
              hasDefinition: Boolean(kw.definition?.trim()),
              hasGlossaryContext: Boolean(ctx),
              openExists: Boolean(ctx.open),
            });
          }
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

export type MergeLessonKeywordHighlightOptions = {
  /**
   * When true, scan plain text in p/li/… and wrap `contentKeywords` matches (auto-highlight).
   * Student lesson body should set **false** so only explicit `<span data-key-term="…">` is highlighted.
   * @default true
   */
  autoTextKeywordHighlights?: boolean;
};

/**
 * Wraps react-markdown typography components so keyword spans apply to visible text only;
 * links / code / pre / media subtrees are left unchanged.
 */
export function mergeLessonMarkdownComponentsWithKeywordHighlight(
  components: Partial<Components>,
  keywords: ContentKeywordItem[] | undefined,
  options?: MergeLessonKeywordHighlightOptions
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
  const autoTextKeywordHighlights = options?.autoTextKeywordHighlights !== false;
  const out: Record<string, unknown> = { ...components };
  const OriginalSpan = out.span;
  out.span = (props: { children?: React.ReactNode; "dataKeyTerm"?: string; "data-key-term"?: string; [k: string]: unknown }) => {
    const raw = props["dataKeyTerm"] ?? props["data-key-term"];
    const dk = keyTermDataAttrToString(raw);
    if (dk) {
      const text = reactChildrenToPlainText(props.children);
      const displayText = text || dk;
      const hit = findKeywordForDataKeyAttr(dk, displayText, sorted);
      const kw: ContentKeywordItem = hit ?? { term: dk };
      if (
        process.env.NODE_ENV === "development" &&
        typeof window !== "undefined" &&
        (window as { __LR_DEBUG_STUDENT_KEYWORDS__?: boolean }).__LR_DEBUG_STUDENT_KEYWORDS__ === true
      ) {
        // eslint-disable-next-line no-console
        console.log("[data-key-term span → KeywordMark]", {
          dataKey: dk,
          displayText,
          hitTerm: hit?.term,
          hasDefinition: Boolean(kw.definition?.trim()),
        });
      }
      return <KeywordMark kw={kw} text={displayText} occurrenceIndex={1} fromDataKeyTerm />;
    }
    if (OriginalSpan != null) {
      return React.createElement(OriginalSpan as React.ElementType, props);
    }
    // eslint-disable-next-line react/no-unknown-property
    return <span {...props} />;
  };
  if (!autoTextKeywordHighlights || !sorted.length) {
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
