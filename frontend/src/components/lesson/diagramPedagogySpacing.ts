/**
 * Compact vertical rhythm for diagram pedagogy blocks.
 * Values are mirrored as CSS custom properties on `.lr-diagram-pedagogy` (see diagramBlockPedagogy.css).
 */
export const DIAGRAM_PEDAGOGY_SPACING = {
  titleToMedia: "14px",
  mediaToTask: "16px",
  taskParagraphGap: "8px",
  taskToReveal: "12px",
  captionTop: "8px",
} as const;

/** Max margin chain from SS1 block heading to uploaded diagram image (student view). */
export const UPLOADED_DIAGRAM_BLOCK_HEADING_TO_IMAGE_MAX_PX = 20;

export type DiagramPedagogySpacing = typeof DIAGRAM_PEDAGOGY_SPACING;
