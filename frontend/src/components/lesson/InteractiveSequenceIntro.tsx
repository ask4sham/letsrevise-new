import React, { useMemo } from "react";
import { LessonMarkdown } from "./LessonMarkdown";
import { LessonRichText } from "./LessonRichText";
import {
  formatExamLinkIntroBody,
  introSectionBodyToHeadingMarkdown,
  parseInteractiveSequenceIntro,
  parseInteractiveSequenceIntroStepList,
  type InteractiveSequenceIntroSectionId,
} from "../../utils/parseInteractiveSequenceIntro";

/** Student-facing labels for teaching-marker intro sections (display only). */
const INTRO_DISPLAY_LABELS: Record<InteractiveSequenceIntroSectionId, string> = {
  "big-question": "Learning goal",
  "your-mission": "What to do",
  "exam-link": "Exam tip",
};

function formatExamTipIntroBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (/→/.test(trimmed)) return formatExamLinkIntroBody(trimmed);
  return trimmed
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .join("\n");
}

export type InteractiveSequenceIntroProps = {
  intro: string;
  className?: string;
  markdownClassName?: string;
};

/**
 * Renders step-by-step intro: teaching-marker sections, plain-text step lists, or rich text/HTML.
 */
export function InteractiveSequenceIntro({
  intro,
  className = "interactive-sequence__intro",
  markdownClassName = "interactive-sequence__intro--md lesson-content lesson-md-body",
}: InteractiveSequenceIntroProps): React.ReactElement | null {
  const sections = useMemo(() => parseInteractiveSequenceIntro(intro), [intro]);
  const stepList = useMemo(() => parseInteractiveSequenceIntroStepList(intro), [intro]);
  const trimmed = String(intro ?? "").trim();

  if (!trimmed) return null;

  if (stepList) {
    return (
      <div className={`interactive-sequence__intro-step-list-wrap ${className}`.trim()}>
        {stepList.preamble ? (
          <LessonRichText
            text={stepList.preamble}
            className="interactive-sequence__intro-preamble"
            markdownClassName={markdownClassName}
          />
        ) : null}
        <ul className="interactive-sequence__intro-step-list" aria-label="Process steps">
          {stepList.steps.map((stepLine) => (
            <li key={stepLine} className="interactive-sequence__intro-step-item">
              {stepLine}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!sections) {
    return (
      <LessonRichText text={intro} className={className} markdownClassName={markdownClassName} />
    );
  }

  return (
    <div className={`interactive-sequence__intro-sections ${className}`.trim()}>
      {sections.map((section) => (
        <section
          key={section.id}
          className={`interactive-sequence__intro-section interactive-sequence__intro-section--${section.id}`}
          aria-labelledby={`interactive-sequence-intro-${section.id}`}
        >
          <p
            id={`interactive-sequence-intro-${section.id}`}
            className="interactive-sequence__intro-section-label"
          >
            {INTRO_DISPLAY_LABELS[section.id]}
          </p>
          <div className="interactive-sequence__intro-section-body">
            {section.id === "exam-link" ? (
              <div className="interactive-sequence__intro-exam-link">
                {formatExamTipIntroBody(section.body)}
              </div>
            ) : (
              <LessonMarkdown className={markdownClassName}>
                {introSectionBodyToHeadingMarkdown(section.body)}
              </LessonMarkdown>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
