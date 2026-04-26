import React from "react";
import type { Components } from "react-markdown";
import type {
  InteractiveDiagramHotspotPersisted,
  InteractiveSequenceStepPersisted,
  StudentLessonPageBlock,
} from "./types";
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
import { InlineSelfCheckBlock } from "../InlineSelfCheckBlock";
import { InteractiveSequenceBlock, type InteractiveSequenceStep } from "../InteractiveSequenceBlock";
import { InteractiveDiagramBlock, type InteractiveDiagramHotspot } from "../InteractiveDiagramBlock";
import { makeAbsoluteAssetUrl } from "../../../utils/assetUrl";

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

  if (kind === "selfCheck") {
    return (
      <InlineSelfCheckBlock
        prompt={String(block.prompt ?? "")}
        questionType={block.questionType === "short" ? "short" : "mcq"}
        options={Array.isArray(block.options) ? block.options : []}
        correctAnswer={String(block.correctAnswer ?? "")}
        explanation={block.explanation != null ? String(block.explanation) : undefined}
        presentation={enableMarkdownMediaSplit ? "v12" : "default"}
      />
    );
  }

  if (kind === "interactiveSequence") {
    const raw = (block as StudentLessonPageBlock).sequenceSteps ?? (block as { steps?: InteractiveSequenceStepPersisted[] }).steps;
    const arr = Array.isArray(raw) ? raw : [];
    const steps: InteractiveSequenceStep[] = arr.map((s) => ({
      title: String(s?.title ?? ""),
      description: String(s?.description ?? ""),
      imageUrl: String(s?.imageUrl ?? ""),
      caption: String(s?.caption ?? ""),
    }));
    return (
      <InteractiveSequenceBlock
        blockTitle={String(block.title ?? "")}
        intro={String(block.intro ?? "")}
        steps={steps}
        resolveImageUrl={(url) => makeAbsoluteAssetUrl(url) ?? url}
      />
    );
  }

  if (kind === "interactiveDiagram") {
    const raw = (block as StudentLessonPageBlock).hotspots;
    const arr = Array.isArray(raw) ? raw : [];
    const hotspots: InteractiveDiagramHotspot[] = arr.map((h: InteractiveDiagramHotspotPersisted) => ({
      id: String(h?.id ?? ""),
      x: typeof h?.x === "number" ? h.x : Number(h?.x) || 0,
      y: typeof h?.y === "number" ? h.y : Number(h?.y) || 0,
      label: String(h?.label ?? ""),
      description: String(h?.description ?? ""),
    }));
    return (
      <InteractiveDiagramBlock
        blockTitle={String(block.title ?? "")}
        intro={String(block.intro ?? "")}
        imageUrl={String((block as StudentLessonPageBlock).imageUrl ?? "")}
        hotspots={hotspots}
        resolveImageUrl={(url) => makeAbsoluteAssetUrl(url) ?? url}
      />
    );
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

  // Comma-separated "key words" list callout: only when we are NOT also showing page/lesson
  // glossary key terms. StudentKeyWordsBlock does not run LessonStudentMarkdown, so it would
  // show bold/list only with zero KeywordMark (no red "i") — a common cause of "Add key term
  // does nothing" on short text blocks.
  if (kind === "keyWords") {
    const keywords = maybeParseKeywordsFromText(cleanedText);
    if (
      keywords &&
      keywords.length > 0 &&
      (!Array.isArray(safeHighlightKeywords) || safeHighlightKeywords.length === 0)
    ) {
      return <StudentKeyWordsBlock content={raw} markdownComponents={markdownComponents} keywords={keywords} />;
    }
    return <StudentExplanationBlock {...mdProps} />;
  }

  if (kind === "text") {
    const keywords = maybeParseKeywordsFromText(cleanedText);
    if (
      keywords &&
      keywords.length > 0 &&
      (!Array.isArray(safeHighlightKeywords) || safeHighlightKeywords.length === 0)
    ) {
      return <StudentKeyWordsBlock content={raw} markdownComponents={markdownComponents} keywords={keywords} />;
    }
    return <StudentExplanationBlock {...mdProps} />;
  }

  return <StudentExplanationBlock {...mdProps} />;
}
