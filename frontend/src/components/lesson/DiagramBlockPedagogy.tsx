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
 * Student-facing diagram chrome: title → instructions → figure → optional caption/source.
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
    <div className={["diagram-block-pedagogy", className].filter(Boolean).join(" ")}>
      {titleTrim ? <h3 className="diagram-block-pedagogy__title">{titleTrim}</h3> : null}
      {subtitleTrim ? <p className="diagram-block-pedagogy__subtitle">{subtitleTrim}</p> : null}
      <div className="diagram-block-pedagogy__figure">{children}</div>
      {captionTrim ? <p className="diagram-block-pedagogy__caption">{captionTrim}</p> : null}
    </div>
  );
}
