/**
 * PR-034: Inline diagram rendering in AI answers.
 * Renders diagram citations inline (image, caption, View in lesson link).
 * CitationsList still shows the same diagram in the evidence section.
 */
import React from "react";
import { Link } from "react-router-dom";
import { makeAbsoluteAssetUrl } from "../../utils/assetUrl";
import type { EnquiryCitation } from "../../api/enquiry";

const MAX_INLINE_DIAGRAMS = 2;

function getLessonLink(c: EnquiryCitation): string | null {
  if (c.sourceType !== "lessonDiagram") return null;
  const lid = c.lessonId ?? c.deepLink?.lessonId ?? c.sourceId;
  if (!lid) return null;
  const page = c.deepLink?.pageIndex ?? 0;
  const block = c.deepLink?.blockIndex ?? c.blockIndex;
  let url = `/lesson/${lid}?page=${page}`;
  if (block != null) url += `#block-${block}`;
  return url;
}

export function InlineDiagramBlock({
  citations,
  studentMode = false,
}: {
  citations: EnquiryCitation[];
  studentMode?: boolean;
}) {
  const diagrams = citations.filter(
    (c): c is Extract<EnquiryCitation, { sourceType: "lessonDiagram" }> =>
      c.sourceType === "lessonDiagram" && !!(c.imageUrl || c.deepLink?.imageUrl)
  ).slice(0, MAX_INLINE_DIAGRAMS);

  if (diagrams.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
      {diagrams.map((c, i) => {
        const imageUrl = c.imageUrl ?? c.deepLink?.imageUrl;
        const caption = c.caption ?? c.deepLink?.caption;
        const linkTarget = getLessonLink(c);

        if (!imageUrl) return null;

        const resolvedUrl = makeAbsoluteAssetUrl(imageUrl) || imageUrl;

        return (
          <div
            key={i}
            className="ai-diagram"
            style={{
              padding: 12,
              background: "#f8fafc",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
            }}
          >
            <img
              src={resolvedUrl}
              alt={caption || "Diagram"}
              style={{
                maxWidth: "100%",
                maxHeight: 200,
                objectFit: "contain",
                borderRadius: 8,
                display: "block",
              }}
            />
            {caption && (
              <div style={{ fontSize: 13, color: "#475569", marginTop: 8 }}>{caption}</div>
            )}
            {linkTarget && (
              <Link
                to={linkTarget}
                target={studentMode ? undefined : "_blank"}
                rel={studentMode ? undefined : "noopener noreferrer"}
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  fontSize: 13,
                  color: studentMode ? "#16a34a" : "#0284c7",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                View in lesson →
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
