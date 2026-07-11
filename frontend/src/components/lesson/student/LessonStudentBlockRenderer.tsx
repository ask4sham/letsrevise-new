import React from "react";
import type { Components } from "react-markdown";
import type {
  InteractiveDiagramHotspotPersisted,
  InteractiveSequenceStepPersisted,
  StudentLessonPageBlock,
} from "./types";
import {
  StudentExamTechniqueBlock,
  StudentExamTipBlock,
  StudentExplanationBlock,
  StudentSynopticLinkBlock,
  StudentWhyThisMattersBlock,
  StudentHookBlock,
  StudentKeyIdeaBlock,
  StudentKeyWordsBlock,
  StudentMisconceptionBlock,
  StudentSynthesisBlock,
  StudentWorkedExampleBlock,
} from "./studentLessonBlocks";
import type { ContentKeywordItem } from "./contentKeywordHighlight";
import { InlineSelfCheckBlock } from "../InlineSelfCheckBlock";
import { LessonCheckpoint } from "../LessonCheckpoint";
import { InteractiveSequenceBlock, type InteractiveSequenceStep } from "../InteractiveSequenceBlock";
import { InteractiveDiagramBlock, type InteractiveDiagramHotspot } from "../InteractiveDiagramBlock";
import { DragDropMatchBlock } from "../DragDropMatchBlock";
import { GraphBlock } from "../GraphBlock";
import { ExamQuestionBlock } from "../ExamQuestionBlock";
import { isCompositeQuestion } from "../examComposite/compositeUtils";
import type { ExamQuestion } from "../../../api/examQuestions";
import { makeAbsoluteAssetUrl } from "../../../utils/assetUrl";
import { hasRenderableLessonImageSrc } from "../../../constants/lessonImageDisplay";
import {
  isStudentVisibleDiagramBlock,
  isStudentVisibleInteractiveDiagramBlock,
  isStudentVisibleInteractiveSequenceBlock,
} from "../../../utils/lessonBlockStudentVisibility";
import { mergeCheckpointExplanationParts } from "../../../utils/checkpointFeedback";
import { normalizeBlockType, resolveLessonDisplayBlockType } from "../../../types/lessonBlocks";
import { normalizeGraphBlockForDisplay } from "../graphBlockTypes";
import { applyPhotosynthesisHotspotDefaults } from "../../../utils/photosynthesisHotspotLayout";
import { normalizePedagogicalRole } from "../../../utils/pedagogicalRoles";
import {
  coerceDiagramZonePct,
  dragDropMatchModeFromBlockForProps,
  mapDragDropPairForBlockRender,
} from "../../../utils/dragDropMatchDiagram";
import { getVisualTeachingDataAttribute } from "./visualTeachingBlocks";
import { StudentBlockHeading } from "./StudentBlockHeading";
import { UploadedDiagramActivityShell } from "./UploadedDiagramActivityShell";
import {
  fallbackActivityTitleFromBlockType,
  formatStudentBlockHeading,
  inferStudentFrameKind,
  isOuterStudentHeadingVisible,
  shouldSuppressInnerBlockTitle,
  stripSs1PrefixFromTitle,
  studentContentStartsWithHeading,
} from "../../../utils/formatBlockHeading";
import { studentCheckpointFromBlock } from "../../../utils/studentCheckpointFromBlock";

export type LessonStudentBlockRendererProps = {
  block: StudentLessonPageBlock;
  blockIndex: number;
  markdownComponents: Partial<Components>;
  stripVideoMarkdown: (content: string) => string;
  maybeParseKeywordsFromText: (text: string) => string[] | null;
  renderDiagramBlock: (
    block: StudentLessonPageBlock,
    idx: number,
    options?: { suppressPedagogyTitle?: boolean }
  ) => React.ReactNode;
  /** V12: first `![](url)` line in text/keyIdea → SS2 side-by-side layout */
  enableMarkdownMediaSplit?: boolean;
  /** Lesson/page metadata — render-time highlights only (not applied to pageQuiz) */
  highlightKeywords?: ContentKeywordItem[];
  /** Lesson context for inline AI (e.g. interactive diagram “Test me”) */
  lessonTitleForAi?: string;
  levelForAi?: string;
  subjectForAi?: string;
  lessonId?: string;
  pageId?: string;
  checkpointEntitled?: boolean;
  studentPresentation?: "default" | "v12";
  embeddedExamQuestionsById?: Record<string, ExamQuestion>;
  embeddedExamQuestionsLoading?: boolean;
  classroomMode?: boolean;
};

function withStudentBlockHeading(
  node: React.ReactElement,
  block: StudentLessonPageBlock,
  contentForDedup: string
): React.ReactElement {
  const heading = formatStudentBlockHeading(block);
  const frameKind = inferStudentFrameKind(
    heading || String(block.title ?? ""),
    String(block.type ?? "")
  );
  if (!heading || studentContentStartsWithHeading(contentForDedup, heading)) {
    // Still expose frame kind for CSS when heading is omitted / embedded in content.
    return (
      <div className="lesson-student-block-shell" data-frame-kind={frameKind}>
        {node}
      </div>
    );
  }
  return (
    <div className="lesson-student-block-shell" data-frame-kind={frameKind} data-ss1-outer-heading="1">
      <StudentBlockHeading frameKind={frameKind}>{heading}</StudentBlockHeading>
      {node}
    </div>
  );
}

/** Label-only title for inner activity chrome (outer SS1 heading owns the number). */
function studentInnerTitleLabel(block: StudentLessonPageBlock): string {
  const fromTitle = stripSs1PrefixFromTitle(String(block.title ?? ""));
  if (fromTitle) return fromTitle;
  return fallbackActivityTitleFromBlockType(String(block.type ?? "")) || "";
}

function studentBlockTitle(block: StudentLessonPageBlock): string {
  return studentInnerTitleLabel(block) || formatStudentBlockHeading(block) || "";
}

function suppressInnerActivityTitle(
  block: StudentLessonPageBlock,
  contentForDedup = "",
  innerTitleOverride?: string
): boolean {
  const outer = formatStudentBlockHeading(block);
  if (!isOuterStudentHeadingVisible(block, contentForDedup)) return false;
  const inner = String(innerTitleOverride ?? (studentInnerTitleLabel(block) || outer)).trim();
  return shouldSuppressInnerBlockTitle(outer, inner, true);
}

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
  lessonTitleForAi,
  levelForAi,
  subjectForAi,
  lessonId,
  pageId,
  checkpointEntitled = false,
  studentPresentation = "default",
  embeddedExamQuestionsById = {},
  embeddedExamQuestionsLoading = false,
  classroomMode = false,
}: LessonStudentBlockRendererProps): React.ReactElement | null {
  /** Interactive + diagram routing (handles mis-tagged drag-drop). */
  const routed = resolveLessonDisplayBlockType(block as { type?: unknown; pairs?: unknown });
  /** Raw persisted `type` for legacy shells (keyIdea, examTip, hook, …). */
  const kind = String(block.type ?? "").trim() || "text";
  const semanticRole = normalizePedagogicalRole((block as { role?: unknown }).role);
  const raw = typeof block.content === "string" ? block.content : "";
  const cleanedText = stripVideoMarkdown(raw);

  if (routed === "checkpoint") {
    const data = studentCheckpointFromBlock(block, String(blockIndex));
    if (!data) return null;
    const cp = (
      <div
        className={
          studentPresentation === "v12" ? "lesson-student-checkpoint-section" : undefined
        }
      >
        <LessonCheckpoint
          mode={data.mode}
          prompt={data.prompt}
          options={data.options}
          correctAnswer={data.correctAnswer}
          explanation={data.explanation}
          markScheme={data.markScheme}
          name={data.name}
          lessonId={lessonId}
          pageId={pageId}
          entitled={checkpointEntitled}
          presentation={studentPresentation}
        />
      </div>
    );
    return withStudentBlockHeading(cp, block, "");
  }

  const proseKinds = new Set([
    "text",
    "keyIdea",
    "keyWords",
    "examTip",
    "commonMistake",
    "stretch",
    "hook",
    "workedExample",
  ]);
  if (
    proseKinds.has(kind) &&
    routed === kind &&
    !cleanedText.trim() &&
    !formatStudentBlockHeading(block)
  ) {
    return null;
  }

  if (routed === "selfCheck") {
    const rawMs = (block as { markScheme?: string | string[] }).markScheme;
    const scMs = Array.isArray(rawMs) ? rawMs : undefined;
    const sc = (
      <InlineSelfCheckBlock
        prompt={String(block.prompt ?? "")}
        questionType={block.questionType === "short" ? "short" : "mcq"}
        options={Array.isArray(block.options) ? block.options : []}
        correctAnswer={String(block.correctAnswer ?? "")}
        markScheme={scMs}
        explanation={
          mergeCheckpointExplanationParts({
            explanation: block.explanation != null ? String(block.explanation) : undefined,
            markScheme: scMs,
          })
        }
        contentFallback={typeof block.content === "string" ? block.content : ""}
        presentation={enableMarkdownMediaSplit ? "v12" : "default"}
        hideHeadingLabel={suppressInnerActivityTitle(block, cleanedText, "Self-check")}
      />
    );
    return withStudentBlockHeading(sc, block, cleanedText);
  }

  if (routed === "interactiveSequence") {
    if (!isStudentVisibleInteractiveSequenceBlock(block as StudentLessonPageBlock)) {
      return null;
    }
    const raw = (block as StudentLessonPageBlock).sequenceSteps ?? (block as { steps?: InteractiveSequenceStepPersisted[] }).steps;
    const arr = Array.isArray(raw) ? raw : [];
    const steps: InteractiveSequenceStep[] = arr.map((s: InteractiveSequenceStepPersisted) => {
      const sid = typeof s.id === "string" ? String(s.id).trim() : "";
      const tq = s.testQuestion != null ? String(s.testQuestion).trim() : "";
      const te = s.testExplanation != null ? String(s.testExplanation).trim() : "";
      return {
        ...(sid ? { id: sid.slice(0, 64) } : {}),
        title: String(s?.title ?? ""),
        description: String(s?.description ?? ""),
        imageUrl: String(s?.imageUrl ?? ""),
        caption: String(s?.caption ?? ""),
        ...(tq ? { testQuestion: tq } : {}),
        ...(te ? { testExplanation: te } : {}),
      };
    });
    const seq = (
      <InteractiveSequenceBlock
        blockTitle={studentBlockTitle(block)}
        hideBlockTitle={suppressInnerActivityTitle(block, cleanedText)}
        intro={String(block.intro ?? "")}
        steps={steps}
        resolveImageUrl={(url) => makeAbsoluteAssetUrl(url) ?? url}
        lessonTitle={lessonTitleForAi}
        level={levelForAi}
        subject={subjectForAi}
        viewMode="student"
      />
    );
    const seqAttr = getVisualTeachingDataAttribute(routed, block);
    const seqWrapped = seqAttr ? <div data-visual-block={seqAttr}>{seq}</div> : seq;
    const proseBefore =
      cleanedText.trim() && !studentContentStartsWithHeading(cleanedText, studentBlockTitle(block)) ? (
        <StudentExplanationBlock
          content={cleanedText}
          markdownComponents={markdownComponents}
          enableMarkdownMediaSplit={enableMarkdownMediaSplit}
          highlightKeywords={highlightKeywords}
        />
      ) : null;
    if (proseBefore) {
      return withStudentBlockHeading(
        <>
          {proseBefore}
          {seqWrapped}
        </>,
        block,
        cleanedText
      );
    }
    return withStudentBlockHeading(seqWrapped, block, cleanedText);
  }

  if (routed === "dragDropMatch") {
    const b = block as StudentLessonPageBlock;
    const mm = dragDropMatchModeFromBlockForProps(b);
    const ddm = (
      <DragDropMatchBlock
        resolveImageUrl={(url) => makeAbsoluteAssetUrl(url) ?? url}
        hideTitle={suppressInnerActivityTitle(block, cleanedText)}
        block={{
          title: studentBlockTitle(block),
          intro: String(block.intro ?? ""),
          instructions: String(b.instructions ?? ""),
          ...(mm ? { matchMode: mm } : {}),
          ...((mm === "diagram" || mm === "text-to-image") &&
          b.imageUrl != null &&
          String(b.imageUrl).trim()
            ? { imageUrl: String(b.imageUrl).trim() }
            : {}),
          pairs: Array.isArray(b.pairs)
            ? b.pairs!.map((p, i) => mapDragDropPairForBlockRender(p, i))
            : [],
          dropZones:
            mm === "diagram" && Array.isArray(b.dropZones)
              ? b.dropZones!.map((z, i) => {
                const x = coerceDiagramZonePct(z?.x);
                const y = coerceDiagramZonePct(z?.y);
                return {
                  id: String(z?.id ?? "").trim() || `dz${i}`,
                  ...(x !== undefined ? { x } : {}),
                  ...(y !== undefined ? { y } : {}),
                  correctPairId: String(z?.correctPairId ?? "").trim(),
                  ...(z?.explanation != null && String(z.explanation).trim()
                    ? { explanation: String(z.explanation) }
                    : {}),
                };
              })
            : undefined,
        }}
      />
    );
    const ddmAttr = getVisualTeachingDataAttribute(routed, block);
    const ddmWrapped = ddmAttr ? <div data-visual-block={ddmAttr}>{ddm}</div> : ddm;
    return withStudentBlockHeading(ddmWrapped, block, cleanedText);
  }

  if (routed === "examQuestion") {
    const eqId = String((block as { examQuestionId?: string }).examQuestionId ?? "").trim();
    const cached = eqId ? embeddedExamQuestionsById[eqId] : undefined;
    // Display-only: composite exam questions share the examQuestion block path and SS1 number.
    const headingBlock =
      cached && isCompositeQuestion(cached) && !String(block.title ?? "").trim()
        ? { ...block, type: "composite" }
        : block;
    const outer = formatStudentBlockHeading(headingBlock);
    const hideExamChrome =
      isOuterStudentHeadingVisible(headingBlock, "") &&
      (shouldSuppressInnerBlockTitle(outer, "Exam question", true) ||
        shouldSuppressInnerBlockTitle(outer, "Exam Question", true) ||
        shouldSuppressInnerBlockTitle(outer, "COMPOSITE QUESTION", true));
    const eq = (
      <ExamQuestionBlock
        question={cached}
        loading={embeddedExamQuestionsLoading && !!eqId && !cached}
        missing={!!eqId && !embeddedExamQuestionsLoading && !cached}
        mode={classroomMode ? "classroom" : "student"}
        presentation={studentPresentation === "v12" ? "v12" : "default"}
        hideChromeTitle={hideExamChrome}
      />
    );
    return withStudentBlockHeading(eq, headingBlock, "");
  }

  if (routed === "graph") {
    const graphBlock = normalizeGraphBlockForDisplay(block);
    const gr = (
      <GraphBlock
        block={graphBlock}
        blockIndex={blockIndex}
        audience="student"
        showAnswers={false}
        hideTitle={suppressInnerActivityTitle(block, cleanedText)}
      />
    );
    const grAttr = getVisualTeachingDataAttribute(routed, block);
    const grWrapped = grAttr ? <div data-visual-block={grAttr}>{gr}</div> : gr;
    return withStudentBlockHeading(grWrapped, block, cleanedText);
  }

  if (routed === "interactiveDiagram") {
    if (!isStudentVisibleInteractiveDiagramBlock(block as StudentLessonPageBlock)) {
      return null;
    }
    const imageUrlRaw = String((block as StudentLessonPageBlock).imageUrl ?? "").trim();
    const imageUrlResolved = imageUrlRaw
      ? (makeAbsoluteAssetUrl(imageUrlRaw) ?? imageUrlRaw)
      : "";
    const hasDiagramImage =
      hasRenderableLessonImageSrc(imageUrlRaw) &&
      hasRenderableLessonImageSrc(imageUrlResolved);

    const raw = (block as StudentLessonPageBlock).hotspots;
    const arr = Array.isArray(raw) ? raw : [];
    const hotspots: InteractiveDiagramHotspot[] = arr.map((h: InteractiveDiagramHotspotPersisted, i: number) => {
      const id = String(h?.id ?? "").trim() || `h${i + 1}`;
      const label = String(h?.label ?? "");
      const description = String(h?.description ?? "");
      const explanation = h?.explanation != null ? String(h.explanation) : undefined;
      const x = h?.x;
      const y = h?.y;
      const test = h?.test;
      if (typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)) {
        return {
          id,
          x,
          y,
          label,
          description,
          ...(explanation !== undefined ? { explanation } : {}),
          ...(test !== undefined ? { test } : {}),
        };
      }
      return {
        id,
        label,
        description,
        ...(explanation !== undefined ? { explanation } : {}),
        ...(test !== undefined ? { test } : {}),
      };
    });
    if (!hasDiagramImage) {
      return null;
    }
    const placedHotspots = applyPhotosynthesisHotspotDefaults(
      hotspots,
      [lessonTitleForAi, studentBlockTitle(block), String(block.intro ?? "")].filter(Boolean).join(" ")
    );
    const idgr = (
      <InteractiveDiagramBlock
        blockTitle={studentBlockTitle(block)}
        hideBlockTitle={suppressInnerActivityTitle(block, cleanedText)}
        intro={String(block.intro ?? "")}
        imageUrl={imageUrlRaw}
        hotspots={placedHotspots}
        resolveImageUrl={(url) => makeAbsoluteAssetUrl(url) ?? url}
        lessonTitle={lessonTitleForAi}
        level={levelForAi}
        subject={subjectForAi}
        viewMode="student"
      />
    );
    const idgrAttr = getVisualTeachingDataAttribute(routed, block);
    const idgrWrapped = idgrAttr ? <div data-visual-block={idgrAttr}>{idgr}</div> : idgr;
    return withStudentBlockHeading(idgrWrapped, block, cleanedText);
  }

  if (routed === "diagram") {
    if (!isStudentVisibleDiagramBlock(block as StudentLessonPageBlock)) {
      return null;
    }
    const uploadedDiagramActivity = hasRenderableLessonImageSrc(
      String((block as StudentLessonPageBlock).imageUrl ?? "")
    );
    const diagramSlot = (
      <div
        className="lesson-student-diagram-slot"
        data-visual-block="diagram"
        {...(uploadedDiagramActivity ? { "data-uploaded-diagram-activity": "1" } : {})}
      >
        {renderDiagramBlock(block, blockIndex, {
          suppressPedagogyTitle: uploadedDiagramActivity,
        })}
      </div>
    );
    if (uploadedDiagramActivity) {
      const heading = formatStudentBlockHeading(block);
      const showHeading =
        Boolean(heading) && !studentContentStartsWithHeading(cleanedText, heading);
      return (
        <UploadedDiagramActivityShell heading={showHeading ? heading : null}>
          {diagramSlot}
        </UploadedDiagramActivityShell>
      );
    }
    return withStudentBlockHeading(diagramSlot, block, cleanedText);
  }

  const safeHighlightKeywords = normalizeBlockType(kind) === "pageQuiz" ? undefined : highlightKeywords;
  const mdProps = { content: raw, markdownComponents, enableMarkdownMediaSplit, highlightKeywords: safeHighlightKeywords };

  if (semanticRole === "examTechnique") {
    return withStudentBlockHeading(<StudentExamTechniqueBlock {...mdProps} />, block, cleanedText);
  }
  if (semanticRole === "synopticLink") {
    return withStudentBlockHeading(<StudentSynopticLinkBlock {...mdProps} />, block, cleanedText);
  }
  if (semanticRole === "whyThisMatters") {
    return withStudentBlockHeading(<StudentWhyThisMattersBlock {...mdProps} />, block, cleanedText);
  }

  if (kind === "keyIdea") {
    return withStudentBlockHeading(<StudentKeyIdeaBlock {...mdProps} />, block, cleanedText);
  }
  if (kind === "examTip") {
    return withStudentBlockHeading(<StudentExamTipBlock {...mdProps} />, block, cleanedText);
  }
  if (kind === "commonMistake") {
    return withStudentBlockHeading(<StudentMisconceptionBlock {...mdProps} />, block, cleanedText);
  }
  if (kind === "stretch") {
    return withStudentBlockHeading(<StudentSynthesisBlock {...mdProps} />, block, cleanedText);
  }

  if (kind === "hook") {
    return withStudentBlockHeading(<StudentHookBlock {...mdProps} />, block, cleanedText);
  }
  if (kind === "workedExample") {
    return withStudentBlockHeading(<StudentWorkedExampleBlock {...mdProps} />, block, cleanedText);
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
      return withStudentBlockHeading(
        <StudentKeyWordsBlock content={raw} markdownComponents={markdownComponents} keywords={keywords} />,
        block,
        cleanedText
      );
    }
    return withStudentBlockHeading(<StudentExplanationBlock {...mdProps} />, block, cleanedText);
  }

  if (kind === "text") {
    const keywords = maybeParseKeywordsFromText(cleanedText);
    if (
      keywords &&
      keywords.length > 0 &&
      (!Array.isArray(safeHighlightKeywords) || safeHighlightKeywords.length === 0)
    ) {
      return withStudentBlockHeading(
        <StudentKeyWordsBlock content={raw} markdownComponents={markdownComponents} keywords={keywords} />,
        block,
        cleanedText
      );
    }
    return withStudentBlockHeading(<StudentExplanationBlock {...mdProps} />, block, cleanedText);
  }

  return withStudentBlockHeading(<StudentExplanationBlock {...mdProps} />, block, cleanedText);
}
