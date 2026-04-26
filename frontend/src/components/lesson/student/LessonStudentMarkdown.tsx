import React, { useMemo } from "react";
import type { Components } from "react-markdown";
import { LessonMarkdown } from "../LessonMarkdown";
import { lessonMarkdownUrlTransform } from "../lessonMarkdownViewComponents";
import { preprocessMarkdownAssetUrls } from "../../../utils/assetUrl";
import { stripStudentStructuralLabels } from "./stripStudentStructuralLabels";
import {
  mergeLessonMarkdownComponentsWithKeywordHighlight,
  type ContentKeywordItem,
} from "./contentKeywordHighlight";

type Props = {
  children: string;
  components: Partial<Components>;
  className?: string;
  /** Strip leading "Explanation" / "Key points" scaffold lines (student view) */
  stripStructuralLabels?: boolean;
  /** Lesson/page metadata — render-time highlights only */
  highlightKeywords?: ContentKeywordItem[];
};

/**
 * Student-facing markdown: same pipeline as lesson view (lightbox, sanitization, URL transforms).
 */
export function LessonStudentMarkdown({
  children,
  components,
  className = "lesson-md-body lesson-student-md",
  stripStructuralLabels = true,
  highlightKeywords,
}: Props) {
  const processed = useMemo(() => {
    let raw = children ?? "";
    if (stripStructuralLabels) raw = stripStudentStructuralLabels(raw);
    return preprocessMarkdownAssetUrls(raw);
  }, [children, stripStructuralLabels]);

  const mergedComponents = useMemo(
    () =>
      mergeLessonMarkdownComponentsWithKeywordHighlight(components, highlightKeywords, {
        autoTextKeywordHighlights: false,
      }),
    [components, highlightKeywords]
  );

  return (
    <LessonMarkdown className={className} components={mergedComponents} urlTransform={lessonMarkdownUrlTransform}>
      {processed}
    </LessonMarkdown>
  );
}
