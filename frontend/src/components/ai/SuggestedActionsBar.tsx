/**
 * PR-016b: Shared "Next steps" UI — consistent styling, Do now vs Go to grouping,
 * tutor-like flow (lesson same-tab, bank/tools new-tab for teacher).
 */
import React from "react";
import { Link } from "react-router-dom";
import type { SuggestedAction } from "../../api/enquiry";

type Props = {
  actions: SuggestedAction[];
  mode: "teacher" | "student";
  onIntent?: (payload: unknown) => void;
  onActionClick?: (actionId: string) => void;
};

const pillBase = {
  padding: "6px 12px",
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 20,
  cursor: "pointer" as const,
  textDecoration: "none" as const,
  display: "inline-flex" as const,
  alignItems: "center" as const,
  gap: 6,
};

const teacherPill = {
  ...pillBase,
  background: "#e0f2fe",
  color: "#0369a1",
  border: "1px solid #7dd3fc",
};

const studentPill = {
  ...pillBase,
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #86efac",
};

export function SuggestedActionsBar({
  actions,
  mode,
  onIntent,
  onActionClick,
}: Props) {
  const pill = mode === "teacher" ? teacherPill : studentPill;
  const intentActions = actions.filter((a) => a.type === "intent");
  const linkActions = actions.filter((a) => a.type === "link");

  const handleIntent = (action: SuggestedAction) => {
    onActionClick?.(action.id);
    onIntent?.(action.payload ?? {});
  };

  const handleLinkClick = (action: SuggestedAction) => {
    onActionClick?.(action.id);
  };

  const getLinkProps = (href: string) => {
    if (mode === "student") return { target: undefined, rel: undefined };
    // Teacher: lesson same-tab, bank/coverage/sprint new-tab
    if (href.startsWith("/lesson")) return { target: undefined, rel: undefined };
    return { target: "_blank" as const, rel: "noopener noreferrer" as const };
  };

  const renderPillGroup = (items: SuggestedAction[], groupLabel: string) => {
    if (items.length === 0) return null;
    return (
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 6,
          }}
        >
          {groupLabel}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {items.map((action) => {
            const titleAttr = action.description ? { title: action.description } : {};
            let content: React.ReactNode = null;
            if (action.type === "intent") {
              content = (
                <button
                  type="button"
                  onClick={() => handleIntent(action)}
                  style={pill}
                  {...titleAttr}
                >
                  {action.label}
                </button>
              );
            } else if (action.type === "link" && action.href) {
              const { target, rel } = getLinkProps(action.href);
              content = (
                <Link
                  to={action.href}
                  target={target}
                  rel={rel}
                  onClick={() => handleLinkClick(action)}
                  style={pill}
                  {...titleAttr}
                >
                  {action.label}
                </Link>
              );
            }
            if (!content) return null;
            if (action.description) {
              return (
                <div
                  key={action.id}
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}
                >
                  {content}
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{action.description}</span>
                </div>
              );
            }
            return <React.Fragment key={action.id}>{content}</React.Fragment>;
          })}
        </div>
      </div>
    );
  };

  if (actions.length === 0) return null;

  return (
    <div style={{ marginTop: 16, marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14, color: mode === "teacher" ? "#334155" : "#166534" }}>
        Next steps
      </div>
      {renderPillGroup(intentActions, "Do now")}
      {renderPillGroup(linkActions, "Go to")}
    </div>
  );
}
