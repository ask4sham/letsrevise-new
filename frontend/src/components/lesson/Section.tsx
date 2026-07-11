/**
 * PR-UX-LESSON-1: Standardised section wrapper for LessonViewPage.
 * Ensures consistent heading style and spacing across CYU, Practice, Flashcards, etc.
 */
import React from "react";

const SECTION_STYLE: React.CSSProperties = {
  marginTop: 32,
  paddingTop: 30,
  borderTop: "1px solid #e2e8f0",
  textAlign: "left",
};

const HEADER_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 16,
};

const TITLE_STYLE: React.CSSProperties = {
  color: "#333",
  fontSize: "1.65rem",
  margin: 0,
  fontWeight: 700,
};

const CARD_WRAPPER_STYLE: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  padding: 16,
};

export function Section({
  title,
  children,
  right,
  id,
  variant = "card",
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  id?: string;
  variant?: "card" | "plain";
}) {
  return (
    <section id={id} className="lesson-view-section" style={SECTION_STYLE}>
      <div style={HEADER_ROW_STYLE}>
        <h2 style={TITLE_STYLE}>{title}</h2>
        {right}
      </div>
      {variant === "card" ? (
        <div className="lesson-section-card" style={CARD_WRAPPER_STYLE}>
          {children}
        </div>
      ) : (
        <div className="lesson-section-plain">{children}</div>
      )}
    </section>
  );
}
