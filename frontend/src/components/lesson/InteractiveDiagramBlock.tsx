import React, { useState } from "react";
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
};

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
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
}: InteractiveDiagramBlockProps): React.ReactElement {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const list = Array.isArray(hotspots) ? hotspots : [];
  const imgRaw = (imageUrl ?? "").trim();
  const imgResolved = imgRaw ? resolveImageUrl(imgRaw) : "";
  const showImg = hasRenderableLessonImageSrc(imgRaw) && hasRenderableLessonImageSrc(imgResolved);

  const active =
    activeIndex != null && activeIndex >= 0 && activeIndex < list.length ? list[activeIndex] : null;

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
                const isActive = activeIndex === i;
                const x = clampPct(typeof h.x === "number" ? h.x : Number(h.x));
                const y = clampPct(typeof h.y === "number" ? h.y : Number(h.y));
                const label = (h.label ?? "").trim() || `Hotspot ${i + 1}`;
                return (
                  <button
                    key={h.id || `hs-${i}`}
                    type="button"
                    className={
                      isActive
                        ? "interactive-diagram-hotspot is-active"
                        : "interactive-diagram-hotspot"
                    }
                    style={{ left: `${x}%`, top: `${y}%` }}
                    aria-label={`Show information about ${label}`}
                    aria-pressed={isActive}
                    onClick={() => setActiveIndex((prev) => (prev === i ? null : i))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveIndex((prev) => (prev === i ? null : i));
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
              <div className="interactive-diagram__panel-title">{active.label?.trim() || "—"}</div>
              <p className="interactive-diagram__panel-desc">
                {active.description?.trim() || "—"}
              </p>
            </>
          ) : (
            <p className="interactive-diagram__panel-empty">Select a hotspot to learn more.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
