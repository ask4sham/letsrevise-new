import React from "react";
import type { Components } from "react-markdown";
import { LessonStudentMarkdown } from "./LessonStudentMarkdown";
import { StudentMarkdownMediaSplit } from "./StudentMarkdownMediaSplit";
import type { ContentKeywordItem } from "./contentKeywordHighlight";

type MdProps = {
  content: string;
  markdownComponents: Partial<Components>;
  /** V12: split first standalone markdown image into text-left / image-right */
  enableMarkdownMediaSplit?: boolean;
  /** Lesson/page metadata — render-time highlights only */
  highlightKeywords?: ContentKeywordItem[];
};

export function StudentExplanationBlock({
  content,
  markdownComponents,
  enableMarkdownMediaSplit,
  highlightKeywords,
}: MdProps) {
  if (enableMarkdownMediaSplit) {
    return (
      <StudentMarkdownMediaSplit
        content={content}
        markdownComponents={markdownComponents}
        wrapperClassName="lesson-content student-block student-block--text"
        highlightKeywords={highlightKeywords}
      />
    );
  }
  return (
    <div className="lesson-content student-block student-block--text">
      <LessonStudentMarkdown components={markdownComponents} highlightKeywords={highlightKeywords}>
        {content}
      </LessonStudentMarkdown>
    </div>
  );
}

export function StudentKeyIdeaBlock({
  content,
  markdownComponents,
  enableMarkdownMediaSplit,
  highlightKeywords,
}: MdProps) {
  if (enableMarkdownMediaSplit) {
    return (
      <StudentMarkdownMediaSplit
        content={content}
        markdownComponents={markdownComponents}
        wrapperClassName="lesson-content student-block student-block--key"
        highlightKeywords={highlightKeywords}
      />
    );
  }
  return (
    <div className="lesson-content student-block student-block--key">
      <LessonStudentMarkdown components={markdownComponents} highlightKeywords={highlightKeywords}>
        {content}
      </LessonStudentMarkdown>
    </div>
  );
}

export function StudentExamTipBlock({ content, markdownComponents, highlightKeywords }: MdProps) {
  return (
    <div className="lesson-content student-block student-block--exam-tip">
      <LessonStudentMarkdown components={markdownComponents} highlightKeywords={highlightKeywords}>
        {content}
      </LessonStudentMarkdown>
    </div>
  );
}

export function StudentMisconceptionBlock({ content, markdownComponents }: MdProps) {
  return (
    <div className="lesson-content student-block student-block--misconception">
      <LessonStudentMarkdown components={markdownComponents}>{content}</LessonStudentMarkdown>
    </div>
  );
}

/** Maps `stretch` (deeper knowledge) — summary / extension tone */
export function StudentSynthesisBlock({ content, markdownComponents, highlightKeywords }: MdProps) {
  return (
    <div className="lesson-content student-block student-block--synthesis">
      <LessonStudentMarkdown components={markdownComponents} highlightKeywords={highlightKeywords}>
        {content}
      </LessonStudentMarkdown>
    </div>
  );
}

export function StudentWorkedExampleBlock({ content, markdownComponents, highlightKeywords }: MdProps) {
  return (
    <div className="lesson-content student-block student-block--example">
      <LessonStudentMarkdown components={markdownComponents} highlightKeywords={highlightKeywords}>
        {content}
      </LessonStudentMarkdown>
    </div>
  );
}

export function StudentHookBlock({ content, markdownComponents, highlightKeywords }: MdProps) {
  return (
    <div className="lesson-content student-block student-block--hook">
      <LessonStudentMarkdown components={markdownComponents} highlightKeywords={highlightKeywords}>
        {content}
      </LessonStudentMarkdown>
    </div>
  );
}

type KeyWordsProps = MdProps & { keywords: string[] };

export function StudentKeyWordsBlock({ keywords }: KeyWordsProps) {
  return (
    <div className="lesson-content student-block student-block--keywords">
      <ul className="student-block__keyword-list">
        {keywords.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
