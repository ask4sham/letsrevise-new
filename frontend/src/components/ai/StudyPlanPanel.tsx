/**
 * PR-038: Today's study plan — personalised topic recommendations for students.
 */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStudyPlan, type StudyPlanItem } from "../../api/studyCoach";

const ACTION_LINK_STYLE: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #86efac",
  borderRadius: 6,
  textDecoration: "none",
  display: "inline-block",
};

/** Pathname only (no query/hash). */
function pathnameFromHref(href: string): string {
  if (!href) return "";
  if (href.startsWith("/")) {
    return href.split("?")[0].split("#")[0];
  }
  try {
    return new URL(href, window.location.origin).pathname;
  } catch {
    return "";
  }
}

/** Lesson id from /lesson/:id — stable compare for same-page Ask AI (avoids basename/trailing-slash mismatches). */
function lessonIdFromLessonHref(href: string): string | null {
  const p = pathnameFromHref(href).replace(/\/+$/, "");
  const m = p.match(/^\/lesson\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Scroll to student AskAiStudentPanel (#lesson-ask-ai-tutor). Retries while the panel is still mounting.
 */
function scrollToAskAiTutorAndFocus() {
  const maxAttempts = 80;
  let n = 0;
  const tryScroll = () => {
    const el = document.getElementById("lesson-ask-ai-tutor");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        document.getElementById("lesson-ask-ai-tutor-input")?.focus({ preventScroll: true });
      }, 450);
      return;
    }
    n += 1;
    if (n < maxAttempts) {
      window.setTimeout(tryScroll, 50);
    }
  };
  tryScroll();
}

interface StudyPlanPanelProps {
  specKey: string;
  /** Current lesson route id — when Ask AI href matches this lesson, use in-page scroll (no Link navigation). */
  currentLessonId?: string | null;
}

function topicKeyToTitle(topicKey: string): string {
  const last = topicKey.split(":").pop();
  return last ? last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : topicKey;
}

function statusLabel(status: string): string {
  if (status === "secure") return "Strong";
  if (status === "practising") return "Practising";
  if (status === "learning") return "Learning";
  return "New";
}

export function StudyPlanPanel({ specKey, currentLessonId }: StudyPlanPanelProps) {
  const [plan, setPlan] = useState<StudyPlanItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!specKey) return;
    setLoading(true);
    setError(null);
    getStudyPlan(specKey)
      .then((res) => setPlan(res.plan || []))
      .catch((err) => setError(err?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [specKey]);

  if (loading) {
    return (
      <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15, color: "#334155" }}>Today&apos;s study plan</div>
        <div style={{ color: "#64748b", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (error || !plan || plan.length === 0) {
    return null;
  }

  return (
    <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 15, color: "#334155" }}>Today&apos;s study plan</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {plan.slice(0, 3).map((item, i) => (
          <div
            key={item.topicKey}
            style={{
              padding: 12,
              background: "#fff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "#334155" }}>{topicKeyToTitle(item.topicKey)}</span>
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  background: item.masteryScore >= 70 ? "#dcfce7" : item.masteryScore >= 35 ? "#fef3c7" : "#fee2e2",
                  color: item.masteryScore >= 70 ? "#166534" : item.masteryScore >= 35 ? "#92400e" : "#991b1b",
                }}
              >
                {statusLabel(item.status)}
              </span>
            </div>
            <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, marginBottom: 8, overflow: "hidden" }}>
              <div
                style={{
                  width: `${item.masteryScore}%`,
                  height: "100%",
                  background: item.masteryScore >= 70 ? "#22c55e" : item.masteryScore >= 35 ? "#f59e0b" : "#ef4444",
                  borderRadius: 3,
                }}
              />
            </div>
            <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{item.reason}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {item.actions.slice(0, 4).map((a) => {
                const hrefLessonId = lessonIdFromLessonHref(a.href);
                const cur = currentLessonId != null && String(currentLessonId).trim() !== "" ? String(currentLessonId).trim() : null;
                const askAiSameLesson =
                  a.id === "ask-ai" &&
                  cur != null &&
                  hrefLessonId != null &&
                  hrefLessonId === cur;

                if (askAiSameLesson) {
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        scrollToAskAiTutorAndFocus();
                      }}
                      style={{
                        ...ACTION_LINK_STYLE,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {a.label}
                    </button>
                  );
                }
                return (
                  <Link key={a.id} to={a.href} style={ACTION_LINK_STYLE}>
                    {a.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
