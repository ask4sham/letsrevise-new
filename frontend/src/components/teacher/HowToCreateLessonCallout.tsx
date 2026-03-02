import React, { useState } from "react";

const PDF_URL = "/docs/Edit_Lesson_Activities_and_Action_Points_Explained.pdf";

const DEFAULT_BODY_COPY =
  "Activities, quizzes, and practice explained. Use this guide while building a lesson to know what to click and when.";

export interface HowToCreateLessonCalloutProps {
  /** Optional body text; default is the Edit Lesson copy. */
  bodyCopy?: string;
}

/**
 * Blue callout box linking to the teacher guide PDF. Used on Edit Lesson and Create Lesson.
 * Same styling and link on both; body copy can be tailored per page.
 */
export function HowToCreateLessonCallout({ bodyCopy = DEFAULT_BODY_COPY }: HowToCreateLessonCalloutProps) {
  const [hover, setHover] = useState(false);
  const baseBg = "#E6F4FF";
  const baseBorder = "#3B82F6";
  return (
    <a
      href={PDF_URL}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        marginBottom: 12,
        padding: 14,
        borderRadius: 10,
        background: hover ? "#D6EBFF" : baseBg,
        border: `2px solid ${baseBorder}`,
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ flexShrink: 0, color: baseBorder }} aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#1e3a5f", marginBottom: 6 }}>
            How to create a lesson (step by step)
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.45 }}>
            {bodyCopy}
          </div>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: baseBorder, marginTop: 8 }}>
            Open guide (PDF)
          </div>
        </div>
      </div>
    </a>
  );
}
