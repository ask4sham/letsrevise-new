import React from "react";

import { DiagramBlockPedagogy } from "./DiagramBlockPedagogy";

import { diagramPedagogyRenderFromBlock } from "../../utils/diagramPedagogyDisplay";

export type LessonDiagramBlockDisplayProps = {
  block: {
    title?: string | null;
    caption?: string | null;
    subtitle?: string | null;
    studentTask?: string | null;
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
  const { title, instructions, studentTask, caption, reveal } = diagramPedagogyRenderFromBlock(
    block,
    { suppressTitle: suppressPedagogyTitle }
  );
  const pedagogyCaption = showPedagogyCaption ? caption : undefined;

  const hasChrome = Boolean(
    title || instructions || studentTask || pedagogyCaption || reveal
  );

  if (!hasChrome) {
    return <>{children}</>;
  }

  return (
    <DiagramBlockPedagogy
      className={className}
      title={title}
      instructions={instructions}
      studentTask={studentTask}
      caption={pedagogyCaption}
      reveal={reveal}
    >
      {children}
    </DiagramBlockPedagogy>
  );
}
