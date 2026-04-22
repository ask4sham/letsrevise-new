import React from "react";
import type { Components } from "react-markdown";
import type { StudentLessonPageBlock } from "./types";
import {
  StudentExamTipBlock,
  StudentExplanationBlock,
  StudentHookBlock,
  StudentKeyIdeaBlock,
  StudentKeyWordsBlock,
  StudentMisconceptionBlock,
  StudentSynthesisBlock,
  StudentWorkedExampleBlock,
} from "./studentLessonBlocks";
import type { ContentKeywordItem } from "./contentKeywordHighlight";

export type LessonStudentBlockRendererProps = {
  block: StudentLessonPageBlock;
  blockIndex: number;
  markdownComponents: Partial<Components>;
  stripVideoMarkdown: (content: string) => string;
  maybeParseKeywordsFromText: (text: string) => string[] | null;
  renderDiagramBlock: (block: StudentLessonPageBlock, idx: number) => React.ReactNode;
  /** V12: first `![](url)` line in text/keyIdea → SS2 side-by-side layout */
  enableMarkdownMediaSplit?: boolean;
  /** Lesson/page metadata — render-time highlights only (not applied to pageQuiz) */
  highlightKeywords?: ContentKeywordItem[];
};

/**
 * Maps persisted lesson block types to premium student-facing shells. Unknown types fall back to explanation.
 */
export function LessonStudentBlockRenderer({
  block,
  blockIndex,
  markdownComponents,
  stripVideoMarkdown,
  maybeParseKeywordsFromText,
  renderDiagramBlock,
  enableMarkdownMediaSplit,
  highlightKeywords,
}: LessonStudentBlockRendererProps): React.ReactElement | null {
  const kind = String(block.type || "").trim() || "text";
  const raw = typeof block.content === "string" ? block.content : "";
  const cleanedText = stripVideoMarkdown(raw);

  if (kind === "checkpoint") {
    return null;
  }

  if (kind === "diagram") {
    return (
      <div className="lesson-student-diagram-slot">{renderDiagramBlock(block, blockIndex)}</div>
    );
  }

  const safeHighlightKeywords = kind === "pageQuiz" ? undefined : highlightKeywords;
  const mdProps = { content: raw, markdownComponents, enableMarkdownMediaSplit, highlightKeywords: safeHighlightKeywords };

  if (kind === "keyIdea") {
    return <StudentKeyIdeaBlock {...mdProps} />;
  }
  if (kind === "examTip") {
    return <StudentExamTipBlock {...mdProps} />;
  }
  if (kind === "commonMistake") {
    return <StudentMisconceptionBlock {...mdProps} />;
  }
  if (kind === "stretch") {
    return <StudentSynthesisBlock {...mdProps} />;
  }

  if (kind === "hook") {
    return <StudentHookBlock {...mdProps} />;
  }
  if (kind === "workedExample") {
    return <StudentWorkedExampleBlock {...mdProps} />;
  }

  if (kind === "keyWords") {
    const keywords = maybeParseKeywordsFromText(cleanedText);
    if (keywords && keywords.length > 0) {
      return <StudentKeyWordsBlock content={raw} markdownComponents={markdownComponents} keywords={keywords} />;
    }
    return <StudentExplanationBlock {...mdProps} />;
  }

  if (kind === "text") {
    const keywords = maybeParseKeywordsFromText(cleanedText);
    if (keywords && keywords.length > 0) {
      return <StudentKeyWordsBlock content={raw} markdownComponents={markdownComponents} keywords={keywords} />;
    }
    return <StudentExplanationBlock {...mdProps} />;
  }

  return <StudentExplanationBlock {...mdProps} />;
}
