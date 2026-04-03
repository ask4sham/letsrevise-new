import React, { useMemo } from "react";
import type { Components } from "react-markdown";
import { LessonMarkdown } from "../LessonMarkdown";
import { lessonMarkdownUrlTransform } from "../lessonMarkdownViewComponents";
import { preprocessMarkdownAssetUrls } from "../../../utils/assetUrl";
import { stripStudentStructuralLabels } from "./stripStudentStructuralLabels";

type Props = {
  children: string;
  components: Partial<Components>;
  className?: string;
  /** Strip leading "Explanation" / "Key points" scaffold lines (student view) */
  stripStructuralLabels?: boolean;
};

/**
 * Student-facing markdown: same pipeline as lesson view (lightbox, sanitization, URL transforms).
 */
export function LessonStudentMarkdown({
  children,
  components,
  className = "lesson-md-body lesson-student-md",
  stripStructuralLabels = true,
}: Props) {
  const processed = useMemo(() => {
    let raw = children ?? "";
    if (stripStructuralLabels) raw = stripStudentStructuralLabels(raw);
    return preprocessMarkdownAssetUrls(raw);
  }, [children, stripStructuralLabels]);

  return (
    <LessonMarkdown className={className} components={components} urlTransform={lessonMarkdownUrlTransform}>
      {processed}
    </LessonMarkdown>
  );
}
