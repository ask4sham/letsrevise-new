import React from "react";
import "./lessonDiagramFrame.css";

export type LessonDiagramFrameVariant = "standard" | "featured";

export type LessonDiagramFrameProps = {
  /** Default: standard — calm border + shadow. Featured: slightly stronger, for key visuals only. */
  variant?: LessonDiagramFrameVariant;
  /** Renders below the body with caption styling (after interactive content inside body). */
  caption?: string | null;
  children: React.ReactNode;
  className?: string;
};

/**
 * LetsRevise diagram shell: light branded frame with a small top strip.
 * Catalogue/vector diagrams: use LessonImageFrame in the body — inner card chrome is flattened via CSS.
 * Uploaded raster (`diagram.imageUrl`) does not use this component — see `lessonUploadedDiagram.css`.
 */
export function LessonDiagramFrame({
  variant = "standard",
  caption,
  children,
  className,
}: LessonDiagramFrameProps): React.ReactElement {
  const mod =
    variant === "featured" ? "lesson-diagram-frame--featured" : "lesson-diagram-frame--standard";
  const cap = typeof caption === "string" ? caption.trim() : "";

  return (
    <div
      className={["lesson-diagram-frame", mod, className].filter(Boolean).join(" ")}
      data-lesson-diagram-frame=""
    >
      <div className="lesson-diagram-frame__strip" aria-hidden />
      <div className="lesson-diagram-frame__body">{children}</div>
      {cap ? <p className="lesson-diagram-frame__caption">{cap}</p> : null}
    </div>
  );
}
