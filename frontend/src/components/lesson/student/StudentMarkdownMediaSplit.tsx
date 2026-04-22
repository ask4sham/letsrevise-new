import React from "react";
import type { Components } from "react-markdown";
import { LessonImageFrame, hideBrokenLessonImage } from "../LessonImageFrame";
import { hasRenderableLessonImageSrc } from "../../../constants/lessonImageDisplay";
import { makeAbsoluteAssetUrl } from "../../../utils/assetUrl";
import { LessonStudentMarkdown } from "./LessonStudentMarkdown";
import { partitionMarkdownAtFirstBlockImage } from "./partitionMarkdownAtFirstBlockImage";
import { stripStandaloneImageLinesFromMarkdown } from "./stripStandaloneImageLines";
import type { ContentKeywordItem } from "./contentKeywordHighlight";

type Props = {
  content: string;
  markdownComponents: Partial<Components>;
  /** e.g. "lesson-content student-block student-block--text" */
  wrapperClassName: string;
  highlightKeywords?: ContentKeywordItem[];
};

/**
 * V12: first standalone `![](url)` line in markdown → text left, image right (desktop).
 * Falls back to plain markdown if no split or invalid image URL.
 */
export function StudentMarkdownMediaSplit({
  content,
  markdownComponents,
  wrapperClassName,
  highlightKeywords,
}: Props): React.ReactElement {
  const split = partitionMarkdownAtFirstBlockImage(content);
  const rawSrc = split?.src?.trim() ?? "";
  if (!split || !hasRenderableLessonImageSrc(rawSrc)) {
    return (
      <div className={wrapperClassName}>
        <LessonStudentMarkdown components={markdownComponents} highlightKeywords={highlightKeywords}>
          {content}
        </LessonStudentMarkdown>
      </div>
    );
  }

  const lightboxSrc = makeAbsoluteAssetUrl(rawSrc) ?? rawSrc;
  /* Design system: one block = one image; tail is text-only (no extra standalone figure lines). */
  const tailTextOnly = stripStandaloneImageLinesFromMarkdown(split.tailMarkdown);

  return (
    <div
      className={`${wrapperClassName} lesson-student-md-media-split`}
      data-ss2-inline-split="1"
    >
      <section
        className="lesson-student-md-media-split__grid"
        data-ss2-layout="split"
        aria-label="Lesson content"
      >
        <div className="lesson-student-md-media-split__text">
          <LessonStudentMarkdown components={markdownComponents} highlightKeywords={highlightKeywords}>
            {split.leftMarkdown}
          </LessonStudentMarkdown>
        </div>
        <aside className="lesson-student-md-media-split__media" aria-label="Figure">
          <LessonImageFrame variant="primary" lightboxSrc={lightboxSrc}>
            <img
              src={lightboxSrc}
              alt={split.alt || "Illustration"}
              onError={hideBrokenLessonImage}
            />
          </LessonImageFrame>
        </aside>
      </section>
      {tailTextOnly.trim() ? (
        <div className="lesson-student-md-media-split__tail">
          <LessonStudentMarkdown components={markdownComponents} highlightKeywords={highlightKeywords}>
            {tailTextOnly}
          </LessonStudentMarkdown>
        </div>
      ) : null}
    </div>
  );
}
