import React, { useEffect, useState } from "react";
import { generateHotspotMcqFromConcept, type HotspotMcqPayload } from "../../api/ai";
import { hasRenderableLessonImageSrc } from "../../constants/lessonImageDisplay";
import { hideBrokenLessonImage, LessonImageFrame } from "./LessonImageFrame";
import "./interactiveDiagramBlock.css";

export type InteractiveDiagramHotspot = {
  id: string;
  x: number;
  y: number;
  label: string;
  description: string;
};

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

  return (
    <div className="interactive-diagram">
      {blockTitle.trim() ? <h3 className="interactive-diagram__title">{blockTitle}</h3> : null}
      {intro.trim() ? <p className="interactive-diagram__intro">{intro}</p> : null}

      <div className="interactive-diagram__layout">
        <div className="interactive-diagram__media">
          <div className="interactive-diagram-image-wrap">
            {showImg ? (
              <LessonImageFrame variant="primary" lightboxSrc={imgResolved}>
                <img
                  className="interactive-diagram-image"
                  src={imgResolved}
                  alt={blockTitle.trim() || "Diagram with hotspots"}
                  onError={hideBrokenLessonImage}
                />
              </LessonImageFrame>
            ) : (
              <div className="interactive-diagram__image-placeholder" role="status">
                Add a diagram image in the editor
              </div>
            )}
            {showImg &&
              list.map((h, i) => {
                const hid = hotspotId(h, i);
                const isActive = activeHotspotId === hid;
                const x = clampPct(typeof h.x === "number" ? h.x : Number(h.x));
                const y = clampPct(typeof h.y === "number" ? h.y : Number(h.y));
                const label = (h.label ?? "").trim() || `Hotspot ${i + 1}`;
                return (
                  <button
                    key={hid}
                    type="button"
                    className={
                      isActive
                        ? "interactive-diagram-hotspot is-active"
                        : "interactive-diagram-hotspot"
                    }
                    style={{ left: `${x}%`, top: `${y}%` }}
                    aria-label={`Show information about ${label}`}
                    aria-pressed={isActive}
                    onClick={() => setActiveHotspotId((prev) => (prev === hid ? null : hid))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveHotspotId((prev) => (prev === hid ? null : hid));
                      }
                    }}
                  >
                    <span className="interactive-diagram-hotspot__num">{i + 1}</span>
                  </button>
                );
              })}
          </div>
        </div>

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
            <p className="interactive-diagram__panel-empty">Select a hotspot to learn more.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
