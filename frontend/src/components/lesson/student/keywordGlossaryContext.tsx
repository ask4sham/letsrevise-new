import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { GlossaryFlashcardLite } from "./keywordGlossaryFlashcards";
import { keywordTermLookupKey } from "./keywordTermLookupKey";

/** Popup payload — mirrors optional keyword metadata fields without importing highlight module (avoid cycles). */
export type GlossaryKeywordPayload = {
  term: string;
  definition?: string;
  type?: string;
  topicKey?: string;
  specKey?: string;
  flashcardIds?: string[];
};

type PopupState = {
  kw: GlossaryKeywordPayload;
  related: GlossaryFlashcardLite[];
  /** Viewport position for placement */
  left: number;
  top: number;
};

type KeywordGlossaryContextValue = {
  flashcards: GlossaryFlashcardLite[];
  topicKey: string | null;
  specKey: string | null;
  /** Term string for the open glossary, for aria-expanded parity */
  activeTerm: string | null;
  open: (payload: { kw: GlossaryKeywordPayload; related: GlossaryFlashcardLite[]; anchor: HTMLElement }) => void;
  close: () => void;
  isOpen: boolean;
};

const KeywordGlossaryContext = createContext<KeywordGlossaryContextValue | null>(null);

export function useKeywordGlossaryOptional(): KeywordGlossaryContextValue | null {
  return useContext(KeywordGlossaryContext);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function placePopup(rect: DOMRect, popW: number, popH: number) {
  const pad = 12;
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  const effectiveW = Math.min(popW, vw - pad * 2);
  let left = rect.left;
  let top = rect.bottom + 6;
  if (left + effectiveW > vw - pad) left = vw - pad - effectiveW;
  if (left < pad) left = pad;
  if (top + popH > vh - pad) {
    top = rect.top - 6 - popH;
  }
  if (top < pad) top = pad;
  if (vw <= 520) {
    left = Math.max(pad, (vw - effectiveW) / 2);
  }
  left = clamp(left, pad, vw - pad - Math.min(effectiveW, vw - pad * 2));
  top = clamp(top, pad, vh - pad - Math.min(popH, vh - pad * 2));
  return { left, top };
}

/**
 * Merged `lesson + page` `contentKeywords` (or equivalent). Used to fill missing
 * `definition` when a mark only passed `{ term }` to `open` — same source as student highlights.
 */
export type GlossaryIndexItem = {
  term: string;
  definition?: string;
  type?: string;
  topicKey?: string;
  specKey?: string;
  flashcardIds?: string[];
};

export type KeywordGlossaryProviderProps = {
  children: React.ReactNode;
  flashcards: GlossaryFlashcardLite[];
  topicKey?: string | null;
  specKey?: string | null;
  /** Full merged glossary list from lesson view — not shown to user; powers definition lookup. */
  glossaryIndexItems?: GlossaryIndexItem[];
};

/**
 * Wraps lesson markdown that uses keyword highlights — enables click-to-glossary popover for students.
 */
function buildGlossaryIndexByTerm(
  items: GlossaryIndexItem[] | undefined
): Map<string, GlossaryIndexItem> {
  const m = new Map<string, GlossaryIndexItem>();
  for (const it of items ?? []) {
    if (!it?.term) continue;
    const k = keywordTermLookupKey(it.term);
    if (!k) continue;
    const prev = m.get(k);
    if (!prev) {
      m.set(k, it);
      continue;
    }
    m.set(k, {
      term: it.term || prev.term,
      type: it.type ?? prev.type,
      definition:
        (it.definition && it.definition.trim() ? it.definition : undefined) ||
        (prev.definition && prev.definition.trim() ? prev.definition : undefined),
      topicKey: it.topicKey ?? prev.topicKey,
      specKey: it.specKey ?? prev.specKey,
      flashcardIds: it.flashcardIds?.length ? it.flashcardIds : prev.flashcardIds,
    });
  }
  return m;
}

export function KeywordGlossaryProvider({
  children,
  flashcards,
  topicKey = null,
  specKey = null,
  glossaryIndexItems,
}: KeywordGlossaryProviderProps): React.ReactElement {
  const [popup, setPopup] = useState<PopupState | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const glossaryByTerm = useMemo(
    () => buildGlossaryIndexByTerm(glossaryIndexItems),
    [glossaryIndexItems]
  );

  const close = useCallback(() => {
    const el = lastTriggerRef.current;
    setPopup(null);
    requestAnimationFrame(() => {
      if (el && typeof el.focus === "function") {
        try {
          el.focus();
        } catch {
          /* ignore */
        }
      }
      lastTriggerRef.current = null;
    });
  }, []);

  const open = useCallback(
    (payload: { kw: GlossaryKeywordPayload; related: GlossaryFlashcardLite[]; anchor: HTMLElement }) => {
      lastTriggerRef.current = payload.anchor;
      const k = keywordTermLookupKey(payload.kw.term);
      const from = k ? glossaryByTerm.get(k) : undefined;
      const payloadDef = payload.kw.definition && payload.kw.definition.trim() ? payload.kw.definition : undefined;
      const indexDef = from?.definition && from.definition.trim() ? from.definition : undefined;
      const merged: GlossaryKeywordPayload = {
        term: (from?.term && from.term.trim() ? from.term : payload.kw.term) || payload.kw.term,
        definition: payloadDef || indexDef,
        type: payload.kw.type ?? from?.type,
        topicKey: payload.kw.topicKey ?? from?.topicKey,
        specKey: payload.kw.specKey ?? from?.specKey,
        flashcardIds: payload.kw.flashcardIds?.length ? payload.kw.flashcardIds : from?.flashcardIds,
      };
      const rect = payload.anchor.getBoundingClientRect();
      const estW = Math.min(320, typeof window !== "undefined" ? window.innerWidth - 24 : 320);
      const estH = 280;
      const { left, top } = placePopup(rect, estW, estH);
      setPopup({
        kw: merged,
        related: payload.related,
        left,
        top,
      });
    },
    [glossaryByTerm]
  );

  useEffect(() => {
    if (!popup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onScroll = () => close();
    const onResize = () => close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [popup, close]);

  const value = useMemo((): KeywordGlossaryContextValue => {
    return {
      flashcards,
      topicKey: topicKey ?? null,
      specKey: specKey ?? null,
      activeTerm: popup?.kw.term ?? null,
      open,
      close,
      isOpen: Boolean(popup),
    };
  }, [flashcards, topicKey, specKey, open, close, popup]);

  const portal =
    popup &&
    typeof document !== "undefined" &&
    createPortal(
      <>
        <div className="lesson-keyword-glossary-backdrop" aria-hidden onClick={close} />
        <div
          className="lesson-keyword-glossary-popover"
          role="dialog"
          aria-modal="false"
          aria-labelledby="lesson-keyword-glossary-title"
          style={{ left: popup.left, top: popup.top }}
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
          <div className="lesson-keyword-glossary-popover__head">
            <div id="lesson-keyword-glossary-title" className="lesson-keyword-glossary-popover__term">
              {popup.kw.term}
            </div>
            <button
              type="button"
              className="lesson-keyword-glossary-popover__close"
              onClick={close}
              aria-label="Close glossary"
            >
              ×
            </button>
          </div>
          {popup.kw.definition?.trim() ? (
            <p className="lesson-keyword-glossary-popover__def">{popup.kw.definition.trim()}</p>
          ) : null}
          {popup.related.length > 0 ? (
            <div className="lesson-keyword-glossary-popover__fc-block">
              <div className="lesson-keyword-glossary-popover__fc-label">Related flashcards</div>
              <ul className="lesson-keyword-glossary-popover__fc-list">
                {popup.related.map((c) => (
                  <li key={c.id} className="lesson-keyword-glossary-popover__fc-item">
                    <div className="lesson-keyword-glossary-popover__fc-front">{c.front}</div>
                    {c.back?.trim() ? (
                      <div className="lesson-keyword-glossary-popover__fc-back">{c.back}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </>,
      document.body
    );

  return (
    <KeywordGlossaryContext.Provider value={value}>
      {children}
      {portal}
    </KeywordGlossaryContext.Provider>
  );
}
