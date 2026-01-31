// FlashcardsView.tsx
import React, { useEffect, useMemo, useState } from "react";

type Difficulty = 1 | 2 | 3;

interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty?: Difficulty;
  lastReviewed?: Date;
  tags?: string[];
}

interface FlashcardsViewProps {
  title?: string;

  // Supports BOTH prop names
  cards?: Flashcard[];
  flashcards?: Flashcard[];

  examCode?: string;
  breadcrumbLeft?: string;
  breadcrumbRight?: string;
  
  // ✅ Added: lessonId for persistence
  lessonId?: string;

  onCardFlip?: (cardId: string) => void;
  onDifficultyChange?: (cardId: string, difficulty: number) => void;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 250);
}

export default function FlashcardsView({
  title = "Flashcards",
  cards,
  flashcards,
  examCode,
  breadcrumbLeft,
  breadcrumbRight = "Flashcards",
  lessonId = "default_lesson", // ✅ Default value for persistence
  onCardFlip,
  onDifficultyChange,
}: FlashcardsViewProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  
  // ✅ SS3: Add state for tracking user interactions
  const [knownIds, setKnownIds] = useState<Set<string>>(() => {
    // ✅ Load from localStorage on initial render
    try {
      const key = `flashcard_progress_${lessonId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Set(parsed.known || []);
      }
    } catch {}
    return new Set();
  });
  
  const [learningIds, setLearningIds] = useState<Set<string>>(() => {
    // ✅ Load from localStorage on initial render
    try {
      const key = `flashcard_progress_${lessonId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Set(parsed.learning || []);
      }
    } catch {}
    return new Set();
  });

  // ✅ Persist to localStorage when knownIds or learningIds change
  useEffect(() => {
    try {
      const key = `flashcard_progress_${lessonId}`;
      localStorage.setItem(
        key,
        JSON.stringify({
          known: Array.from(knownIds),
          learning: Array.from(learningIds),
        })
      );
    } catch {}
  }, [knownIds, learningIds, lessonId]);

  const deck: Flashcard[] = useMemo(() => {
    const chosen =
      (cards && cards.length ? cards : flashcards && flashcards.length ? flashcards : []) || [];
    return chosen.map((c, i) => ({
      id: c.id ?? String(i),
      front: c.front ?? "",
      back: c.back ?? "",
      difficulty: c.difficulty ?? 1,
      tags: Array.isArray(c.tags) ? c.tags : [],
      lastReviewed: c.lastReviewed,
    }));
  }, [cards, flashcards]);

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [deck.length]);

  const total = deck.length;
  const currentCard = deck[index] || null;
  const progressText = total > 0 ? `${index + 1}/${total}` : "0/0";

  const topicLabel = useMemo(() => {
    const tags = currentCard?.tags ?? [];
    const t = tags.find(Boolean);
    return t ? String(t) : " ";
  }, [currentCard]);

  // ✅ SS3: Update counts to reflect actual user interactions
  const knownCount = knownIds.size;
  const learningCount = learningIds.size;

  const goPrev = () => {
    setFlipped(false);
    setIndex((i) => clamp(i - 1, 0, Math.max(0, total - 1)));
  };

  const goNext = () => {
    setFlipped(false);
    setIndex((i) => clamp(i + 1, 0, Math.max(0, total - 1)));
  };

  const flip = () => {
    setFlipped((f) => !f);
    if (!flipped && currentCard && onCardFlip) onCardFlip(currentCard.id);
  };

  // ✅ SS3: Mark as "Mastered"
  const markKnow = (id: string) => {
    if (!currentCard) return;
    
    // Update interaction tracking
    setKnownIds((prev) => new Set([...Array.from(prev), id]));
    setLearningIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    
    // Call existing difficulty change handler if provided
    if (onDifficultyChange) onDifficultyChange(id, 3);
    
    // Flip and go to next card
    setFlipped(false);
    setTimeout(() => goNext(), 120);
  };

  // ✅ SS3: Mark as "Practising"
  const markStillLearning = (id: string) => {
    if (!currentCard) return;
    
    // Update interaction tracking
    setLearningIds((prev) => new Set([...Array.from(prev), id]));
    setKnownIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    
    // Call existing difficulty change handler if provided
    if (onDifficultyChange) onDifficultyChange(id, 1);
    
    // Flip and go to next card
    setFlipped(false);
    setTimeout(() => goNext(), 120);
  };

  const markDifficulty = (d: Difficulty) => {
    if (!currentCard) return;
    
    // Update interaction tracking based on difficulty
    if (d === 3) {
      markKnow(currentCard.id);
    } else if (d === 1) {
      markStillLearning(currentCard.id);
    } else {
      // Medium difficulty (2) - don't track in known/learning sets
      if (onDifficultyChange) onDifficultyChange(currentCard.id, d);
      setFlipped(false);
      setTimeout(() => goNext(), 120);
    }
  };

  const handleDownload = () => {
    const lines: string[] = [];
    lines.push(`# ${title}`);
    lines.push("");
    deck.forEach((c, i) => {
      lines.push(`## Card ${i + 1}`);
      lines.push(`Q: ${c.front}`);
      lines.push(`A: ${c.back}`);
      if (c.tags && c.tags.length) lines.push(`Tags: ${c.tags.join(", ")}`);
      lines.push(`Difficulty: ${c.difficulty ?? 1}`);
      lines.push("");
    });
    const safeTitle = (title || "flashcards").replace(/[^\w\-]+/g, "_");
    downloadTextFile(`${safeTitle}.txt`, lines.join("\n"));
  };

  const styles: Record<string, React.CSSProperties> = {
    wrap: {
      width: "100%",
    },
    breadcrumb: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      color: "#6b7280",
      fontSize: 14,
      marginBottom: 14,
    },
    crumbIcon: {
      width: 18,
      height: 18,
      borderRadius: 6,
      background: "#f3f4f6",
      display: "inline-block",
    },
    headerRow: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 16,
      flexWrap: "wrap",
      marginBottom: 18,
    },
    title: {
      fontSize: 34,
      fontWeight: 800,
      letterSpacing: "-0.02em",
      margin: 0,
      color: "#111827",
    },
    examCode: {
      marginTop: 10,
      display: "inline-flex",
      alignItems: "center",
      border: "1px solid #e5e7eb",
      background: "#fff",
      padding: "6px 10px",
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 600,
      color: "#374151",
      boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
    },
    rightHeader: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      color: "#6b7280",
      fontSize: 14,
      marginTop: 6,
    },
    download: {
      border: "none",
      background: "#2563eb",
      color: "#fff",
      padding: "10px 18px",
      borderRadius: 999,
      fontWeight: 800,
      cursor: "pointer",
      boxShadow: "0 6px 18px rgba(37,99,235,0.25)",
    },
    pillsRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      borderRadius: 999,
      padding: "8px 12px",
      fontSize: 14,
      fontWeight: 800,
      cursor: "pointer",
    },
    pillCount: {
      height: 22,
      minWidth: 22,
      padding: "0 8px",
      borderRadius: 999,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 12,
      fontWeight: 900,
    },
    cardArea: {
      position: "relative",
      width: "100%",
      marginTop: 8,
    },
    deckLayer1: {
      position: "absolute",
      left: "50%",
      top: 18,
      transform: "translateX(-50%)",
      width: "min(980px, 100%)",
      height: 440,
      borderRadius: 28,
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
    },
    deckLayer2: {
      position: "absolute",
      left: "50%",
      top: 10,
      transform: "translateX(-50%)",
      width: "min(980px, 100%)",
      height: 440,
      borderRadius: 28,
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
    },
    cardShell: {
      position: "relative",
      width: "min(980px, 100%)",
      height: 440,
      margin: "0 auto",
      borderRadius: 28,
      background: "rgba(219,234,254,0.55)", // light blue wash
      border: "1px solid rgba(17,24,39,0.06)",
      boxShadow: "0 18px 50px rgba(0,0,0,0.14)",
      overflow: "hidden",
    },
    topBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "18px 22px 0 22px",
      fontSize: 14,
      color: "#4b5563",
    },
    topBarLabel: {
      fontWeight: 700,
    },
    topRight: {
      display: "flex",
      alignItems: "center",
      gap: 10,
    },
    topic: {
      maxWidth: 300,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      color: "#374151",
      borderBottom: "1px solid #d1d5db",
      paddingBottom: 2,
    },
    plus: {
      width: 20,
      height: 20,
      borderRadius: 6,
      background: "#2563eb",
      color: "#fff",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 12,
      fontWeight: 900,
    },
    mainCardBtn: {
      width: "92%",
      height: 270,
      margin: "26px auto 0 auto",
      borderRadius: 28,
      border: "1px solid rgba(59,130,246,0.22)",
      background: "#eff6ff",
      boxShadow: "inset 0 0 0 1px rgba(59,130,246,0.06)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 36px",
      textAlign: "center" as const,
      cursor: "pointer",
    },
    mainText: {
      fontSize: 28,
      fontWeight: 600,
      color: "#1f2937",
      lineHeight: 1.35,
    },
    controlsRow: {
      display: "flex",
      justifyContent: "center",
      marginTop: 18,
    },
    controlsPill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: 10,
      borderRadius: 999,
      background: "rgba(255,255,255,0.82)",
      border: "1px solid #e5e7eb",
      boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
      backdropFilter: "blur(8px)",
    },
    roundBtn: {
      width: 44,
      height: 44,
      borderRadius: 999,
      border: "1px solid #e5e7eb",
      background: "#fff",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      fontSize: 18,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    },
    emojiOrange: {
      width: 64,
      height: 44,
      borderRadius: 999,
      border: "1px solid #fed7aa",
      background: "#ffedd5",
      cursor: "pointer",
      boxShadow: "0 2px 10px rgba(249,115,22,0.18)",
      fontSize: 22,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    },
    emojiGreen: {
      width: 64,
      height: 44,
      borderRadius: 999,
      border: "1px solid #bbf7d0",
      background: "#dcfce7",
      cursor: "pointer",
      boxShadow: "0 2px 10px rgba(34,197,94,0.18)",
      fontSize: 22,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    },
    bottomRight: {
      position: "absolute",
      right: 16,
      bottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 10,
      color: "#6b7280",
      fontSize: 14,
    },
    ghostBtn: {
      border: "1px solid #e5e7eb",
      background: "rgba(255,255,255,0.82)",
      borderRadius: 999,
      padding: "10px 14px",
      cursor: "pointer",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
    },
    smallTopBtn: {
      position: "absolute",
      top: 14,
      border: "1px solid #e5e7eb",
      background: "rgba(255,255,255,0.85)",
      borderRadius: 999,
      padding: "6px 10px",
      fontSize: 12,
      fontWeight: 800,
      color: "#4b5563",
      cursor: "pointer",
    },
    help: {
      marginTop: 12,
      fontSize: 14,
      color: "#6b7280",
    },
    helpLink: {
      color: "#2563eb",
      textDecoration: "underline",
      cursor: "pointer",
    },
    empty: {
      borderRadius: 22,
      border: "1px solid #e5e7eb",
      background: "#f9fafb",
      padding: 28,
      textAlign: "center" as const,
      color: "#4b5563",
    },
  };

  return (
    <section style={styles.wrap} data-proof="FlashcardsView-InlinePro">
      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        <span style={styles.crumbIcon} />
        <span>{breadcrumbLeft ?? ""}</span>
        {(breadcrumbLeft ?? "").trim() ? <span>›</span> : null}
        <span style={{ color: "#374151", fontWeight: 700 }}>{breadcrumbRight}</span>
      </div>

      {/* Header */}
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>{title}</h2>
          {examCode ? <div style={styles.examCode}>Exam code: {examCode}</div> : null}
        </div>

        <div style={styles.rightHeader}>
          <span>{progressText}</span>
          <button type="button" onClick={handleDownload} style={styles.download}>
            Download
          </button>
        </div>
      </div>

      {/* ✅ How to use these cards - All 3 help versions */}
      <div
        style={{
          marginTop: 6,
          marginBottom: 14,
          padding: "10px 14px",
          borderRadius: 12,
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          fontSize: 13,
          fontWeight: 600,
          color: "#334155",
          lineHeight: 1.5,
        }}
      >
        {/* 1) Ultra-short */}
        <div style={{ fontWeight: 900, marginBottom: 6 }}>
          Try to answer → Flip → Choose Practising if unsure / Mastered if confident.
        </div>

        {/* 2) Standard */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Quick steps</div>
          <div style={{ marginTop: 2 }}>1) Read the front and answer in your head</div>
          <div style={{ marginTop: 2 }}>2) Flip to check the back</div>
          <div style={{ marginTop: 2 }}>
            3) Tap <strong>Practising</strong> if you weren't sure / got it wrong (it will come back sooner)
          </div>
          <div style={{ marginTop: 2 }}>
            4) Tap <strong>Mastered</strong> if you knew it confidently (it will appear less often)
          </div>
        </div>

        {/* 3) Full (collapsible) */}
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 900 }}>
            How it works (more detail)
          </summary>
          <div style={{ marginTop: 8 }}>
            <div>
              <strong>Step 1 — Attempt:</strong> Read the question and try to answer without looking.
            </div>
            <div>
              <strong>Step 2 — Check:</strong> Flip and compare your answer to the card.
            </div>
            <div style={{ marginTop: 6 }}>
              <strong>Step 3 — Decide:</strong>
            </div>
            <div>• <strong>Practising</strong> → you guessed / were unsure / got it wrong → we'll show it again sooner</div>
            <div>• <strong>Mastered</strong> → you knew it clearly and could explain it → we'll show it less often</div>
            <div style={{ marginTop: 6 }}>
              <strong>Tip:</strong> Be honest — choosing Practising helps you improve faster.
            </div>
          </div>
        </details>
      </div>

      {/* Pills - ✅ SS3: Now interactive buttons with Option A labels */}
      <div style={styles.pillsRow}>
        {/* "Practising" button */}
        <button
          type="button"
          onClick={() => currentCard && markStillLearning(currentCard.id)}
          style={{ all: "unset", cursor: "pointer" }}
          title="Cards you should review again"
        >
          <div style={{ ...styles.pill, background: "#fff7ed", color: "#9a3412" }}>
            <span style={{ ...styles.pillCount, background: "#ffedd5", color: "#9a3412" }}>
              {learningCount}
            </span>
            <span>Practising</span>
          </div>
        </button>

        {/* "Mastered" button */}
        <button
          type="button"
          onClick={() => currentCard && markKnow(currentCard.id)}
          style={{ all: "unset", cursor: "pointer" }}
          title="Cards you've mastered"
        >
          <div style={{ ...styles.pill, background: "#f0fdf4", color: "#166534" }}>
            <span>Mastered</span>
            <span style={{ ...styles.pillCount, background: "#dcfce7", color: "#166534" }}>
              {knownCount}
            </span>
          </div>
        </button>
      </div>

      {/* Body */}
      {total === 0 ? (
        <div style={styles.empty}>No flashcards yet. Generate revision with AI to get started.</div>
      ) : (
        <div style={styles.cardArea}>
          <div style={styles.deckLayer1} />
          <div style={styles.deckLayer2} />

          <div style={styles.cardShell}>
            {/* Prev/Next small */}
            <button
              type="button"
              onClick={goPrev}
              disabled={index === 0}
              style={{
                ...styles.smallTopBtn,
                right: 84,
                opacity: index === 0 ? 0.4 : 1,
                cursor: index === 0 ? "not-allowed" : "pointer",
              }}
            >
              Prev
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={index >= total - 1}
              style={{
                ...styles.smallTopBtn,
                right: 16,
                opacity: index >= total - 1 ? 0.4 : 1,
                cursor: index >= total - 1 ? "not-allowed" : "pointer",
              }}
            >
              Next
            </button>

            {/* Top bar */}
            <div style={styles.topBar}>
              <div style={styles.topBarLabel}>{flipped ? "Back" : "Front"}</div>
              <div style={styles.topRight}>
                <span style={styles.topic}>{topicLabel}</span>
                <span style={styles.plus}>+</span>
              </div>
            </div>

            {/* Main card */}
            <button type="button" onClick={flip} style={styles.mainCardBtn} aria-label="Flip card">
              <div style={styles.mainText}>{flipped ? currentCard?.back : currentCard?.front}</div>
            </button>

            {/* Controls */}
            <div style={styles.controlsRow}>
              <div style={styles.controlsPill}>
                <button type="button" onClick={goPrev} style={styles.roundBtn} aria-label="Previous">
                  ↩
                </button>

                <button
                  type="button"
                  onClick={() => currentCard && markStillLearning(currentCard.id)}
                  style={styles.emojiOrange}
                  aria-label="Practising"
                  title="Still practising"
                >
                  😵
                </button>

                <button
                  type="button"
                  onClick={() => currentCard && markKnow(currentCard.id)}
                  style={styles.emojiGreen}
                  aria-label="Mastered"
                  title="Mastered"
                >
                  😄
                </button>

                <button type="button" onClick={goNext} style={styles.roundBtn} aria-label="Next">
                  ↪
                </button>
              </div>
            </div>

            {/* Bottom right */}
            <div style={styles.bottomRight}>
              <button
                type="button"
                style={styles.ghostBtn}
                onClick={() => {
                  const el = document.documentElement;
                  if (!document.fullscreenElement) el.requestFullscreen?.();
                  else document.exitFullscreen?.();
                }}
              >
                ⛶ <span>Fullscreen</span>
              </button>

              <button
                type="button"
                style={{ ...styles.ghostBtn, width: 44, justifyContent: "center", padding: 0 }}
                onClick={() => {
                  const r = Math.floor(Math.random() * Math.max(1, total));
                  setFlipped(false);
                  setIndex(clamp(r, 0, Math.max(0, total - 1)));
                }}
                aria-label="Shuffle"
                title="Shuffle"
              >
                ⟲
              </button>
            </div>
          </div>

          <div style={styles.help}>
            Stuck? <span style={styles.helpLink}>Help with this card</span>
          </div>
        </div>
      )}
    </section>
  );
}