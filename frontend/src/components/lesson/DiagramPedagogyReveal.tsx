import React from "react";
import { LessonMarkdown } from "./LessonMarkdown";
import type { DiagramRevealDisplay } from "../../utils/diagramPedagogyDisplay";
import "./diagramPedagogyReveal.css";

export type DiagramPedagogyRevealProps = {
  reveal: DiagramRevealDisplay;
};

/**
 * Hidden answer block for diagram pedagogy (native <details> — content not visible until expanded).
 */
export function DiagramPedagogyReveal({ reveal }: DiagramPedagogyRevealProps): React.ReactElement {
  const summary =
    reveal.summary.trim() && !/^reveal\s+answer$/i.test(reveal.summary.trim())
      ? reveal.summary.trim()
      : "Reveal answer";

  return (
    <details className="lr-diagram-pedagogy-reveal">
      <summary className="lr-diagram-pedagogy-reveal__summary">{summary}</summary>
      <div className="lr-diagram-pedagogy-reveal__body lesson-rich-text">
        <LessonMarkdown className="lesson-md-body">{reveal.body}</LessonMarkdown>
      </div>
    </details>
  );
}
