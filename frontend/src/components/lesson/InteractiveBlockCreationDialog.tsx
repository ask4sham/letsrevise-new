import React, { useEffect, useState, type CSSProperties } from "react";
import {
  generateDragDropPairsFromText,
  generateInteractiveDiagramHotspotsFromConcept,
  generateInteractiveSequenceStepsFromTopic,
  type AISequenceStepDraft,
  type DragDropPair,
  type InteractiveDiagramHotspotAiDraft,
} from "../../api/ai";
import { INTERACTIVE_DIAGRAM_TEMPLATES, type InteractiveDiagramTemplate } from "./interactiveDiagramTemplates";
import { INTERACTIVE_SEQUENCE_TEMPLATES } from "./interactiveSequenceTemplates";
import {
  CELL_ORGANELLES_DRAG_DROP_TEMPLATE,
  DRAG_DROP_TEMPLATE_CELL_ORGANELLES_ID,
} from "./dragDropMatchTemplates";
import type { LessonBlockType } from "../../types/lessonBlocks";
import { mergeSequenceStepDescriptionAndImagePrompt } from "../../utils/interactiveSequenceStepImagePrompt";

export const INTERACTIVE_TYPES_WITH_CREATION_DIALOG: LessonBlockType[] = [
  "interactiveSequence",
  "interactiveDiagram",
  "dragDropMatch",
];

function createLocalBlockId() {
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type CreationMode = "empty" | "template" | "ai";

export type InteractiveBlockCreationDialogProps = {
  open: boolean;
  blockType: "interactiveSequence" | "interactiveDiagram" | "dragDropMatch";
  /** Lesson context for AI */
  lessonTitle?: string;
  pageTitle?: string;
  subject?: string;
  level?: string;
  onCancel: () => void;
  /**
   * Delivers a complete block object ready to insert (Create or Edit lesson).
   * No hidden defaults — empty means empty arrays and blank strings only.
   */
  onConfirm: (block: Record<string, unknown>) => void;
};

const TITLE: Record<InteractiveBlockCreationDialogProps["blockType"], string> = {
  interactiveSequence: "Add interactive sequence",
  interactiveDiagram: "Add interactive diagram",
  dragDropMatch: "Add drag and drop match",
};

function emptyBlock(blockType: InteractiveBlockCreationDialogProps["blockType"], newId: typeof createLocalBlockId): Record<string, unknown> {
  if (blockType === "interactiveSequence") {
    return {
      type: "interactiveSequence",
      content: "",
      title: "",
      intro: "",
      sequenceSteps: [],
    };
  }
  if (blockType === "interactiveDiagram") {
    return {
      type: "interactiveDiagram",
      content: "",
      title: "",
      intro: "",
      imageUrl: "",
      hotspots: [],
    };
  }
  return {
    type: "dragDropMatch",
    content: "",
    title: "",
    intro: "",
    instructions: "",
    pairs: [],
  };
}

/** First line trimmed, capped for block titles from free-text prompts */
function topicAsBlockTitle(prompt: string, maxChars: number): string {
  const first = prompt.split(/\n/)[0]?.trim() || "";
  if (!first.length) return "";
  return first.length <= maxChars ? first : first.slice(0, maxChars);
}

/** Optional count field from small text inputs — undefined uses generator defaults */
function parseOptionalStepCount(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = parseInt(t, 10);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function blockFromSequenceTemplate(templateId: string, newId: typeof createLocalBlockId): Record<string, unknown> {
  const tmpl = INTERACTIVE_SEQUENCE_TEMPLATES.find((t) => t.id === templateId);
  if (!tmpl) {
    return emptyBlock("interactiveSequence", newId);
  }
  return {
    type: "interactiveSequence",
    content: "",
    title: tmpl.title,
    intro: tmpl.intro,
    sequenceSteps: tmpl.sequenceSteps.map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      title: row.title,
      description: row.description,
      imageUrl: row.imageUrl ?? "",
      caption: row.caption ?? "",
      ...(typeof row.testExplanation === "string" && row.testExplanation.trim()
        ? { testExplanation: row.testExplanation.trim() }
        : {}),
    })),
  };
}

function blockFromInteractiveDiagramTemplate(
  tmpl: InteractiveDiagramTemplate,
  newId: typeof createLocalBlockId
): Record<string, unknown> {
  const existingImageUrl = "";
  const patchHotspotsCoords = tmpl.imageUrl
    ? tmpl.hotspots.map((row) => ({
        id: row.id?.trim() || newId(),
        x: row.x,
        y: row.y,
        label: row.label,
        description: row.description,
        ...(row.test ? { test: row.test } : {}),
      }))
    : tmpl.hotspots.map((row) => ({
        id: row.id?.trim() || newId(),
        label: row.label,
        description: row.description,
        ...(row.test ? { test: row.test } : {}),
      }));

  if (existingImageUrl) {
    return {
      type: "interactiveDiagram",
      content: "",
      title: tmpl.title,
      intro: tmpl.intro,
      imageUrl: existingImageUrl,
      hotspots: patchHotspotsCoords,
    };
  }
  if (tmpl.imageUrl) {
    return {
      type: "interactiveDiagram",
      content: "",
      title: tmpl.title,
      intro: tmpl.intro,
      imageUrl: tmpl.imageUrl,
      hotspots: patchHotspotsCoords,
    };
  }
  return {
    type: "interactiveDiagram",
    content: "",
    title: tmpl.title,
    intro: tmpl.intro,
    imageUrl: "",
    hotspots: patchHotspotsCoords,
  };
}

function blockFromDragDropCellOrganelles(newId: typeof createLocalBlockId): Record<string, unknown> {
  return {
    type: "dragDropMatch",
    content: "",
    title: "",
    intro: "",
    instructions: "",
    pairs: CELL_ORGANELLES_DRAG_DROP_TEMPLATE.map((row) => ({
      id: newId(),
      prompt: row.prompt,
      answer: row.answer,
      explanation: row.explanation,
    })),
  };
}

/** Modal: Empty | Template | Generate with AI (preview before insert — never empty placeholders for AI mode). */
export function InteractiveBlockCreationDialog({
  open,
  blockType,
  lessonTitle,
  pageTitle,
  subject,
  level,
  onCancel,
  onConfirm,
}: InteractiveBlockCreationDialogProps) {
  const [mode, setMode] = useState<CreationMode>("empty");
  const [sequenceTemplateChoice, setSequenceTemplateChoice] = useState<string>(
    INTERACTIVE_SEQUENCE_TEMPLATES[0]?.id ?? ""
  );
  const [diagramTemplateId, setDiagramTemplateId] = useState<string>("");
  const [dragDropTemplateChoice, setDragDropTemplateChoice] = useState<string>("");

  const [aiPrompt, setAiPrompt] = useState("");
  /** Optional counts for sequence / diagram AI */
  const [aiSeqStepsCountRaw, setAiSeqStepsCountRaw] = useState("");
  const [aiDiagHotspotsCountRaw, setAiDiagHotspotsCountRaw] = useState("");

  const [aiPairs, setAiPairs] = useState<DragDropPair[]>([]);
  const [aiSequenceDrafts, setAiSequenceDrafts] = useState<AISequenceStepDraft[]>([]);
  const [aiDiagramDrafts, setAiDiagramDrafts] = useState<InteractiveDiagramHotspotAiDraft[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("empty");
    setSequenceTemplateChoice(INTERACTIVE_SEQUENCE_TEMPLATES[0]?.id ?? "");
    setDiagramTemplateId("");
    setDragDropTemplateChoice("");
    setAiPrompt("");
    setAiSeqStepsCountRaw("");
    setAiDiagHotspotsCountRaw("");
    setAiPairs([]);
    setAiSequenceDrafts([]);
    setAiDiagramDrafts([]);
    setAiLoading(false);
    setAiErr(null);
  }, [open, blockType]);

  if (!open) return null;

  const newId = createLocalBlockId;

  const hasAiPreview =
    mode === "ai" &&
    ((blockType === "dragDropMatch" && aiPairs.length > 0) ||
      (blockType === "interactiveSequence" && aiSequenceDrafts.length > 0) ||
      (blockType === "interactiveDiagram" && aiDiagramDrafts.length > 0));

  const canSubmitTemplate =
    mode !== "template" ||
    (blockType === "interactiveSequence" && sequenceTemplateChoice.trim().length > 0) ||
    (blockType === "interactiveDiagram" && diagramTemplateId.trim().length > 0) ||
    (blockType === "dragDropMatch" && dragDropTemplateChoice.trim().length > 0);

  const canSubmitAi =
    mode !== "ai" ||
    (!aiLoading &&
      ((blockType === "dragDropMatch" && aiPairs.length > 0) ||
        (blockType === "interactiveSequence" && aiSequenceDrafts.length > 0) ||
        (blockType === "interactiveDiagram" && aiDiagramDrafts.length > 0)));

  const canSubmit =
    mode === "empty" ? true : mode === "template" ? canSubmitTemplate : canSubmitAi;

  const submit = () => {
    if (mode === "empty") {
      onConfirm(emptyBlock(blockType, newId));
      return;
    }
    if (mode === "template") {
      if (blockType === "interactiveSequence" && sequenceTemplateChoice.trim()) {
        onConfirm(blockFromSequenceTemplate(sequenceTemplateChoice, newId));
        return;
      }
      if (blockType === "interactiveDiagram") {
        const tmpl = INTERACTIVE_DIAGRAM_TEMPLATES.find((t) => t.id === diagramTemplateId);
        if (!tmpl) return;
        onConfirm(blockFromInteractiveDiagramTemplate(tmpl, newId));
        return;
      }
      if (blockType === "dragDropMatch" && dragDropTemplateChoice === DRAG_DROP_TEMPLATE_CELL_ORGANELLES_ID) {
        onConfirm(blockFromDragDropCellOrganelles(newId));
        return;
      }
      return;
    }

    /** mode === "ai" — block must be populated; never emit empty placeholders */
    if (blockType === "dragDropMatch") {
      if (aiPairs.length === 0 || aiLoading) return;
      const pairsPayload = aiPairs.map((row) => ({
        id: newId(),
        prompt: row.prompt ?? "",
        answer: row.answer ?? "",
        ...(row.explanation != null && String(row.explanation).trim()
          ? { explanation: String(row.explanation).trim() }
          : {}),
      }));
      onConfirm({
        type: "dragDropMatch",
        content: "",
        title: "",
        intro: "",
        instructions: "",
        pairs: pairsPayload,
      });
      return;
    }

    if (blockType === "interactiveSequence") {
      if (aiSequenceDrafts.length === 0 || aiLoading) return;
      const topicTrim = aiPrompt.trim();
      onConfirm({
        type: "interactiveSequence",
        content: "",
        title: topicAsBlockTitle(topicTrim, 140),
        intro: "",
        sequenceSteps: aiSequenceDrafts.map((row) => ({
          id: newId(),
          title: row.title,
          description: mergeSequenceStepDescriptionAndImagePrompt(row.description, row.imagePrompt ?? ""),
          caption: row.caption,
          imageUrl: "",
          ...(typeof row.testExplanation === "string" && row.testExplanation.trim()
            ? { testExplanation: row.testExplanation.trim() }
            : {}),
        })),
      });
      return;
    }

    /** interactiveDiagram */
    if (aiDiagramDrafts.length === 0 || aiLoading) return;
    const conceptTrim = aiPrompt.trim();
    onConfirm({
      type: "interactiveDiagram",
      content: "",
      title: topicAsBlockTitle(conceptTrim, 140),
      intro: "",
      imageUrl: "",
      hotspots: aiDiagramDrafts.map((row) => ({
        id: newId(),
        label: row.label,
        description: row.description,
      })),
    });
  };

  const runDragDropAi = async () => {
    const content = aiPrompt.trim();
    if (content.length < 8) {
      setAiErr("Enter a topic (e.g. virus structure) — at least 8 characters.");
      return;
    }
    setAiErr(null);
    setAiLoading(true);
    try {
      const pairs = await generateDragDropPairsFromText({
        lessonTitle,
        pageTitle,
        subject,
        level,
        text: content,
        source: "topic",
      });
      if (pairs.length === 0) {
        setAiErr("AI returned no pairs. Try a fuller description.");
        setAiPairs([]);
      } else {
        setAiPairs(pairs);
      }
    } catch {
      setAiErr("Generation failed. Try again.");
      setAiPairs([]);
    } finally {
      setAiLoading(false);
    }
  };

  const runSequenceAi = async () => {
    const topic = aiPrompt.trim();
    if (topic.length < 8) {
      setAiErr("Enter a concept or process (at least 8 characters).");
      return;
    }
    setAiErr(null);
    setAiLoading(true);
    try {
      const drafts = await generateInteractiveSequenceStepsFromTopic({
        topic,
        numSteps: parseOptionalStepCount(aiSeqStepsCountRaw),
        lessonTitle,
        pageTitle,
        subject,
        level,
      });
      if (!drafts.length) {
        setAiErr("AI returned no steps. Try again.");
        setAiSequenceDrafts([]);
      } else {
        setAiSequenceDrafts(drafts);
      }
    } catch {
      setAiErr("Generation failed. Try again.");
      setAiSequenceDrafts([]);
    } finally {
      setAiLoading(false);
    }
  };

  const runDiagramAi = async () => {
    const concept = aiPrompt.trim();
    if (concept.length < 12) {
      setAiErr("Enter a diagram concept or topic (at least 12 characters).");
      return;
    }
    setAiErr(null);
    setAiLoading(true);
    try {
      const drafts = await generateInteractiveDiagramHotspotsFromConcept({
        concept,
        numHotspots: parseOptionalStepCount(aiDiagHotspotsCountRaw),
        lessonTitle,
        pageTitle,
        subject,
        level,
      });
      if (!drafts.length) {
        setAiErr("AI returned no hotspots. Try again.");
        setAiDiagramDrafts([]);
      } else {
        setAiDiagramDrafts(drafts);
      }
    } catch {
      setAiErr("Generation failed. Try again.");
      setAiDiagramDrafts([]);
    } finally {
      setAiLoading(false);
    }
  };

  const regenerateAi = () => {
    if (blockType === "dragDropMatch") return void runDragDropAi();
    if (blockType === "interactiveSequence") return void runSequenceAi();
    return void runDiagramAi();
  };

  const overlayBg = "rgba(15,23,42,0.45)";

  const optionCard = (selected: boolean): CSSProperties => ({
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: "14px 16px",
    borderRadius: 10,
    border: selected ? "2px solid #6366f1" : "1px solid #e2e8f0",
    cursor: "pointer",
    background: selected ? "rgba(99,102,241,0.08)" : "#fafafa",
    boxSizing: "border-box",
    width: "100%",
    textAlign: "left",
  });

  const radioRail: CSSProperties = {
    flexShrink: 0,
    width: 22,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingTop: 2,
  };

  const radioInputStyle: CSSProperties = {
    margin: 0,
    width: 18,
    height: 18,
    cursor: "pointer",
    accentColor: "#4f46e5",
  };

  const optionTextCol: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
    textAlign: "left",
  };

  /** Title + description only — tight stack so body sits directly under the heading. */
  const optionHeadingStack: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 4,
    textAlign: "left",
  };

  const optionTitleStyle: CSSProperties = {
    fontWeight: 800,
    fontSize: 15,
    color: "#0f172a",
    lineHeight: 1.35,
    margin: 0,
  };

  const optionDescStyle: CSSProperties = {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.5,
    margin: 0,
  };

  const nestedExpandStyle: CSSProperties = {
    width: "100%",
  };

  const stopLabelBubble = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="interactive-block-create-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10050,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: overlayBg,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "min(92vh, 640px)",
          overflow: "auto",
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
          border: "1px solid rgba(0,0,0,0.08)",
          padding: "20px 22px",
          boxSizing: "border-box",
        }}
      >
        <h2 id="interactive-block-create-title" style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 800 }}>
          {TITLE[blockType]}
        </h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#475569", lineHeight: 1.45 }}>
          Choose how you want to start. Nothing is added until you confirm — no hidden example content on <strong>Empty</strong>.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={optionCard(mode === "empty")}>
            <span style={radioRail}>
              <input
                type="radio"
                name="ibl-mode"
                checked={mode === "empty"}
                onChange={() => setMode("empty")}
                style={radioInputStyle}
              />
            </span>
            <span style={optionTextCol}>
              <span style={optionHeadingStack}>
                <span style={optionTitleStyle}>Empty</span>
                <span style={optionDescStyle}>Blank activity — fastest. You fill everything.</span>
              </span>
            </span>
          </label>

          <label style={optionCard(mode === "template")}>
            <span style={radioRail}>
              <input
                type="radio"
                name="ibl-mode"
                checked={mode === "template"}
                onChange={() => setMode("template")}
                style={radioInputStyle}
              />
            </span>
            <span style={optionTextCol}>
              <span style={optionHeadingStack}>
                <span style={optionTitleStyle}>Use template</span>
                <span style={optionDescStyle}>Load a LetsRevise starter only when you choose it.</span>
              </span>
              {mode === "template" ? (
                <div style={nestedExpandStyle} onMouseDown={stopLabelBubble} onClick={stopLabelBubble}>
                  {blockType === "interactiveSequence" ? (
                    <select
                      value={sequenceTemplateChoice}
                      onChange={(e) => setSequenceTemplateChoice(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                    >
                      {INTERACTIVE_SEQUENCE_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {blockType === "interactiveDiagram" ? (
                    <select
                      value={diagramTemplateId}
                      onChange={(e) => setDiagramTemplateId(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                    >
                      <option value="">Choose a template…</option>
                      {INTERACTIVE_DIAGRAM_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {blockType === "dragDropMatch" ? (
                    <select
                      value={dragDropTemplateChoice}
                      onChange={(e) => setDragDropTemplateChoice(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                    >
                      <option value="">Choose a template…</option>
                      <option value={DRAG_DROP_TEMPLATE_CELL_ORGANELLES_ID}>Cell organelles → functions</option>
                    </select>
                  ) : null}
                </div>
              ) : null}
            </span>
          </label>

          <label style={optionCard(mode === "ai")}>
            <span style={radioRail}>
              <input
                type="radio"
                name="ibl-mode"
                checked={mode === "ai"}
                onChange={() => setMode("ai")}
                style={radioInputStyle}
              />
            </span>
            <span style={optionTextCol}>
              <span style={optionHeadingStack}>
                <span style={optionTitleStyle}>Generate with AI</span>
                <span style={optionDescStyle}>
                  {blockType === "dragDropMatch" && (
                    <>Enter a topic — AI suggests 4–6 match pairs (text only). Preview, then insert and edit.</>
                  )}
                  {blockType === "interactiveSequence" && (
                    <>Enter a concept or process — AI suggests 4–6 steps with optional image ideas. Preview before insert.</>
                  )}
                  {blockType === "interactiveDiagram" && (
                    <>Enter diagram concept — hotspots generate as text; you place pins later.</>
                  )}
                </span>
              </span>
              {mode === "ai" && blockType === "dragDropMatch" ? (
                <div style={nestedExpandStyle} onMouseDown={stopLabelBubble} onClick={stopLabelBubble}>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Virus structure — capsid, genetic material, host cell…"
                    rows={4}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                      fontFamily: "inherit",
                    }}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => void runDragDropAi()}
                      disabled={aiLoading}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "2px solid #7c3aed",
                        background: "rgba(245,243,255,0.95)",
                        color: "#5b21b6",
                        fontWeight: 700,
                        cursor: aiLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {aiLoading ? "Generating…" : "Generate pairs"}
                    </button>
                    {aiPairs.length > 0 ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#15803d" }}>{aiPairs.length} pairs • review below · then Insert block</span>
                    ) : null}
                  </div>
                  {aiPairs.length > 0 ? (
                    <ul
                      style={{
                        margin: "12px 0 0",
                        paddingLeft: 18,
                        fontSize: 12,
                        color: "#334155",
                        maxHeight: 160,
                        overflow: "auto",
                        lineHeight: 1.4,
                      }}
                    >
                      {aiPairs.map((p, i) => (
                        <li key={i}>
                          <strong>{p.prompt}</strong> → {p.answer}
                          {p.explanation ? (
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{p.explanation}</div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {aiErr ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>{aiErr}</div>
                  ) : null}
                </div>
              ) : null}

              {mode === "ai" && blockType === "interactiveSequence" ? (
                <div style={nestedExpandStyle} onMouseDown={stopLabelBubble} onClick={stopLabelBubble}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>Concept / process</label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Virus infection process — attachment, entry, replication, release…"
                    rows={3}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                      fontFamily: "inherit",
                    }}
                  />
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginTop: 8 }}>Steps (optional, 4–6)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={aiSeqStepsCountRaw}
                    onChange={(e) => setAiSeqStepsCountRaw(e.target.value)}
                    placeholder="e.g. 5"
                    style={{
                      width: "100%",
                      maxWidth: 120,
                      marginTop: 4,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                    }}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => void runSequenceAi()}
                      disabled={aiLoading}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "2px solid #7c3aed",
                        background: "rgba(245,243,255,0.95)",
                        color: "#5b21b6",
                        fontWeight: 700,
                        cursor: aiLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {aiLoading ? "Generating…" : "Generate preview"}
                    </button>
                    {aiSequenceDrafts.length > 0 ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#15803d" }}>
                        {aiSequenceDrafts.length} steps • then Insert block
                      </span>
                    ) : null}
                  </div>
                  {aiSequenceDrafts.length > 0 ? (
                    <ol
                      style={{
                        margin: "12px 0 0",
                        paddingLeft: 20,
                        fontSize: 12,
                        color: "#334155",
                        maxHeight: 200,
                        overflow: "auto",
                        lineHeight: 1.45,
                      }}
                    >
                      {aiSequenceDrafts.map((s, i) => (
                        <li key={i} style={{ marginBottom: 8 }}>
                          <strong>{s.title}</strong>
                          <div style={{ opacity: 0.92 }}>{s.description.slice(0, 180)}{s.description.length > 180 ? "…" : ""}</div>
                          {s.imagePrompt?.trim() ? (
                            <div style={{ fontSize: 11, marginTop: 4, color: "#0369a1" }}>
                              <strong>Image idea:</strong> {s.imagePrompt.trim().slice(0, 200)}
                              {s.imagePrompt.trim().length > 200 ? "…" : ""}
                            </div>
                          ) : null}
                          {s.caption?.trim() ? (
                            <div style={{ fontStyle: "italic", fontSize: 11, marginTop: 2, color: "#64748b" }}>
                              Answer / key idea (after reveal): {s.caption.trim()}
                            </div>
                          ) : null}
                          {s.testExplanation?.trim() ? (
                            <div style={{ fontSize: 11, marginTop: 4, color: "#475569" }}>
                              Test me explanation (optional): {s.testExplanation.trim()}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {aiErr ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>{aiErr}</div>
                  ) : null}
                </div>
              ) : null}

              {mode === "ai" && blockType === "interactiveDiagram" ? (
                <div style={nestedExpandStyle} onMouseDown={stopLabelBubble} onClick={stopLabelBubble}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>Concept</label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder='e.g. Plant cell structures, "mitosis apparatus" …'
                    rows={3}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                      fontFamily: "inherit",
                    }}
                  />
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginTop: 8 }}>Hotspots (optional, 3–12)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={aiDiagHotspotsCountRaw}
                    onChange={(e) => setAiDiagHotspotsCountRaw(e.target.value)}
                    placeholder="e.g. 6"
                    style={{
                      width: "100%",
                      maxWidth: 120,
                      marginTop: 4,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                    }}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => void runDiagramAi()}
                      disabled={aiLoading}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "2px solid #7c3aed",
                        background: "rgba(245,243,255,0.95)",
                        color: "#5b21b6",
                        fontWeight: 700,
                        cursor: aiLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {aiLoading ? "Generating…" : "Generate preview"}
                    </button>
                    {aiDiagramDrafts.length > 0 ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#15803d" }}>
                        {aiDiagramDrafts.length} hotspots • then Insert block
                      </span>
                    ) : null}
                  </div>
                  {aiDiagramDrafts.length > 0 ? (
                    <ul
                      style={{
                        margin: "12px 0 0",
                        paddingLeft: 18,
                        fontSize: 12,
                        color: "#334155",
                        maxHeight: 200,
                        overflow: "auto",
                        lineHeight: 1.45,
                      }}
                    >
                      {aiDiagramDrafts.map((h, i) => (
                        <li key={i} style={{ marginBottom: 8 }}>
                          <strong>{h.label}</strong>
                          <div>{h.description.slice(0, 200)}{h.description.length > 200 ? "…" : ""}</div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {aiErr ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>{aiErr}</div>
                  ) : null}
                </div>
              ) : null}
            </span>
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "2px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              marginRight: "auto",
            }}
          >
            Cancel
          </button>
          {mode === "ai" && hasAiPreview ? (
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => regenerateAi()}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "2px solid #94a3b8",
                background: "#f8fafc",
                cursor: aiLoading ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {aiLoading ? "…" : "Regenerate"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "2px solid #4338ca",
              background: canSubmit ? "#4f46e5" : "#a5b4fc",
              color: "#fff",
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontWeight: 800,
            }}
          >
            {mode === "ai" ? "Insert block" : "Add block"}
          </button>
        </div>
      </div>
    </div>
  );
}
