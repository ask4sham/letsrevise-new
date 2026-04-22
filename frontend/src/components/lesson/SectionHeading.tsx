import React from "react";
import "./lessonRenderer.css";

type Props = {
  children: string;
};

/**
 * Styled section title for lines like **📘 1. Lesson Objectives** (parsed text, no ** in children).
 */
export function SectionHeading({ children }: Props): React.ReactElement {
  const t = (children || "").trim();
  return (
    <h3 className="lesson-renderer-section-heading" data-lesson-section-heading="1">
      {t}
    </h3>
  );
}
