import React from "react";
import { LessonMarkdown } from "./LessonMarkdown";
import { lessonFieldLooksLikeHtml } from "../../utils/lessonRichText";

export type LessonRichTextProps = {
  text: string;
  className?: string;
  /** Wrapper class when rendering HTML via LessonMarkdown */
  markdownClassName?: string;
};

/**
 * Renders lesson intro/instruction fields: HTML via sanitized markdown pipeline,
 * plain text as a paragraph (avoids showing raw &lt;p&gt; tags from generator import).
 */
export function LessonRichText({
  text,
  className,
  markdownClassName = "lesson-md-body",
}: LessonRichTextProps): React.ReactElement | null {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return null;

  if (lessonFieldLooksLikeHtml(trimmed)) {
    return (
      <div className={className ? `lesson-rich-text ${className}` : "lesson-rich-text"}>
        <LessonMarkdown className={markdownClassName}>{trimmed}</LessonMarkdown>
      </div>
    );
  }

  return <p className={className}>{trimmed}</p>;
}
