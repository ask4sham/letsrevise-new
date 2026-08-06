import React, { useState } from "react";
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
import { ActivityQuestionPager } from "../ActivityQuestionPager";
import { extractActivityQuestionsFromBlock } from "../../../utils/activityQuestionsFromBlock";
import { InteractiveSequenceBlock, type InteractiveSequenceStep } from "../InteractiveSequenceBlock";
import { InteractiveDiagramBlock, type InteractiveDiagramHotspot } from "../InteractiveDiagramBlock";
import { DragDropMatchBlock } from "../DragDropMatchBlock";
import { GraphBlock } from "../GraphBlock";
import { ExamQuestionBlock } from "../ExamQuestionBlock";
import { isCompositeQuestion } from "../examComposite/compositeUtils";
import type { ExamQuestion } from "../../../api/examQuestions";
import { QuizView } from "../../revision/QuizView";
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
import { normalizeQuizQuestion } from "../../../utils/normalizeQuizQuestion";
import { concealOpenExamPracticeMarkSchemes } from "../../../utils/formatExamPracticeContent";
import { getVisualTeachingDataAttribute } from "./visualTeachingBlocks";
import { StudentBlockHeading } from "./StudentBlockHeading";
import { UploadedDiagramActivityShell } from "./UploadedDiagramActivityShell";
import {
  fallbackActivityTitleFromBlockType,
  formatStudentBlockHeading,
  inferStudentFrameKind,
  isOuterStudentHeadingVisible,
  shouldSuppressInnerBlockTitle,
  stripLeadingDuplicateBlockHeading,
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
  /** Mastery / adaptive loop — same callback as footer Quiz Page */
  onQuestionAnswered?: (correct: boolean) => void;
  /**
   * When the pageQuiz block has empty `questions[]` but the lesson quiz bank
   * already holds page-scoped items, render those instead of an empty shell.
   */
  pageQuizFallbackQuestions?: Array<Record<string, unknown>>;
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

function StudentCheckpointActivity({
  block,
  blockIndex,
  lessonId,
  pageId,
  checkpointEntitled,
  studentPresentation,
}: {
  block: StudentLessonPageBlock;
  blockIndex: number;
  lessonId?: string;
  pageId?: string;
  checkpointEntitled: boolean;
  studentPresentation: "default" | "v12";
}): React.ReactElement | null {
  const stored = extractActivityQuestionsFromBlock(block);
  const legacy = stored.length ? null : studentCheckpointFromBlock(block, String(blockIndex));
  const items =
    stored.length > 0
      ? stored
      : legacy
        ? [
            {
              prompt: legacy.prompt,
              questionType: legacy.mode,
              options: legacy.options,
              correctAnswer: legacy.correctAnswer,
              explanation: legacy.explanation,
              markScheme: legacy.markScheme,
            },
          ]
        : [];
  const [index, setIndex] = useState(0);
  if (!items.length) return null;
  const safeIndex = Math.min(Math.max(index, 0), items.length - 1);
  const q = items[safeIndex];
  return (
    <div
      className={studentPresentation === "v12" ? "lesson-student-checkpoint-section" : undefined}
    >
      <ActivityQuestionPager total={items.length} index={safeIndex} onChange={setIndex} />
      <LessonCheckpoint
        mode={q.questionType}
        prompt={q.prompt}
        options={q.options}
        correctAnswer={q.correctAnswer}
        explanation={q.explanation}
        markScheme={q.markScheme}
        name={`checkpoint-${blockIndex}-${safeIndex}`}
        lessonId={lessonId}
        pageId={pageId}
        entitled={checkpointEntitled}
        presentation={studentPresentation}
      />
    </div>
  );
}

function StudentSelfCheckActivity({
  block,
  enableMarkdownMediaSplit,
  displayText,
}: {
  block: StudentLessonPageBlock;
  enableMarkdownMediaSplit?: boolean;
  displayText: string;
}): React.ReactElement {
  const stored = extractActivityQuestionsFromBlock(block);
  const legacyFallback =
    stored.length > 0
      ? stored
      : [
          {
            prompt: String(block.prompt ?? ""),
            questionType: (block.questionType === "short" ? "short" : "mcq") as "mcq" | "short",
            options: Array.isArray(block.options) ? block.options.map(String) : [],
            correctAnswer: String(block.correctAnswer ?? ""),
            explanation:
              block.explanation != null
                ? mergeCheckpointExplanationParts({
                    explanation: String(block.explanation),
                    markScheme: Array.isArray(block.markScheme) ? block.markScheme : undefined,
                  })
                : undefined,
            markScheme: Array.isArray(block.markScheme) ? block.markScheme : undefined,
          },
        ];
  const items = legacyFallback.filter((q) => String(q.prompt || "").trim());
  const [index, setIndex] = useState(0);
  const safeIndex = items.length ? Math.min(Math.max(index, 0), items.length - 1) : 0;
  const q = items[safeIndex] || legacyFallback[0];
  const rawMs = q?.markScheme ?? (Array.isArray(block.markScheme) ? block.markScheme : undefined);

  return (
    <>
      <ActivityQuestionPager total={Math.max(items.length, 1)} index={safeIndex} onChange={setIndex} />
      <InlineSelfCheckBlock
        prompt={String(q?.prompt ?? "")}
        questionType={q?.questionType === "short" ? "short" : "mcq"}
        options={Array.isArray(q?.options) ? q.options : []}
        correctAnswer={String(q?.correctAnswer ?? "")}
        markScheme={rawMs}
        explanation={
          q?.explanation != null
            ? String(q.explanation)
            : mergeCheckpointExplanationParts({
                explanation: block.explanation != null ? String(block.explanation) : undefined,
                markScheme: Array.isArray(block.markScheme) ? block.markScheme : undefined,
              })
        }
        contentFallback={typeof block.content === "string" ? block.content : ""}
        presentation={enableMarkdownMediaSplit ? "v12" : "default"}
        hideHeadingLabel={suppressInnerActivityTitle(block, displayText, "Self-check")}
      />
    </>
  );
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
  onQuestionAnswered,
  pageQuizFallbackQuestions,
}: LessonStudentBlockRendererProps): React.ReactElement | null {
  /** Interactive + diagram routing (handles mis-tagged drag-drop). */
  const routed = resolveLessonDisplayBlockType(block as { type?: unknown; pairs?: unknown });
  /** Raw persisted `type` for legacy shells (keyIdea, examTip, hook, …). */
  const kind = String(block.type ?? "").trim() || "text";
  const semanticRole = normalizePedagogicalRole((block as { role?: unknown }).role);
  const raw = typeof block.content === "string" ? block.content : "";
  const cleanedText = stripVideoMarkdown(raw);
  // Display-only: drop a leading prose heading that repeats the outer `N — TITLE`.
  let displayText = stripLeadingDuplicateBlockHeading(
    cleanedText,
    formatStudentBlockHeading(block)
  );
  // Exam practice: mark schemes must stay inside Reveal until the student opens it.
  const roleRaw = String((block as { role?: unknown }).role ?? "").trim().toLowerCase();
  const titleLooksLikePractice = /practice\s*questions/i.test(String(block.title ?? ""));
  if (roleRaw === "exampractice" || titleLooksLikePractice) {
    displayText = concealOpenExamPracticeMarkSchemes(displayText);
  }

  // Page Quiz: MCQs live in questions[] (or lesson.quiz bank) — never as empty markdown.
  if (routed === "pageQuiz" || normalizeBlockType(kind) === "pageQuiz") {
    const fromBlock = extractActivityQuestionsFromBlock(block);
    const quizRaw: Array<Record<string, unknown>> =
      fromBlock.length > 0
        ? fromBlock.map((q, i) => ({
            id: `page-quiz-${blockIndex}-${i}`,
            type: q.questionType,
            question: q.prompt,
            prompt: q.prompt,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            ...(q.markScheme ? { markScheme: q.markScheme } : {}),
            tags: ["page-quiz"],
          }))
        : Array.isArray(pageQuizFallbackQuestions)
          ? pageQuizFallbackQuestions
          : [];
    if (quizRaw.length === 0) return null;
    const quiz = (
      <QuizView
        title=""
        questions={quizRaw.map((rawQ, idx) => normalizeQuizQuestion(rawQ, idx))}
        onQuestionAnswered={onQuestionAnswered}
      />
    );
    return withStudentBlockHeading(quiz, block, "");
  }

  if (routed === "checkpoint") {
    const storedQs = extractActivityQuestionsFromBlock(block);
    const legacyData =
      storedQs.length > 0 ? null : studentCheckpointFromBlock(block, String(blockIndex));
    if (!storedQs.length && !legacyData) return null;
    const cp = (
      <StudentCheckpointActivity
        block={block as StudentLessonPageBlock}
        blockIndex={blockIndex}
        lessonId={lessonId}
        pageId={pageId}
        checkpointEntitled={checkpointEntitled}
        studentPresentation={studentPresentation}
      />
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
    const sc = (
      <StudentSelfCheckActivity
        block={block as StudentLessonPageBlock}
        enableMarkdownMediaSplit={enableMarkdownMediaSplit}
        displayText={displayText}
      />
    );
    return withStudentBlockHeading(sc, block, displayText);
  }

  if (routed === "interactiveSequence") {
    if (!isStudentVisibleInteractiveSequenceBlock(block as StudentLessonPageBlock)) {
      return null;
    }
    const seqBlock = block as StudentLessonPageBlock;
    const isProgressive = seqBlock.presentationMode === "progressiveReveal";
    const raw = seqBlock.sequenceSteps ?? (block as { steps?: InteractiveSequenceStepPersisted[] }).steps;
    const arr = Array.isArray(raw) ? raw : [];
    const steps: InteractiveSequenceStep[] = arr.map((s: InteractiveSequenceStepPersisted) => {
      const sid = typeof s.id === "string" ? String(s.id).trim() : "";
      const base = {
        ...(sid ? { id: sid.slice(0, 64) } : {}),
        title: String(s?.title ?? ""),
        description: String(s?.description ?? ""),
        imageUrl: String(s?.imageUrl ?? ""),
      };
      if (isProgressive) {
        return { ...base, caption: "" };
      }
      const tq = s.testQuestion != null ? String(s.testQuestion).trim() : "";
      const te = s.testExplanation != null ? String(s.testExplanation).trim() : "";
      return {
        ...base,
        caption: String(s?.caption ?? ""),
        ...(tq ? { testQuestion: tq } : {}),
        ...(te ? { testExplanation: te } : {}),
      };
    });
    const seq = (
      <InteractiveSequenceBlock
        blockTitle={studentBlockTitle(block)}
        hideBlockTitle={suppressInnerActivityTitle(block, displayText)}
        intro={String(block.intro ?? "")}
        steps={steps}
        resolveImageUrl={(url) => makeAbsoluteAssetUrl(url) ?? url}
        lessonTitle={lessonTitleForAi}
        level={levelForAi}
        subject={subjectForAi}
        presentationMode={seqBlock.presentationMode}
        enableTestMe={seqBlock.enableTestMe}
        viewMode="student"
      />
    );
    const seqAttr = getVisualTeachingDataAttribute(routed, block);
    const seqWrapped = seqAttr ? <div data-visual-block={seqAttr}>{seq}</div> : seq;
    const proseBefore =
      displayText.trim() && !studentContentStartsWithHeading(displayText, studentBlockTitle(block)) ? (
        <StudentExplanationBlock
          content={displayText}
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
        displayText
      );
    }
    return withStudentBlockHeading(seqWrapped, block, displayText);
  }

  if (routed === "dragDropMatch") {
    const b = block as StudentLessonPageBlock;
    const mm = dragDropMatchModeFromBlockForProps(b);
    const ddm = (
      <DragDropMatchBlock
        resolveImageUrl={(url) => makeAbsoluteAssetUrl(url) ?? url}
        hideTitle={suppressInnerActivityTitle(block, displayText)}
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
    return withStudentBlockHeading(ddmWrapped, block, displayText);
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
        shouldSuppressInnerBlockTitle(outer, "EXAM QUESTION", true) ||
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
        hideTitle={suppressInnerActivityTitle(block, displayText)}
      />
    );
    const grAttr = getVisualTeachingDataAttribute(routed, block);
    const grWrapped = grAttr ? <div data-visual-block={grAttr}>{gr}</div> : gr;
    return withStudentBlockHeading(grWrapped, block, displayText);
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
        hideBlockTitle={suppressInnerActivityTitle(block, displayText)}
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
    return withStudentBlockHeading(idgrWrapped, block, displayText);
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
        Boolean(heading) && !studentContentStartsWithHeading(displayText, heading);
      return (
        <UploadedDiagramActivityShell heading={showHeading ? heading : null}>
          {diagramSlot}
        </UploadedDiagramActivityShell>
      );
    }
    return withStudentBlockHeading(diagramSlot, block, displayText);
  }

  const safeHighlightKeywords = normalizeBlockType(kind) === "pageQuiz" ? undefined : highlightKeywords;
  const mdProps = { content: displayText, markdownComponents, enableMarkdownMediaSplit, highlightKeywords: safeHighlightKeywords };

  if (semanticRole === "examTechnique") {
    return withStudentBlockHeading(<StudentExamTechniqueBlock {...mdProps} />, block, displayText);
  }
  if (semanticRole === "synopticLink") {
    return withStudentBlockHeading(<StudentSynopticLinkBlock {...mdProps} />, block, displayText);
  }
  if (semanticRole === "whyThisMatters") {
    return withStudentBlockHeading(<StudentWhyThisMattersBlock {...mdProps} />, block, displayText);
  }

  if (kind === "keyIdea") {
    return withStudentBlockHeading(<StudentKeyIdeaBlock {...mdProps} />, block, displayText);
  }
  if (kind === "examTip") {
    return withStudentBlockHeading(<StudentExamTipBlock {...mdProps} />, block, displayText);
  }
  if (kind === "commonMistake") {
    return withStudentBlockHeading(<StudentMisconceptionBlock {...mdProps} />, block, displayText);
  }
  if (kind === "stretch") {
    return withStudentBlockHeading(<StudentSynthesisBlock {...mdProps} />, block, displayText);
  }

  if (kind === "hook") {
    return withStudentBlockHeading(<StudentHookBlock {...mdProps} />, block, displayText);
  }
  if (kind === "workedExample") {
    return withStudentBlockHeading(<StudentWorkedExampleBlock {...mdProps} />, block, displayText);
  }

  // Comma-separated "key words" list callout: only when we are NOT also showing page/lesson
  // glossary key terms. StudentKeyWordsBlock does not run LessonStudentMarkdown, so it would
  // show bold/list only with zero KeywordMark (no red "i") — a common cause of "Add key term
  // does nothing" on short text blocks.
  if (kind === "keyWords") {
    const keywords = maybeParseKeywordsFromText(displayText);
    if (
      keywords &&
      keywords.length > 0 &&
      (!Array.isArray(safeHighlightKeywords) || safeHighlightKeywords.length === 0)
    ) {
      return withStudentBlockHeading(
        <StudentKeyWordsBlock content={displayText} markdownComponents={markdownComponents} keywords={keywords} />,
        block,
        displayText
      );
    }
    return withStudentBlockHeading(<StudentExplanationBlock {...mdProps} />, block, displayText);
  }

  if (kind === "text") {
    const keywords = maybeParseKeywordsFromText(displayText);
    if (
      keywords &&
      keywords.length > 0 &&
      (!Array.isArray(safeHighlightKeywords) || safeHighlightKeywords.length === 0)
    ) {
      return withStudentBlockHeading(
        <StudentKeyWordsBlock content={displayText} markdownComponents={markdownComponents} keywords={keywords} />,
        block,
        displayText
      );
    }
    return withStudentBlockHeading(<StudentExplanationBlock {...mdProps} />, block, displayText);
  }

  return withStudentBlockHeading(<StudentExplanationBlock {...mdProps} />, block, displayText);
}
