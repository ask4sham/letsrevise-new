import React, { useCallback, useEffect, useState } from "react";
import { generateHotspotMcqFromConcept, type HotspotMcqPayload } from "../../api/ai";
import { hasRenderableLessonImageSrc } from "../../constants/lessonImageDisplay";
import { hideBrokenLessonImage, LessonImageFrame } from "./LessonImageFrame";
import { isInteractiveDiagramHotspotPlaced } from "../../utils/interactiveDiagramHotspots";
import "./interactiveDiagramBlock.css";

export type InteractiveDiagramHotspot = {
  id: string;
  /** Omitted or invalid until the teacher places the marker on the image (editor). */
  x?: number | null;
  y?: number | null;
  label: string;
  description: string;
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
  const activePlaced = active != null && isInteractiveDiagramHotspotPlaced(active);

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
      const label = (h.label ?? "").trim() || `Hotspot ${i + 1}`;
      return (
        <button
          key={hid}
          type="button"
          className={isActive ? "interactive-diagram-hotspot is-active" : "interactive-diagram-hotspot"}
          style={{ left: `${x}%`, top: `${y}%` }}
          aria-label={placement ? `Hotspot: ${label}` : `Show information about ${label}`}
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
          <span className="interactive-diagram-hotspot__num">{i + 1}</span>
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
      {blockTitle.trim() ? <h3 className="interactive-diagram__title">{blockTitle}</h3> : null}
      {intro.trim() ? <p className="interactive-diagram__intro">{intro}</p> : null}

      <div className="interactive-diagram__layout">
        {mediaBlock}

        <aside
          className="interactive-diagram__panel"
          role="region"
          aria-label="Hotspot explanation"
        >
          {active ? (
            <>
              <div className="interactive-diagram__panel-title interactive-diagram__panel-title--active">
                {active.label?.trim() || "—"}
              </div>
              <p className="interactive-diagram__panel-desc">
                {active.description?.trim() || "—"}
              </p>
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
                      setLoadingQuestion(true);
                      try {
                        const { mcq, _disabled } = await generateHotspotMcqFromConcept({
                          topic: topicForAi,
                          label: active.label?.trim() || "Concept",
                          description: active.description?.trim() || "",
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
                          return (
                            <button
                              key={`opt-${oi}`}
                              type="button"
                              role="listitem"
                              className="hotspot-question__option"
                              disabled={picked}
                              onClick={() => setSelectedOption(opt)}
                            >
                              {opt}
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
