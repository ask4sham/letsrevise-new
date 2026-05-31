import React from "react";
import { DiagramBlockPedagogy } from "./DiagramBlockPedagogy";
import { diagramPedagogyDisplayFromBlock } from "../../utils/diagramPedagogyDisplay";

export type LessonDiagramBlockDisplayProps = {
  block: {
    title?: string | null;
    caption?: string | null;
    subtitle?: string | null;
    intro?: string | null;
    note?: string | null;
    content?: string | null;
  };
  /** When false, caption is rendered only by the inner figure (e.g. catalogue DiagramBlockContent). */
  showPedagogyCaption?: boolean;
  /** SS1 block heading already shown — omit pedagogy h3 above the figure. */
  suppressPedagogyTitle?: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Shared diagram shell: title + cleaned instructions + figure (+ optional caption + hidden reveal).
 */
export function LessonDiagramBlockDisplay({
  block,
  showPedagogyCaption = true,
  suppressPedagogyTitle = false,
  children,
  className,
}: LessonDiagramBlockDisplayProps): React.ReactElement {
  const display = diagramPedagogyDisplayFromBlock(block);
  const caption = showPedagogyCaption ? display.caption : undefined;

  const visibleInstructions = display.visibleInstructions ?? display.instructions;
  const hiddenAnswer = display.hiddenAnswer ?? display.reveal;
  const pedagogyTitle = suppressPedagogyTitle ? undefined : display.title;
  const hasChrome = Boolean(pedagogyTitle || visibleInstructions || caption || hiddenAnswer);
  if (!hasChrome) {
    return <>{children}</>;
  }

  return (
    <DiagramBlockPedagogy
      className={className}
      title={pedagogyTitle}
      subtitle={visibleInstructions}
      caption={caption}
      reveal={hiddenAnswer}
    >
      {children}
    </DiagramBlockPedagogy>
  );
}
