import React, { useMemo, useState } from "react";
import {
  EMPTY_LEARNING_INTELLIGENCE_SUMMARY,
  safeDeriveLearningIntelligenceSummary,
  type LearningIntelligenceGroupedItem,
  type LearningIntelligenceSummary,
} from "../../utils/learningMeta";
import "./learningIntelligenceSummaryPanel.css";

export type LearningIntelligenceSummaryPanelProps = {
  pages: Array<{ blocks?: unknown[] }> | null | undefined;
  /** Expand detail sections by default when metadata exists. */
  defaultOpen?: boolean;
};

function SummarySection({
  title,
  items,
  emptyHint,
}: {
  title: string;
  items: LearningIntelligenceGroupedItem[];
  emptyHint: string;
}) {
  const safeItems = Array.isArray(items) ? items : [];
  return (
    <section className="lr-learning-intel__section">
      <h4 className="lr-learning-intel__section-title">{title}</h4>
      {safeItems.length === 0 ? (
        <p className="lr-learning-intel__empty">{emptyHint}</p>
      ) : (
        <ul className="lr-learning-intel__list">
          {safeItems.map((item, i) => (
            <li
              key={`${title}-${item?.label ?? "item"}-${i}`}
              className="lr-learning-intel__item"
            >
              <span className="lr-learning-intel__label">{String(item?.label ?? "")}</span>
              <span
                className="lr-learning-intel__count"
                aria-label={`${item?.count ?? 0} blocks`}
              >
                ×{Number(item?.count) > 0 ? item.count : 0}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DifficultyBalance({ summary }: { summary: LearningIntelligenceSummary }) {
  const balance = summary?.difficultyBalance ?? EMPTY_LEARNING_INTELLIGENCE_SUMMARY.difficultyBalance;
  const easy = Number(balance.easy) || 0;
  const medium = Number(balance.medium) || 0;
  const hard = Number(balance.hard) || 0;
  const unspecified = Number(balance.unspecified) || 0;
  const tagged = easy + medium + hard;
  if (tagged === 0 && unspecified === 0) {
    return <p className="lr-learning-intel__empty">No difficulty tags on blocks yet.</p>;
  }
  const rows = [
    { key: "easy", label: "Easy", count: easy, className: "lr-learning-intel__diff--easy" },
    { key: "medium", label: "Medium", count: medium, className: "lr-learning-intel__diff--medium" },
    { key: "hard", label: "Hard", count: hard, className: "lr-learning-intel__diff--hard" },
  ].filter((r) => r.count > 0);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="lr-learning-intel__difficulty">
      {rows.map((row) => (
        <div key={row.key} className="lr-learning-intel__diff-row">
          <span className={`lr-learning-intel__diff-label ${row.className}`}>{row.label}</span>
          <div className="lr-learning-intel__diff-bar-track" aria-hidden>
            <div
              className={`lr-learning-intel__diff-bar-fill ${row.className}`}
              style={{ width: `${Math.round((row.count / max) * 100)}%` }}
            />
          </div>
          <span className="lr-learning-intel__count">×{row.count}</span>
        </div>
      ))}
      {unspecified > 0 ? (
        <p className="lr-learning-intel__diff-note">
          {unspecified} block{unspecified === 1 ? "" : "s"} with metadata but no difficulty tag.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Teacher-only read-only panel: concepts, skills, misconceptions, exam skills, difficulty balance.
 * Not used in student lesson view. Must not throw — sidebar sections below depend on it.
 */
export function LearningIntelligenceSummaryPanel({
  pages,
  defaultOpen = false,
}: LearningIntelligenceSummaryPanelProps) {
  const safePages = useMemo(() => (Array.isArray(pages) ? pages : []), [pages]);
  const summary = useMemo(
    () => safeDeriveLearningIntelligenceSummary(safePages),
    [safePages]
  );
  const [expanded, setExpanded] = useState(defaultOpen || !summary.hasAnyMeta);

  const showBody = expanded || !summary.hasAnyMeta;
  const blocksWithMeta = Number(summary.blocksWithMeta) || 0;
  const totalBlocks = Number(summary.totalBlocks) || 0;

  return (
    <div
      className="lr-learning-intel"
      data-testid="learning-intelligence-panel"
      role="region"
      aria-label="Learning intelligence summary"
    >
      <button
        type="button"
        className="lr-learning-intel__header"
        aria-expanded={showBody}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="lr-learning-intel__header-leading">
          <span className="lr-learning-intel__chevron" aria-hidden />
          <span className="lr-learning-intel__title">Learning intelligence</span>
        </span>
        <span className="lr-learning-intel__badge">
          {summary.hasAnyMeta
            ? `${blocksWithMeta}/${totalBlocks} blocks`
            : "No metadata"}
        </span>
      </button>

      {showBody ? (
        <div className="lr-learning-intel__body">
          {!summary.hasAnyMeta ? (
            <p className="lr-learning-intel__placeholder">No learning metadata yet</p>
          ) : (
            <>
              <p className="lr-learning-intel__intro">
                Coverage from optional block <code>learningMeta</code> (read-only). Not shown to
                students.
              </p>
              <SummarySection
                title="Concepts covered"
                items={summary.concepts}
                emptyHint="No concepts tagged yet."
              />
              <SummarySection
                title="Skills practised"
                items={summary.skills}
                emptyHint="No skills tagged yet."
              />
              <SummarySection
                title="Misconception risks addressed"
                items={summary.misconceptionRisks}
                emptyHint="No misconception risks tagged yet."
              />
              <SummarySection
                title="Exam skills covered"
                items={summary.examSkills}
                emptyHint="No exam skills tagged yet."
              />
              <section className="lr-learning-intel__section">
                <h4 className="lr-learning-intel__section-title">Difficulty balance</h4>
                <DifficultyBalance summary={summary} />
              </section>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
