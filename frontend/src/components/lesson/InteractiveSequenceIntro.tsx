import React, { useMemo } from "react";
import { LessonMarkdown } from "./LessonMarkdown";
import { LessonRichText } from "./LessonRichText";
import {
  formatExamLinkIntroBody,
  introSectionBodyToHeadingMarkdown,
  parseInteractiveSequenceIntro,
} from "../../utils/parseInteractiveSequenceIntro";

export type InteractiveSequenceIntroProps = {
  intro: string;
  className?: string;
  markdownClassName?: string;
};

/**
 * Renders step-by-step intro: structured sections when teaching markers are present,
 * otherwise legacy single-field rich text.
 */
export function InteractiveSequenceIntro({
  intro,
  className = "interactive-sequence__intro",
  markdownClassName = "interactive-sequence__intro--md lesson-content lesson-md-body",
}: InteractiveSequenceIntroProps): React.ReactElement | null {
  const sections = useMemo(() => parseInteractiveSequenceIntro(intro), [intro]);
  const trimmed = String(intro ?? "").trim();

  if (!trimmed) return null;

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
            {section.label}
          </p>
          <div className="interactive-sequence__intro-section-body">
            {section.id === "exam-link" ? (
              <pre className="interactive-sequence__intro-exam-link">
                {formatExamLinkIntroBody(section.body)}
              </pre>
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
