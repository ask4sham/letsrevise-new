import React from "react";
import "./lessonDiagramFrame.css";
import { DiagramBlockPedagogy } from "./DiagramBlockPedagogy";

export type LessonDiagramFrameVariant = "standard" | "featured";

export type LessonDiagramFrameProps = {
  /** Default: standard — calm border + shadow. Featured: slightly stronger, for key visuals only. */
  variant?: LessonDiagramFrameVariant;
  /** Optional student-facing title (above image). */
  title?: string | null;
  /** Optional instructions / subtitle (above image). */
  subtitle?: string | null;
  /** Small caption or source note (below image). Legacy: sole label when title/subtitle empty. */
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
  title,
  subtitle,
  caption,
  children,
  className,
}: LessonDiagramFrameProps): React.ReactElement {
  const mod =
    variant === "featured" ? "lesson-diagram-frame--featured" : "lesson-diagram-frame--standard";

  return (
    <div
      className={["lesson-diagram-frame", mod, className].filter(Boolean).join(" ")}
      data-lesson-diagram-frame=""
    >
      <div className="lesson-diagram-frame__strip" aria-hidden />
      <div className="lesson-diagram-frame__body">
        <DiagramBlockPedagogy title={title} subtitle={subtitle} caption={caption}>
          {children}
        </DiagramBlockPedagogy>
      </div>
    </div>
  );
}
