import React, { useCallback, useEffect, useState } from "react";
import { generateHotspotMcqFromConcept, type HotspotMcqPayload } from "../../api/ai";
import { hasRenderableLessonImageSrc } from "../../constants/lessonImageDisplay";
import {
  embeddedInteractiveDiagramTestToMcqPayload,
  getHotspotLetter,
  isInteractiveDiagramHotspotPlaced,
  parseEmbeddedInteractiveDiagramTest,
  resolveInteractiveDiagramHotspotExplanation,
} from "../../utils/interactiveDiagramHotspots";
import { hideBrokenLessonImage, LessonImageFrame } from "./LessonImageFrame";
import { AssessmentFeedback } from "./AssessmentFeedback";
import { LessonRichText } from "./LessonRichText";
import "./interactiveDiagramBlock.css";

export type InteractiveDiagramHotspot = {
  id: string;
  /** Omitted or invalid until the teacher places the marker on the image (editor). */
  x?: number | null;
  y?: number | null;
  label: string;
  /** Legacy alias for the hotspot explanation (same role as `explanation`). */
  description: string;
  /** Shown after the label when the hotspot is revealed; preferred when both are set. */
  explanation?: string;
  /** Preset/stored MCQ — when set, “Test me” skips AI generation. */
  test?: unknown;
};

/**
 * `full` | `student` | `teacher` → title, intro, image + hotspot panel (default learner/teacher preview).
 * `editorImageOnly` → image + markers only for Edit Lesson placement UX.
 */
export type InteractiveDiagramViewMode = "full" | "student" | "teacher" | "editorImageOnly";

export type InteractiveDiagramBlockProps = {
  blockTitle: string;
  intro: string;
  imageUrl: string;
  hotspots: InteractiveDiagramHotspot[];
  resolveImageUrl: (url: string) => string;
  /** Lesson title for AI (optional; falls back to block title) */
  lessonTitle?: string;
  level?: string;
  subject?: string;
  /**
   * Editor only: parent adds a new hotspot at click position. Image uses a hit-test layer; clicks on existing markers are ignored.
   * Omit in student/lesson view — lightbox and normal behaviour stay unchanged.
   */
  onImageClickToPlace?: (xPercent: number, yPercent: number) => void;
  /** See {@link InteractiveDiagramViewMode}. Omit or use `full`/`student` for normal lesson view. */
  viewMode?: InteractiveDiagramViewMode;
  /**
   * When true, omit the block-level title (outer SS1 heading already labels the frame).
   */
  hideBlockTitle?: boolean;
};

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function answersMatch(chosen: string, correct: string): boolean {
  const a = chosen.trim();
  const b = correct.trim();
  if (a === b) return true;
  return a.toLowerCase() === b.toLowerCase();
}

/** Teacher-authored label shown under “Structure {letter}” when it adds information. */
function teacherLabelAside(semanticLabel: string | undefined, letter: string): string | null {
  const t = semanticLabel?.trim() ?? "";
  if (!t) return null;
  const u = t.toUpperCase();
  if (u === letter.toUpperCase()) return null;
  if (u === `STRUCTURE ${letter}`.toUpperCase()) return null;
  return t;
}

function hotspotAccessibilityName(h: InteractiveDiagramHotspot, index: number): string {
  const letter = getHotspotLetter(index);
  const semantic = (h.label ?? "").trim();
  const aside = teacherLabelAside(semantic, letter);
  return aside ? `Structure ${letter}, ${aside}` : `Structure ${letter}`;
}

/**
 * Clickable hotspot diagram for lessons (plant cell, microscope, etc.).
 * Hotspot x/y are percentages 0–100 (left/top).
 */
export function InteractiveDiagramBlock({
  blockTitle,
  intro,
  imageUrl,
  hotspots,
  resolveImageUrl,
  lessonTitle,
  level,
  subject,
  onImageClickToPlace,
  viewMode,
  hideBlockTitle = false,
}: InteractiveDiagramBlockProps): React.ReactElement {
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [generatedQuestion, setGeneratedQuestion] = useState<HotspotMcqPayload | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [testMeError, setTestMeError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const list = Array.isArray(hotspots) ? hotspots : [];
  const imgRaw = (imageUrl ?? "").trim();
  const imgResolved = imgRaw ? resolveImageUrl(imgRaw) : "";
  const showImg = hasRenderableLessonImageSrc(imgRaw) && hasRenderableLessonImageSrc(imgResolved);
  const topicForAi = (lessonTitle ?? blockTitle).trim() || "Lesson";

  const hotspotId = (h: InteractiveDiagramHotspot, i: number) =>
    h.id && String(h.id).trim() ? String(h.id) : `hs-${i}`;

  const active =
    activeHotspotId != null ? list.find((h, i) => hotspotId(h, i) === activeHotspotId) ?? null : null;
  const activeIndex =
    activeHotspotId != null ? list.findIndex((h, i) => hotspotId(h, i) === activeHotspotId) : -1;
  const activeLetter = activeIndex >= 0 ? getHotspotLetter(activeIndex) : "";
  const activePlaced = active != null && isInteractiveDiagramHotspotPlaced(active);
  const activeAnswerText = active ? (active.label?.trim() || "—") : "";
  const activeExplanation = active ? resolveInteractiveDiagramHotspotExplanation(active) : "";

  useEffect(() => {
    setGeneratedQuestion(null);
    setSelectedOption(null);
    setTestMeError(null);
    setLoadingQuestion(false);
  }, [activeHotspotId]);

  const isCorrectSelection =
    selectedOption != null && generatedQuestion
      ? answersMatch(selectedOption, generatedQuestion.correctAnswer)
      : null;

  const resolvedViewMode: InteractiveDiagramViewMode = viewMode ?? "full";
  const isEditorImageOnly = resolvedViewMode === "editorImageOnly";
  const placement = Boolean(onImageClickToPlace);

  const handlePlacementClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onImageClickToPlace) return;
      const t = e.target as HTMLElement;
      if (t.closest("button.interactive-diagram-hotspot")) return;
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = (Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10);
      const y = (Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10);
      onImageClickToPlace(clampPct(x), clampPct(y));
    },
    [onImageClickToPlace]
  );

  const imageEl = showImg ? (
    <img
      className="interactive-diagram-image"
      src={imgResolved}
      alt={blockTitle.trim() || "Diagram with hotspots"}
      onError={hideBrokenLessonImage}
      style={placement ? { pointerEvents: "none" } : undefined}
    />
  ) : null;

  const markerButtons =
    showImg &&
    list.map((h, i) => {
      if (!isInteractiveDiagramHotspotPlaced(h)) return null;
      const hid = hotspotId(h, i);
      const isActive = activeHotspotId === hid;
      const x = clampPct(typeof h.x === "number" ? h.x : Number(h.x));
      const y = clampPct(typeof h.y === "number" ? h.y : Number(h.y));
      const letter = getHotspotLetter(i);
      const aside = teacherLabelAside((h.label ?? "").trim(), letter);
      const a11y = hotspotAccessibilityName(h, i);
      const markerWide = letter.length > 1;
      return (
        <button
          key={hid}
          type="button"
          className={isActive ? "interactive-diagram-hotspot is-active" : "interactive-diagram-hotspot"}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            ...(markerWide ? { minWidth: 34, width: "auto", paddingLeft: 5, paddingRight: 5 } : {}),
          }}
          aria-label={placement ? `Place marker ${letter} on diagram` : `Show information about ${a11y}`}
          aria-pressed={isActive}
          onClick={(e) => {
            e.stopPropagation();
            if (placement) return;
            setActiveHotspotId((prev) => (prev === hid ? null : hid));
          }}
          onKeyDown={(e) => {
            if (placement) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveHotspotId((prev) => (prev === hid ? null : hid));
            }
          }}
        >
          <span className="interactive-diagram-hotspot__letter">{letter}</span>
          {isActive && (aside || (h.description ?? "").trim()) ? (
            <span className="interactive-diagram-hotspot__chip" aria-hidden>
              {aside || (h.description ?? "").trim()}
            </span>
          ) : null}
        </button>
      );
    });

  const mediaBlock = (
    <div className="interactive-diagram__media">
      <div
        className={[
          "interactive-diagram-image-wrap",
          placement ? "interactive-diagram-image-wrap--placement" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {showImg ? (
          <div
            className="interactive-diagram-image-container"
            onClick={placement ? handlePlacementClick : undefined}
            onKeyDown={undefined}
            role="presentation"
            aria-label={placement ? "Click to place a hotspot on the diagram" : undefined}
          >
            {placement ? (
              imageEl
            ) : (
              <LessonImageFrame className="interactive-diagram-lesson-frame" variant="primary" lightboxSrc={imgResolved}>
                {imageEl}
              </LessonImageFrame>
            )}
            {markerButtons}
          </div>
        ) : (
          <div className="interactive-diagram__image-placeholder" role="status">
            Add a diagram image in the editor
          </div>
        )}
      </div>
    </div>
  );

  if (isEditorImageOnly) {
    return <div className="interactive-diagram interactive-diagram--editor-image-only">{mediaBlock}</div>;
  }

  return (
    <div className="interactive-diagram">
      {!hideBlockTitle && blockTitle.trim() ? (
        <h3 className="interactive-diagram__title">{blockTitle}</h3>
      ) : null}
      <LessonRichText text={intro} className="interactive-diagram__intro" />

      <div className="interactive-diagram__layout">
        {mediaBlock}

        <aside
          className="interactive-diagram__panel"
          role="region"
          aria-label="Hotspot explanation"
        >
          {active ? (
            <>
              <AssessmentFeedback
                title={`Structure ${activeLetter}`}
                answer={activeAnswerText}
                answerLabel="Answer"
                explanation={activeExplanation || undefined}
                explanationLabel="Explanation"
                className="interactive-diagram__panel-feedback"
              />
              {activePlaced ? (
                <>
                  <button
                    type="button"
                    className="interactive-diagram__test-me-btn test-me-btn"
                    disabled={loadingQuestion}
                    onClick={async () => {
                      if (!active) return;
                      setTestMeError(null);
                      setSelectedOption(null);
                      setGeneratedQuestion(null);
                      const preset = parseEmbeddedInteractiveDiagramTest(active.test);
                      const fromPreset = preset ? embeddedInteractiveDiagramTestToMcqPayload(preset) : null;
                      if (fromPreset) {
                        setGeneratedQuestion(fromPreset);
                        return;
                      }
                      setLoadingQuestion(true);
                      try {
                        const { mcq, _disabled } = await generateHotspotMcqFromConcept({
                          topic: topicForAi,
                          label: active.label?.trim() || `Structure ${activeLetter}`,
                          description: resolveInteractiveDiagramHotspotExplanation(active),
                          level,
                          subject,
                        });
                        if (_disabled) {
                          setTestMeError("Practice questions are not available right now. Try again later.");
                          return;
                        }
                        setGeneratedQuestion(mcq);
                      } catch {
                        setTestMeError("Could not generate a question. Please try again.");
                      } finally {
                        setLoadingQuestion(false);
                      }
                    }}
                  >
                    {loadingQuestion ? "Generating…" : "Test me on this"}
                  </button>
                  {testMeError ? (
                    <p className="interactive-diagram__test-me-error" role="alert">
                      {testMeError}
                    </p>
                  ) : null}
                  {generatedQuestion ? (
                    <div className="hotspot-question" aria-live="polite">
                      <p className="hotspot-question__text">{generatedQuestion.question}</p>
                      <div className="hotspot-question__options" role="list">
                        {generatedQuestion.options.map((opt, oi) => {
                          const picked = selectedOption != null;
                          const optLetter = getHotspotLetter(oi);
                          return (
                            <button
                              key={`opt-${oi}`}
                              type="button"
                              role="listitem"
                              className="hotspot-question__option"
                              disabled={picked}
                              aria-label={`Option ${optLetter}: ${opt}`}
                              onClick={() => setSelectedOption(opt)}
                            >
                              <span className="hotspot-question__option-letter">{optLetter}</span>
                              <span className="hotspot-question__option-text">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                      {selectedOption != null && generatedQuestion ? (
                        <div
                          className={
                            isCorrectSelection
                              ? "answer-feedback answer-feedback--correct"
                              : "answer-feedback answer-feedback--wrong"
                          }
                        >
                          <p className="answer-feedback__verdict">
                            {isCorrectSelection ? "Correct" : "Incorrect"}
                          </p>
                          <p className="answer-feedback__explanation">{generatedQuestion.explanation}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="interactive-diagram__panel-empty" style={{ marginTop: 8 }}>
                  This label is not placed on the diagram yet.
                </p>
              )}
            </>
          ) : (
            <p className="interactive-diagram__panel-empty">Select a hotspot to learn more.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
