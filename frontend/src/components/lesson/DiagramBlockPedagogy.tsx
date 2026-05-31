import React from "react";
import { LessonMarkdown } from "./LessonMarkdown";
import { DiagramPedagogyReveal } from "./DiagramPedagogyReveal";
import type { DiagramRevealDisplay } from "../../utils/diagramPedagogyDisplay";
import "./diagramBlockPedagogy.css";

export type DiagramBlockPedagogyProps = {
  title?: string | null;
  subtitle?: string | null;
  caption?: string | null;
  reveal?: DiagramRevealDisplay | null;
  children: React.ReactNode;
  className?: string;
};

/**
 * Student-facing diagram chrome: title → figure → task/instructions → reveal → optional source caption.
 */
export function DiagramBlockPedagogy({
  title,
  subtitle,
  caption,
  reveal,
  children,
  className,
}: DiagramBlockPedagogyProps): React.ReactElement {
  const titleTrim = typeof title === "string" ? title.trim() : "";
  const subtitleTrim = typeof subtitle === "string" ? subtitle.trim() : "";
  const captionTrim = typeof caption === "string" ? caption.trim() : "";

  return (
    <div className={["lr-diagram-pedagogy", className].filter(Boolean).join(" ")}>
      {titleTrim ? <h3 className="lr-diagram-pedagogy__title">{titleTrim}</h3> : null}
      <div className="lr-diagram-pedagogy__media">{children}</div>
      {subtitleTrim ? (
        <div
          className="lr-diagram-pedagogy__subtitle lesson-rich-text"
          data-testid="diagram-task"
          style={{ textAlign: "left" }}
        >
          <LessonMarkdown className="lesson-md-body">{subtitleTrim}</LessonMarkdown>
        </div>
      ) : null}
      {reveal?.body?.trim() ? <DiagramPedagogyReveal reveal={reveal} /> : null}
      {captionTrim ? (
        <div className="lr-diagram-pedagogy__caption lesson-rich-text">
          <LessonMarkdown className="lesson-md-body lesson-md-body--caption">{captionTrim}</LessonMarkdown>
        </div>
      ) : null}
    </div>
  );
}
