import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import { importFlashcards, getFlashcardBank } from "../../api/flashcardBank";
import { SpecSelector } from "../SpecSelector";
import { getStoredSpecKey, setStoredSpecKey } from "../../utils/specKey";
import { useTaxonomy } from "../../hooks/useTaxonomy";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import type { SpecKey } from "../../api/taxonomy";

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  difficulty?: number; // 1–3 typically
  tags?: string[];
  lastReviewed?: string | Date;
};

type Props = {
  lessonId: string;
  initialCards: Flashcard[];
  apiBaseUrl?: string; // default http://localhost:5000
  title?: string;
  topicKeyForBank?: string | null; // PR-CONTENT-TARGETING-1: namespaced key for AI generation
  /** Lesson's topic/topicKey; required to allow "Save to bank" (block if missing). */
  lessonTopicKey?: string | null;
  onSaved?: () => void;
  isAdmin?: boolean; // Added: admin-only delete control
  /** When true, only show cards missing front or back (from "Jump to Flashcards" issues callout). */
  filterBrokenOnly?: boolean;
  onFilterBrokenChange?: (enabled: boolean) => void;
};

function newId(prefix = "fc") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function splitAndCleanTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeDifficulty(d: any): number {
  const n = Number(d);
  if (!Number.isFinite(n)) return 1;
  if (n < 1) return 1;
  if (n > 3) return 3;
  return Math.round(n);
}

/**
 * Bulk text parser that supports:
 * 1) Q:/A: pairs:
 *    Q: question
 *    A: answer
 *
 * 2) Plain blocks separated by blank lines:
 *    Question line
 *    Answer line(s)
 *
 * 3) "True or False?" style (treated as a question line, next non-empty lines as answer until blank)
 */
function parseBulkTextToFlashcards(input: string): Flashcard[] {
  const text = (input || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return [];

  // If it contains Q:/A: tokens, parse with that.
  const hasQA = /(^|\n)\s*Q\s*:/i.test(text) && /(^|\n)\s*A\s*:/i.test(text);
  if (hasQA) {
    const lines = text.split("\n");
    const out: Flashcard[] = [];

    let currentQ: string[] = [];
    let currentA: string[] = [];
    let mode: "q" | "a" | null = null;

    const flush = () => {
      const q = currentQ.join("\n").trim();
      const a = currentA.join("\n").trim();
      if (q && a) {
        out.push({
          id: newId(),
          front: q,
          back: a,
          difficulty: 1,
          tags: [],
        });
      }
      currentQ = [];
      currentA = [];
      mode = null;
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();

      if (/^\s*Q\s*:/i.test(line)) {
        // new card begins
        if (currentQ.length || currentA.length) flush();
        mode = "q";
        currentQ.push(line.replace(/^\s*Q\s*:\s*/i, "").trim());
        continue;
      }
      if (/^\s*A\s*:/i.test(line)) {
        mode = "a";
        currentA.push(line.replace(/^\s*A\s*:\s*/i, "").trim());
        continue;
      }

      // Keep accumulating
      if (mode === "q") currentQ.push(line.trim());
      else if (mode === "a") currentA.push(line.trim());
      else {
        // ignore stray text before first Q:
      }
    }

    if (currentQ.length || currentA.length) flush();
    return out;
  }

  // Bullet-style: "• Question?\nAnswer line(s)\n• Next question..."
  const bulletLed = /(^|\n)\s*[•·]\s+/;
  if (bulletLed.test(text)) {
    const out: Flashcard[] = [];
    const parts = text.split(/(?=(?:^|\n)\s*[•·]\s+)/);
    for (const part of parts) {
      const trimmed = part.replace(/^\s*[•·]\s*/, "").trim();
      if (!trimmed) continue;
      const firstNewline = trimmed.indexOf("\n");
      const question = firstNewline === -1 ? trimmed : trimmed.slice(0, firstNewline).trim();
      const answer = firstNewline === -1 ? "" : trimmed.slice(firstNewline + 1).trim();
      if (question && answer) {
        out.push({
          id: newId(),
          front: question.replace(/^\s*[•·]\s*/, "").trim(),
          back: answer,
          difficulty: 1,
          tags: [],
        });
      }
    }
    if (out.length > 0) return out;
  }

  // Otherwise parse by blank-line blocks: first non-empty line is question, rest is answer.
  const blocks = text
    .split(/\n\s*\n+/g)
    .map((b) => b.trim())
    .filter(Boolean);

  const out: Flashcard[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) continue;

    let question = lines[0];
    let answerLines = lines.slice(1);

    if (/^true\s+or\s+false\??$/i.test(lines[0]) && lines.length >= 3) {
      question = `True or False? ${lines[1]}`.trim();
      answerLines = lines.slice(2);
    }

    const answer = answerLines.join("\n").trim();
    if (!question || !answer) continue;

    out.push({
      id: newId(),
      front: question,
      back: answer,
      difficulty: 1,
      tags: [],
    });
  }

  return out;
}

/**
 * Minimal CSV parser (handles quoted fields).
 * Expected columns (any order, case-insensitive):
 * front, back, difficulty, tags
 * tags can be "tag1,tag2" or "tag1;tag2"
 */
function parseCSV(csvText: string): Flashcard[] {
  const text = (csvText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return [];

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    if (row.some((c) => (c || "").trim().length > 0)) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      field += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && ch === ",") {
      pushField();
      continue;
    }

    if (!inQuotes && ch === "\n") {
      pushField();
      pushRow();
      continue;
    }

    field += ch;
  }

  pushField();
  pushRow();

  if (rows.length < 2) return [];

  const header = rows[0].map((h) => (h || "").trim().toLowerCase());
  const idx = {
    front: header.findIndex((h) => ["front", "question", "q"].includes(h)),
    back: header.findIndex((h) => ["back", "answer", "a"].includes(h)),
    difficulty: header.findIndex((h) => ["difficulty", "level"].includes(h)),
    tags: header.findIndex((h) => ["tags", "tag"].includes(h)),
  };

  const out: Flashcard[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const front = (cols[idx.front] ?? "").trim();
    const back = (cols[idx.back] ?? "").trim();
    if (!front || !back) continue;

    const diffRaw = idx.difficulty >= 0 ? (cols[idx.difficulty] ?? "").trim() : "";
    const tagsRaw = idx.tags >= 0 ? (cols[idx.tags] ?? "").trim() : "";

    const tags =
      tagsRaw.indexOf(";") >= 0
        ? tagsRaw
            .split(";")
            .map((t) => t.trim())
            .filter(Boolean)
        : splitAndCleanTags(tagsRaw);

    out.push({
      id: newId(),
      front,
      back,
      difficulty: diffRaw ? normalizeDifficulty(diffRaw) : 1,
      tags,
    });
  }

  return out;
}

function isCardBroken(c: Flashcard): boolean {
  return !String(c.front ?? "").trim() || !String(c.back ?? "").trim();
}

export default function FlashcardsEditor({
  lessonId,
  initialCards,
  apiBaseUrl = "http://localhost:5000",
  title = "Flashcards",
  topicKeyForBank: topicKeyForBankProp,
  lessonTopicKey,
  onSaved,
  isAdmin = false, // Added: default to false for non-admin
  filterBrokenOnly = false,
  onFilterBrokenChange,
}: Props) {
  const { token } = useCurrentUser({ watchLocation: true });
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Bulk paste
  const [bulkText, setBulkText] = useState("");
  const [bulkCountPreview, setBulkCountPreview] = useState<number>(0);

  // CSV upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvInfo, setCsvInfo] = useState<string>("");

  // AI generate
  const [aiLoading, setAiLoading] = useState(false);

  // Show/hide existing flashcards section
  const [showExisting, setShowExisting] = useState(true);

  // Import from question bank (same source as Worksheet Builder)
  type TaxonomyUnit = { unit: string; topics?: Array<{ topic: string; key: string }> };
  const [specKey, setSpecKey] = useState<SpecKey>(getStoredSpecKey);
  const { data: taxonomy } = useTaxonomy(specKey);
  const [topicKeyForBank, setTopicKeyForBank] = useState<string>("");
  const [bankImportLoading, setBankImportLoading] = useState(false);
  /** Highlight Save button after successful import so teacher notices they must save */
  const [saveButtonHighlight, setSaveButtonHighlight] = useState(false);
  // PR-F1: Save current cards to topic bank
  const [topicKeyForImport, setTopicKeyForImport] = useState<string>("");
  const [topicNameForImport, setTopicNameForImport] = useState<string>("");
  const [importToBankLoading, setImportToBankLoading] = useState(false);
  const [showSaveToBankConfirm, setShowSaveToBankConfirm] = useState(false);

  const onSpecChange = (v: SpecKey) => {
    setSpecKey(v);
    setStoredSpecKey(v);
    setTopicKeyForBank("");
    setTopicKeyForImport("");
  };

  /** Clear Save button highlight after 8s so it doesn't stay prominent forever */
  useEffect(() => {
    if (!saveButtonHighlight) return;
    const t = setTimeout(() => setSaveButtonHighlight(false), 8000);
    return () => clearTimeout(t);
  }, [saveButtonHighlight]);

  /** Preselect lesson topic in Import from question bank when lesson has exact topicKey */
  useEffect(() => {
    if (!topicKeyForBankProp || !taxonomy?.units) return;
    const raw = String(topicKeyForBankProp).trim();
    if (!raw) return;
    const topicSlug = raw.includes(":") ? raw.slice(raw.indexOf(":") + 1) : raw;
    const allKeys = (taxonomy.units || []).flatMap((u) => (u.topics || []).map((t) => t.key));
    if (topicSlug && allKeys.includes(topicSlug)) {
      setTopicKeyForBank(topicSlug);
    }
  }, [topicKeyForBankProp, taxonomy?.units]);

  useEffect(() => {
    const raw = Array.isArray(initialCards) ? initialCards : [];
    const seenIds = new Map<string, number>();
    const normalized = raw.map((c: any, idx) => {
      const id = c.id || newId();
      const count = seenIds.get(id) ?? 0;
      seenIds.set(id, count + 1);
      const localId = c.localId || (count === 0 ? id : `${id}-${idx}`);
      return {
        id,
        localId,
        front: String(c.front ?? ""),
        back: String(c.back ?? ""),
        difficulty: c.difficulty ? normalizeDifficulty(c.difficulty) : 1,
        tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
        lastReviewed: c.lastReviewed,
        ...(c.topicBankId != null ? { topicBankId: c.topicBankId } : {}),
      };
    });
    setCards(normalized);
  }, [initialCards]);

  useEffect(() => {
    const parsed = parseBulkTextToFlashcards(bulkText);
    setBulkCountPreview(parsed.length);
  }, [bulkText]);


  const countLabel = useMemo(() => `${cards.length}`, [cards.length]);

  const brokenCards = useMemo(
    () => cards.filter((c) => !String(c.front ?? "").trim() || !String(c.back ?? "").trim()),
    [cards]
  );
  const displayCards = useMemo(
    () => (filterBrokenOnly ? brokenCards : cards),
    [filterBrokenOnly, brokenCards, cards]
  );

  type ExamQuestionItem = {
    question: string;
    type?: string;
    options?: string[];
    correctIndex?: number | null;
    correctAnswer?: string | null;
    markScheme?: string[];
  };

  const examQuestionToFlashcard = useCallback((q: ExamQuestionItem): Flashcard => {
    const front = (q.question || "").trim() || "—";
    let back = "—";
    if (q.type === "mcq" && Array.isArray(q.options) && q.correctIndex != null && q.correctIndex >= 0 && q.correctIndex < q.options.length) {
      back = q.options[q.correctIndex];
    } else if (typeof q.correctAnswer === "string" && q.correctAnswer.trim()) {
      back = q.correctAnswer.trim();
    } else if (Array.isArray(q.markScheme) && q.markScheme.length > 0) {
      back = q.markScheme.map((s) => String(s).trim()).filter(Boolean).join(" / ");
    }
    return {
      id: newId(),
      front,
      back,
      difficulty: 1,
      tags: [],
    };
  }, []);

  const importFromQuestionBank = useCallback(async () => {
    resetMessages();
    const topicKey = (topicKeyForBank || "").trim().toLowerCase();
    if (!topicKey) {
      setError("Select a topic to import from the question bank.");
      return;
    }
    setBankImportLoading(true);
    try {
      const namespacedKey = topicKey.includes(":") ? topicKey : `${specKey}:${topicKey}`;
      let imported: Flashcard[] = [];

      // 1) Try FlashcardBank first (same source as "Load flashcards from bank" in Lesson View)
      try {
        const bankData = await getFlashcardBank(namespacedKey);
        const bankCards = bankData?.cards || [];
        if (bankCards.length > 0) {
          imported = bankCards.map((c, i) => ({
            id: newId(),
            front: (c.front || "").trim() || "—",
            back: (c.back || "").trim() || "—",
            difficulty: 1,
            tags: Array.isArray(c.tags) ? c.tags : [],
          })).filter((c) => c.front && c.front !== "—");
        }
      } catch {
        // FlashcardBank not found or error — fall through to ExamQuestion
      }

      // 2) Fallback: ExamQuestion (Worksheet Builder question bank)
      if (imported.length === 0) {
        const res = await api.get("/exam-questions", { params: { topicKey } });
        const list = Array.isArray((res?.data as any)?.questions) ? (res.data as any).questions : [];
        imported = list.map((q: ExamQuestionItem) => examQuestionToFlashcard(q)).filter((c) => c.front && c.front !== "—");
      }

      if (imported.length === 0) {
        setStatus("No flashcards found for this exact topic.");
        return;
      }
      const addedCountRef = { current: 0 };
      setCards((prev) => {
        const seen = new Set(prev.map((c) => `${String(c.front ?? "").trim().toLowerCase()}__${String(c.back ?? "").trim().toLowerCase()}`));
        const toAdd = imported.filter((c) => {
          const key = `${String(c.front ?? "").trim().toLowerCase()}__${String(c.back ?? "").trim().toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        addedCountRef.current = toAdd.length;
        return [...prev, ...toAdd];
      });
      const n = addedCountRef.current;
      const addedMsg = n === imported.length
        ? `${n} flashcards added. Click "Save flashcards" to save them to this lesson.`
        : `${n} new flashcards added (${imported.length - n} duplicates skipped). Click "Save flashcards" to save them to this lesson.`;
      setStatus(addedMsg);
      setSaveButtonHighlight(true);
    } catch (e: any) {
      setError(e?.response?.data?.msg || e?.message || "Failed to load question bank.");
    } finally {
      setBankImportLoading(false);
    }
  }, [topicKeyForBank, specKey, examQuestionToFlashcard]);

  const hasLessonTopic = Boolean(lessonTopicKey && String(lessonTopicKey).trim());

  const importCurrentCardsToBank = useCallback(async () => {
    resetMessages();
    const key = (topicKeyForImport || "").trim().toLowerCase();
    if (!key) {
      setError("Enter or select a topic key to save to the bank.");
      return;
    }
    if (cards.length === 0) {
      setError("No cards to save. Add or import flashcards first.");
      return;
    }
    setImportToBankLoading(true);
    try {
      const bankCards = cards.map((c) => ({
        front: c.front,
        back: c.back,
        tags: Array.isArray(c.tags) ? c.tags : [],
      }));
      await importFlashcards(key, (topicNameForImport || "").trim() || key.replace(/-/g, " "), bankCards);
      setStatus(`Saved ${cards.length} cards to topic bank (${key}). You can "Load flashcards from bank" on any lesson with this topic.`);
      setShowSaveToBankConfirm(false);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Failed to save to bank.");
    } finally {
      setImportToBankLoading(false);
    }
  }, [topicKeyForImport, topicNameForImport, cards]);

  const duplicateFlashcardCount = useMemo(() => {
    const seen = new Set<string>();
    let count = 0;
    for (const c of cards) {
      const key = `${String(c.front ?? "").trim().toLowerCase()}|${String(c.back ?? "").trim().toLowerCase()}`;
      if (key && seen.has(key)) count++;
      else if (key) seen.add(key);
    }
    return count;
  }, [cards]);

  const styles: Record<string, React.CSSProperties> = {
    wrap: {
      border: "1px solid #e5e7eb",
      borderRadius: 16,
      padding: 18,
      background: "#ffffff",
    },
    headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
    h2: { margin: 0, fontSize: 18, fontWeight: 900, color: "#111827" },
    pill: {
      borderRadius: 999,
      padding: "6px 10px",
      border: "1px solid #e5e7eb",
      background: "#f9fafb",
      fontSize: 12,
      fontWeight: 800,
      color: "#374151",
    },
    section: { marginTop: 14, border: "1px solid #eef2ff", background: "#f8fafc", borderRadius: 14, padding: 14 },
    label: { fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 6 },
    input: {
      width: "100%",
      border: "1px solid #d1d5db",
      borderRadius: 10,
      padding: "10px 12px",
      fontSize: 14,
      outline: "none",
      background: "#fff",
    },
    textarea: {
      width: "100%",
      border: "1px solid #d1d5db",
      borderRadius: 10,
      padding: "10px 12px",
      fontSize: 14,
      outline: "none",
      background: "#fff",
      minHeight: 90,
      resize: "vertical",
    },
    btn: {
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "white",
      borderRadius: 10,
      padding: "10px 12px",
      fontWeight: 900,
      cursor: "pointer",
      fontSize: 13,
      lineHeight: "14px",
    },
    btnGhost: {
      border: "1px solid #d1d5db",
      background: "#ffffff",
      color: "#111827",
      borderRadius: 10,
      padding: "10px 12px",
      fontWeight: 900,
      cursor: "pointer",
      fontSize: 13,
      lineHeight: "14px",
    },
    btnRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
    msg: { marginTop: 10, fontSize: 13, fontWeight: 800, color: "#065f46" },
    err: { marginTop: 10, fontSize: 13, fontWeight: 900, color: "#991b1b" },
    list: { marginTop: 14, display: "grid", gap: 10 },
    card: {
      border: "1px solid #e5e7eb",
      borderRadius: 14,
      padding: 12,
      background: "#ffffff",
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "flex-start",
    },
    q: { fontWeight: 900, color: "#111827", marginBottom: 6 },
    a: { color: "#374151", fontWeight: 600, whiteSpace: "pre-wrap" as any },
    meta: { marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
    tag: { fontSize: 12, fontWeight: 800, padding: "4px 8px", borderRadius: 999, background: "#f3f4f6", color: "#374151" },
    diff: { fontSize: 12, fontWeight: 900, padding: "4px 8px", borderRadius: 999, background: "#dbeafe", color: "#1e40af" },
    trash: {
      border: "1px solid #e5e7eb",
      background: "#fff",
      borderRadius: 10,
      padding: "8px 10px",
      cursor: "pointer",
      fontWeight: 900,
    },
  };

  const resetMessages = () => {
    setStatus("");
    setError("");
  };

  const handleAddOne = () => {
    resetMessages();
    const f = front.trim();
    const b = back.trim();
    if (!f || !b) {
      setError("Please enter both Question/Front and Answer/Back.");
      return;
    }
    const newCard: Flashcard = {
      id: newId(),
      front: f,
      back: b,
      difficulty: 1,
      tags: splitAndCleanTags(tags),
    };
    setCards((prev) => [newCard, ...prev]);
    setFront("");
    setBack("");
    setTags("");
    setStatus("Added 1 flashcard (not saved yet).");
  };

  const handleDelete = (id: string) => {
    resetMessages();

    // Added: Admin-only delete check
    if (!isAdmin) {
      setError("Only admins can delete flashcards.");
      return;
    }

    setCards((prev) => prev.filter((c) => c.id !== id));
    setStatus("Flashcard removed (not saved yet).");
  };

  const saveAll = async () => {
    resetMessages();
    setSaveButtonHighlight(false);

    if (!token) {
      setError("You must be logged in to save flashcards.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/lessons/${lessonId}/revision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          flashcards: cards.map((c) => ({
            id: c.id,
            topicBankId: (c as any).topicBankId ?? undefined,
            source: (c as any).source ?? undefined,
            front: c.front,
            back: c.back,
            difficulty: normalizeDifficulty(c.difficulty ?? 1),
            tags: Array.isArray(c.tags) ? c.tags : [],
          })),
        }),
      });

      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : await res.text();

      if (!res.ok) {
        const msg = (data as any)?.msg || (data as any)?.message || `Save failed (HTTP ${res.status}).`;
        throw new Error(msg);
      }

      if (process.env.NODE_ENV !== "production") {
        const sample = cards.slice(0, 3).map((c) => ({
          id: c.id,
          topicBankId: (c as any).topicBankId,
          source: (c as any).source,
          front: (c.front || "").slice(0, 30),
        }));
        console.log("[FlashcardsEditor] Saved successfully.", cards.length, "cards. Sample (id, topicBankId, source, front):", sample);
      }
      setStatus(`Saved successfully. Total flashcards: ${cards.length}`);
      onSaved?.();
    } catch (e: any) {
      setError(e?.message || "Failed to save flashcards.");
    } finally {
      setSaving(false);
    }
  };

  const importBulkPaste = () => {
    resetMessages();
    const parsed = parseBulkTextToFlashcards(bulkText);
    if (!parsed.length) {
      setError("No flashcards detected. Try using Q:/A: format or blank-line-separated blocks.");
      return;
    }
    setCards((prev) => {
      const merged = [...parsed, ...prev];
      const seen = new Set<string>();
      const out: Flashcard[] = [];
      for (const c of merged) {
        const key = `${c.front}__${c.back}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(c);
      }
      return out;
    });
    setBulkText("");
    setStatus(`Imported ${parsed.length} flashcards (not saved yet). Now click "Save flashcards".`);
  };

  const downloadCSVTemplate = () => {
    const template = `front,back,difficulty,tags
"Do prokaryotic organisms contain a nucleus?","No. Prokaryotic organisms do not contain a nucleus.",1,"cells,prokaryotes"
"What is a prokaryotic organism?","An organism whose cells lack a nucleus and other membrane-bound organelles.",1,"definition,prokaryotes"
`;
    const blob = new Blob([template], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flashcards_template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onCSVChosen = async (file: File) => {
    resetMessages();
    setCsvInfo("");
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (!parsed.length) {
        setError("No flashcards found in CSV. Ensure header includes: front, back (difficulty/tags optional).");
        return;
      }
      setCards((prev) => {
        const merged = [...parsed, ...prev];
        const seen = new Set<string>();
        const out: Flashcard[] = [];
        for (const c of merged) {
          const key = `${c.front}__${c.back}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(c);
        }
        return out;
      });
      setCsvInfo(`Imported ${parsed.length} from CSV (not saved yet).`);
      setStatus(`Imported ${parsed.length} from CSV (not saved yet). Now click "Save flashcards".`);
    } catch (e: any) {
      setError(e?.message || "Failed to read/parse CSV.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const generateWithAI = async () => {
    resetMessages();

    if (!token) {
      setError("You must be logged in to generate revision with AI.");
      return;
    }

    if (!topicKeyForBank) {
      setError("Lesson not mapped to a syllabus subtopic.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/lessons/${lessonId}/generate-revision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ topicKey: topicKeyForBank }),
      });

      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : await res.text();

      if (!res.ok) {
        const msg = (data as any)?.msg || (data as any)?.message || `AI generate failed (HTTP ${res.status}).`;
        throw new Error(msg);
      }

      const flashcards = (data as any)?.flashcards || (data as any)?.lesson?.flashcards;
      if (Array.isArray(flashcards) && flashcards.length) {
        const normalized = flashcards.map((c: any) => ({
          id: c.id || newId(),
          front: String(c.front ?? ""),
          back: String(c.back ?? ""),
          difficulty: c.difficulty ? normalizeDifficulty(c.difficulty) : 1,
          tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
        }));
        setCards(normalized);
        setStatus(`AI generated ${normalized.length} flashcards. Now click "Save flashcards".`);
      } else {
        setStatus("AI generation completed. If you don't see new cards, check backend response shape.");
      }
    } catch (e: any) {
      setError(e?.message || "AI generation failed.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={styles.h2}>{title}</h2>
          <span style={styles.pill}>Flashcards ({countLabel})</span>
        </div>

        <div style={styles.btnRow}>
          <button type="button" style={styles.btnGhost} onClick={downloadCSVTemplate}>
            Download CSV template
          </button>

          <button type="button" style={styles.btnGhost} onClick={() => fileInputRef.current?.click()}>
            Upload CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCSVChosen(f);
            }}
          />

          <button
            type="button"
            style={styles.btn}
            onClick={generateWithAI}
            disabled={aiLoading || !topicKeyForBank}
            title={!topicKeyForBank ? "Lesson not mapped to a syllabus subtopic." : undefined}
          >
            {aiDoneLabel(aiLoading)}
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <div style={{ fontWeight: 900, marginBottom: 10, color: "#111827" }}>Add New Flashcard</div>

        <div style={{ display: "grid", gap: "10px" }}>
          <div>
            <div style={styles.label}>Question/Front</div>
            <textarea
              style={styles.textarea}
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="Enter the question or term..."
            />
          </div>

          <div>
            <div style={styles.label}>Answer/Back</div>
            <textarea
              style={styles.textarea}
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="Enter the answer or definition..."
            />
          </div>

          <div>
            <div style={styles.label}>Tags (comma-separated)</div>
            <input
              style={styles.input}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., key-concept, formula, vocabulary"
            />
          </div>

          <div style={styles.btnRow}>
            <button type="button" style={styles.btn} onClick={handleAddOne}>
              Add Flashcard
            </button>
            <button
              type="button"
              style={{
                ...styles.btnGhost,
                ...(saveButtonHighlight
                  ? {
                      border: "2px solid #2563eb",
                      background: "#eff6ff",
                      boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.3)",
                      fontWeight: 900,
                    }
                  : {}),
              }}
              onClick={saveAll}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save flashcards"}
            </button>
          </div>

          {status ? <div style={styles.msg}>{status}</div> : null}
          {error ? <div style={styles.err}>{error}</div> : null}
          {csvInfo ? <div style={{ ...styles.msg, color: "#1f2937" }}>{csvInfo}</div> : null}
        </div>
      </div>

      <div style={styles.section}>
        <div style={{ fontWeight: 900, marginBottom: 8, color: "#111827" }}>Bulk paste import</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10, lineHeight: "18px" }}>
          Paste either:
          <br />
          <span style={{ fontFamily: "monospace" }}>
            Q: ...{"\n"}A: ...
          </span>
          , or <b>• Question{"\n"}Answer</b> (bullet per card), or blocks separated by a blank line.
        </div>

        <textarea
          style={{ ...styles.textarea, minHeight: 160 }}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={`Example:\nQ: Do prokaryotic organisms contain a nucleus?\nA: No. Prokaryotic organisms do not contain a nucleus.\n\nQ: What is a prokaryotic organism?\nA: An organism whose cells lack a nucleus and other membrane-bound organelles.`}
        />

        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#374151" }}>
            Detected: <b>{bulkCountPreview}</b> flashcards
          </div>

          <div style={styles.btnRow}>
            <button type="button" style={styles.btnGhost} onClick={() => setBulkText("")}>
              Clear
            </button>
            <button type="button" style={styles.btn} onClick={importBulkPaste}>
              Import pasted text
            </button>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={{ fontWeight: 900, marginBottom: 8, color: "#111827" }}>Import from question bank</div>
        <div style={{ marginBottom: 10 }}>
          <SpecSelector value={specKey} onChange={onSpecChange} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10, lineHeight: "18px" }}>
          Add flashcards from the same question bank used by the Worksheet Builder. Choose a topic and append questions as cards (front = question, back = correct answer / mark scheme).
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <select
            value={topicKeyForBank}
            onChange={(e) => setTopicKeyForBank(e.target.value)}
            style={{ minWidth: 220, padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 13 }}
          >
            <option value="">Select topic…</option>
            {taxonomy?.units?.flatMap((u) =>
              (u.topics || []).map((t) => (
                <option key={t.key} value={t.key}>
                  {u.unit} — {t.topic}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            style={{ ...styles.btn, opacity: bankImportLoading ? 0.7 : 1 }}
            onClick={importFromQuestionBank}
            disabled={bankImportLoading}
          >
            {bankImportLoading ? "Loading…" : "Import from question bank (append)"}
          </button>
        </div>
      </div>

      {/* PR-F1: Save current cards to topic bank */}
      {cards.length > 0 ? (
        <div style={styles.section}>
          <div style={{ fontWeight: 900, marginBottom: 8, color: "#111827" }}>Save to topic bank</div>
          {!hasLessonTopic && (
            <div style={{ marginBottom: 10, padding: 8, background: "#fef3c7", borderRadius: 8, fontSize: 13, color: "#92400e" }}>
              Set Topic first (lesson details) before saving to bank.
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10, lineHeight: "18px" }}>
            Save the current {cards.length} card(s) to the flashcard bank for a topic. Use &quot;Load flashcards from bank&quot; on a lesson with no flashcards to copy them in.
          </div>
          {duplicateFlashcardCount > 0 && (
            <div style={{ marginBottom: 8, fontSize: 12, color: "#b45309" }}>⚠️ {duplicateFlashcardCount} duplicate card(s) detected (same front+back). Display only — save and sync are not blocked.</div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <select
              value={topicKeyForImport}
              onChange={(e) => setTopicKeyForImport(e.target.value)}
              style={{ minWidth: 220, padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 13 }}
            >
              <option value="">Select topic…</option>
              {taxonomy?.units?.flatMap((u) =>
                (u.topics || []).map((t) => (
                  <option key={t.key} value={t.key}>
                    {u.unit} — {t.topic}
                  </option>
                ))
              )}
            </select>
            <input
              type="text"
              value={topicNameForImport}
              onChange={(e) => setTopicNameForImport(e.target.value)}
              placeholder="Topic name (optional)"
              style={{ minWidth: 140, padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
            />
            <button
              type="button"
              style={{ ...styles.btn, opacity: importToBankLoading ? 0.7 : 1 }}
              onClick={() => {
                if (!hasLessonTopic) {
                  setError("Set Topic first.");
                  return;
                }
                const key = (topicKeyForImport || "").trim().toLowerCase();
                if (!key) {
                  setError("Enter or select a topic key to save to the bank.");
                  return;
                }
                if (cards.length === 0) {
                  setError("No cards to save.");
                  return;
                }
                setShowSaveToBankConfirm(true);
              }}
              disabled={importToBankLoading || !hasLessonTopic}
            >
              {importToBankLoading ? "Saving…" : "Import to bank"}
            </button>
          </div>
          {showSaveToBankConfirm && (
            <div style={{ marginTop: 14, padding: 14, background: "#f0f9ff", border: "1px solid #0ea5e9", borderRadius: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Confirm save to bank</div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>Topic: <strong>{topicKeyForImport}</strong> · {topicNameForImport || topicKeyForImport?.replace(/-/g, " ") || "—"}</div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>Count: {cards.length} card(s)</div>
              <div style={{ fontSize: 12, marginBottom: 10, color: "#475569" }}>Preview (first 3):</div>
              <ul style={{ margin: "0 0 10px", paddingLeft: 20, fontSize: 12 }}>
                {cards.slice(0, 3).map((c, i) => (
                  <li key={i}>{(c.front || "").slice(0, 50)}{(c.front && c.front.length > 50) ? "…" : ""} → {(c.back || "").slice(0, 30)}{(c.back && c.back.length > 30) ? "…" : ""}</li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={{ ...styles.btn }} onClick={() => importCurrentCardsToBank()} disabled={importToBankLoading}>Confirm save</button>
                <button type="button" style={{ ...styles.btn, background: "#64748b", border: "1px solid #64748b" }} onClick={() => setShowSaveToBankConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Existing Flashcards Section with Show/Hide toggle */}
      <div style={{ marginTop: 16 }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: 8,
          flexWrap: "wrap",
          gap: 8
        }}>
          <div style={{ fontWeight: 900, color: "#111827" }}>
            Existing Flashcards ({filterBrokenOnly ? `${displayCards.length} of ${cards.length} with issues` : cards.length})
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {brokenCards.length > 0 && onFilterBrokenChange && (
              <button
                type="button"
                onClick={() => onFilterBrokenChange(!filterBrokenOnly)}
                style={{
                  background: filterBrokenOnly ? "#f59e0b" : "transparent",
                  border: "1px solid #f59e0b",
                  borderRadius: 8,
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  color: filterBrokenOnly ? "#fff" : "#92400e",
                }}
              >
                {filterBrokenOnly ? `Show all (${cards.length})` : `Show only issues (${brokenCards.length})`}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowExisting(!showExisting)}
              style={{
                background: "none",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                color: "#374151",
              }}
            >
              {showExisting ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {showExisting && (
          <div style={styles.list}>
            {displayCards.map((c, idx) => {
              const key =
                (c as any).topicBankId ??
                (c as any)._id ??
                c.id ??
                (c as any).localId ??
                `card-${idx}`;
              return (
              <div key={key} style={styles.card}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={styles.q}>{c.front}</div>
                  <div style={styles.a}>{c.back}</div>
                  <div style={styles.meta}>
                    <span style={styles.diff}>Difficulty: {normalizeDifficulty(c.difficulty ?? 1)}/3</span>
                    {(c.tags || []).slice(0, 6).map((t, tagIdx) => (
                      <span key={`${key}-tag-${tagIdx}-${String(t)}`} style={styles.tag}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Updated delete button with admin restrictions */}
                <button
                  type="button"
                  style={{
                    ...styles.trash,
                    opacity: isAdmin ? 1 : 0.35,
                    cursor: isAdmin ? "pointer" : "not-allowed"
                  }}
                  onClick={() => handleDelete(c.id)}
                  title={isAdmin ? "Delete" : "Only admins can delete"}
                  disabled={!isAdmin}
                >
                  🗑️
                </button>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function aiDoneLabel(loading: boolean) {
  return loading ? "Generating..." : "Generate with AI";
}