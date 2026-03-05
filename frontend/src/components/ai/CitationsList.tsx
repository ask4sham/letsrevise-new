/**
 * PR-018: Numbered citations with source quality badges and deep links.
 * Used by AskAiPanel (teacher) and AskAiStudentPanel (student).
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { buildCitationLink } from "./citationLinks";
import { makeAbsoluteAssetUrl } from "../../utils/assetUrl";
import type { EnquiryCitation, UsedSource } from "../../api/enquiry";

function badgeLabel(sourceType: string): string {
  if (sourceType === "specStatement") return "SPEC";
  if (sourceType === "lessonBlock") return "LESSON";
  if (sourceType === "lessonDiagram") return "DIAGRAM";
  if (sourceType === "teacherNote") return "NOTE";
  if (sourceType === "externalTrusted") return "EXTERNAL";
  return "EXTERNAL";
}

function badgeStyle(sourceType: string): { bg: string; color: string } {
  if (sourceType === "specStatement") return { bg: "#dbeafe", color: "#1e40af" };
  if (sourceType === "lessonBlock") return { bg: "#dcfce7", color: "#166534" };
  if (sourceType === "lessonDiagram") return { bg: "#ede9fe", color: "#5b21b6" };
  if (sourceType === "teacherNote") return { bg: "#e0e7ff", color: "#3730a3" };
  return { bg: "#fef3c7", color: "#92400e" };
}

type Props = {
  citations: EnquiryCitation[];
  usedSources?: UsedSource[];
  defaultQuotesExpanded?: boolean;
  studentMode?: boolean;
  lessonId?: string;
  linkText?: string;
  sectionTitle?: string;
  showEvidenceLabel?: string;
  introNote?: string;
  /** PR-023: when teacherNote sources used, show helper line + link (teacher/admin only) */
  specKey?: string;
  topicKey?: string;
};

export function CitationsList({
  citations,
  usedSources = [],
  defaultQuotesExpanded = true,
  studentMode = false,
  lessonId,
  linkText = "Open source",
  sectionTitle = "Citations",
  showEvidenceLabel = "Show evidence",
  introNote,
  specKey,
  topicKey,
}: Props) {
  const [quotesExpanded, setQuotesExpanded] = useState(defaultQuotesExpanded);
  const sourceMap = new Map(usedSources.map((s) => [s.knowledgeDocumentId, s]));

  const specCount = usedSources.filter((s) => s.sourceType === "specStatement").length;
  const lessonCount = usedSources.filter((s) => s.sourceType === "lessonBlock").length;
  const diagramCount = usedSources.filter((s) => s.sourceType === "lessonDiagram").length;
  const noteCount = usedSources.filter((s) => s.sourceType === "teacherNote").length;
  const externalCount = usedSources.filter((s) => s.sourceType === "externalTrusted").length;

  const sourceQualityParts: string[] = [];
  if (specCount > 0) sourceQualityParts.push(`Spec ✓ (${specCount})`);
  if (lessonCount > 0) sourceQualityParts.push(`Lesson ✓ (${lessonCount})`);
  if (noteCount > 0) sourceQualityParts.push(`Note ✓ (${noteCount})`);
  if (externalCount > 0) sourceQualityParts.push(`External ✓ (${externalCount})`);
  const sourceQualityLine =
    sourceQualityParts.length > 0
      ? `Sources used: ${sourceQualityParts.join(", ")}`
      : "Sources used: none";

  const hasTeacherNote = noteCount > 0 || citations.some((c) => c.sourceType === "teacherNote");
  const teacherNoteHelperUrl =
    specKey && topicKey ? `/external-sources?specKey=${encodeURIComponent(specKey)}&topicKey=${encodeURIComponent(topicKey)}` : null;

  if (!citations || citations.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#334155" }}>
        {sectionTitle}
      </div>
      {introNote && (
        <p style={{ margin: "0 0 8px 0", fontSize: 13, color: "#64748b" }}>{introNote}</p>
      )}
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{sourceQualityLine}</div>
      {!studentMode && hasTeacherNote && teacherNoteHelperUrl && (
        <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#64748b" }}>
          Includes teacher-curated notes.{" "}
          <Link to={teacherNoteHelperUrl} style={{ color: "#0284c7", fontWeight: 600 }}>
            View in coverage →
          </Link>
        </p>
      )}
      <button
        type="button"
        onClick={() => setQuotesExpanded((v) => !v)}
        style={{
          padding: "6px 12px",
          fontSize: 13,
          fontWeight: 600,
          background: quotesExpanded ? "#e2e8f0" : "#f1f5f9",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          cursor: "pointer",
          color: "#334155",
          marginBottom: 8,
        }}
      >
        {quotesExpanded ? "Hide quotes" : showEvidenceLabel}
      </button>
      {quotesExpanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {citations.map((c, i) => {
            const src = sourceMap.get(c.knowledgeDocumentId);
            const linkTarget = buildCitationLink(c, {
              lessonId,
              studentSafe: studentMode,
            });
            const badge = badgeLabel(c.sourceType);
            const styles = badgeStyle(c.sourceType);
            return (
              <div
                key={`${c.knowledgeDocumentId}-${i}`}
                style={{
                  padding: 10,
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 13,
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: styles.bg,
                      color: styles.color,
                      fontWeight: 600,
                      fontSize: 11,
                      marginRight: 8,
                    }}
                  >
                    [{i + 1}]
                  </span>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: styles.bg,
                      color: styles.color,
                      fontWeight: 600,
                      fontSize: 11,
                      marginRight: 8,
                    }}
                  >
                    {badge}
                  </span>
                  {src?.title && (
                    <span style={{ color: "#475569" }}>— {src.title}</span>
                  )}
                </div>
                {c.sourceType === "lessonDiagram" && (c.imageUrl || c.caption) && (
                  <div
                    style={{
                      marginBottom: 8,
                      padding: 8,
                      background: "#f8fafc",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {c.imageUrl && (
                      <img
                        src={makeAbsoluteAssetUrl(c.imageUrl) || c.imageUrl}
                        alt={c.caption || "Diagram"}
                        style={{
                          maxWidth: "100%",
                          maxHeight: 120,
                          objectFit: "contain",
                          borderRadius: 8,
                          marginBottom: c.caption ? 8 : 0,
                        }}
                      />
                    )}
                    {c.caption && (
                      <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>{c.caption}</div>
                    )}
                    {linkTarget && (
                      <Link
                        to={linkTarget}
                        target={studentMode ? undefined : "_blank"}
                        rel={studentMode ? undefined : "noopener noreferrer"}
                        style={{
                          fontSize: 12,
                          color: "#0284c7",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        View in lesson →
                      </Link>
                    )}
                  </div>
                )}
                {c.sourceType !== "lessonDiagram" && (
                  <div style={{ color: "#64748b", fontStyle: "italic", marginBottom: 6 }}>
                    &ldquo;{c.quote}&rdquo;
                  </div>
                )}
                {c.sourceType === "lessonDiagram" && !c.imageUrl && !c.caption && (
                  <div style={{ color: "#64748b", fontStyle: "italic", marginBottom: 6 }}>
                    &ldquo;{c.quote}&rdquo;
                  </div>
                )}
                {c.reason && (
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
                    Reason: {c.reason}
                  </div>
                )}
                {linkTarget && (c.sourceType !== "lessonDiagram" || (!c.imageUrl && !c.caption)) &&
                  (linkTarget.startsWith("http") ? (
                    <a
                      href={linkTarget}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        color: "#0284c7",
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      Open external source →
                    </a>
                  ) : (
                    <Link
                      to={linkTarget}
                      target={studentMode ? undefined : "_blank"}
                      rel={studentMode ? undefined : "noopener noreferrer"}
                      style={{
                        fontSize: 12,
                        color: studentMode ? "#16a34a" : "#0284c7",
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      {studentMode ? "View in lesson" : "Open source"} →
                    </Link>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
