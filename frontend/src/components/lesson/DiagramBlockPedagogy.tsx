import React from "react";
import "./diagramBlockPedagogy.css";

export type DiagramBlockPedagogyProps = {
  title?: string | null;
  subtitle?: string | null;
  caption?: string | null;
  children: React.ReactNode;
  className?: string;
};

/**
 * Student-facing diagram chrome: title ÔåÆ instructions ÔåÆ figure ÔåÆ optional caption/source.
 */
export function DiagramBlockPedagogy({
  title,
  subtitle,
  caption,
  children,
  className,
}: DiagramBlockPedagogyProps): React.ReactElement {
  const titleTrim = typeof title === "string" ? title.trim() : "";
  const subtitleTrim = typeof subtitle === "string" ? subtitle.trim() : "";
  const captionTrim = typeof caption === "string" ? caption.trim() : "";

  return (
    <div className={["lr-diagram-pedagogy", className].filter(Boolean).join(" ")}>
      {titleTrim ? <h3 className="lr-diagram-pedagogy__title">{titleTrim}</h3> : null}
      {subtitleTrim ? <p className="lr-diagram-pedagogy__subtitle">{subtitleTrim}</p> : null}
      <div className="lr-diagram-pedagogy__media">{children}</div>
      {captionTrim ? <p className="lr-diagram-pedagogy__caption">{captionTrim}</p> : null}
    </div>
  );
}
