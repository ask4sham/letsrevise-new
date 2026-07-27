/**
 * Student My Work — status-first accordion layout (Phase 1).
 * Organises existing GET /api/student/my-work attempt data only.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getStudentMyWork, type MyWorkResponse } from "../api/studentMyWork";
import {
  firstNonEmptySection,
  groupMyWorkItems,
  MY_WORK_SECTION_ORDER,
  normalizeMyWorkItems,
  resolvePrimaryAction,
  type ClassifiedMyWorkItem,
  type MyWorkSectionId,
  type MyWorkStatusBadge,
} from "../utils/classifyMyWorkItem";
import "./StudentMyWorkPage.css";

type TypeFilter = "all" | "worksheet" | "quiz" | "assessment";

const SECTION_COPY: Record<
  MyWorkSectionId,
  { title: string; hint: string; className: string }
> = {
  attention: {
    title: "Needs your attention",
    hint: "Overdue or due within 48 hours",
    className: "my-work-section--attention",
  },
  in_progress: {
    title: "In progress",
    hint: "Active work that is not due soon",
    className: "my-work-section--in_progress",
  },
  waiting: {
    title: "Waiting for results",
    hint: "Submitted and waiting for release",
    className: "my-work-section--waiting",
  },
  completed: {
    title: "Completed & results",
    hint: "Released work and scores",
    className: "my-work-section--completed",
  },
};

const TYPE_LABEL: Record<"worksheet" | "quiz" | "assessment", string> = {
  worksheet: "Worksheet",
  quiz: "Quiz",
  assessment: "Assessment",
};

function badgeClass(badge: MyWorkStatusBadge): string {
  if (badge === "Overdue") return "my-work-badge my-work-badge--status my-work-badge--overdue";
  if (badge === "Due soon") return "my-work-badge my-work-badge--status my-work-badge--due-soon";
  if (badge === "Waiting for results") return "my-work-badge my-work-badge--status my-work-badge--waiting";
  if (badge === "Released") return "my-work-badge my-work-badge--status my-work-badge--released";
  return "my-work-badge my-work-badge--status";
}

function formatDue(dueAt: string | null): string | null {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString();
}

function MyWorkTypeFilters({
  filter,
  counts,
  onChange,
}: {
  filter: TypeFilter;
  counts: { all: number; worksheet: number; quiz: number; assessment: number };
  onChange: (next: TypeFilter) => void;
}) {
  const chips: Array<{ id: TypeFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: counts.all },
    { id: "worksheet", label: "Worksheets", count: counts.worksheet },
    { id: "quiz", label: "Quizzes", count: counts.quiz },
    { id: "assessment", label: "Assessments", count: counts.assessment },
  ];

  return (
    <div className="my-work__filters" role="group" aria-label="Filter by work type">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className="my-work__filter"
          aria-pressed={filter === chip.id}
          onClick={() => onChange(chip.id)}
        >
          {chip.label} ({chip.count})
        </button>
      ))}
    </div>
  );
}

function MyWorkItemCard({ item }: { item: ClassifiedMyWorkItem }) {
  const action = resolvePrimaryAction(item);
  const due = formatDue(item.dueAt);
  const scoreText =
    item.released && item.score != null && item.maxScore != null
      ? `Score ${item.score} / ${item.maxScore}`
      : null;

  const metaParts = [due ? `Due ${due}` : null, scoreText].filter(Boolean);

  return (
    <li className="my-work-item" aria-labelledby={`my-work-item-title-${item.workType}-${item.id}`}>
      <div className="my-work-item__main">
        <div className="my-work-item__badges">
          <span className="my-work-badge my-work-badge--type">{TYPE_LABEL[item.workType]}</span>
          <span className={badgeClass(item.badge)}>{item.badge}</span>
        </div>
        <h3
          id={`my-work-item-title-${item.workType}-${item.id}`}
          className="my-work-item__title"
        >
          {item.title}
        </h3>
        {metaParts.length > 0 && (
          <p className="my-work-item__meta">{metaParts.join(" · ")}</p>
        )}
      </div>
      <div className="my-work-item__actions">
        <Link className="my-work-item__action my-work-item__action--primary" to={action.to}>
          {action.label}
        </Link>
        {action.secondary && (
          <Link
            className="my-work-item__action my-work-item__action--secondary"
            to={action.secondary.to}
          >
            {action.secondary.label}
          </Link>
        )}
      </div>
    </li>
  );
}

function MyWorkStatusAccordion({
  sectionId,
  items,
  expanded,
  onToggle,
}: {
  sectionId: MyWorkSectionId;
  items: ClassifiedMyWorkItem[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const copy = SECTION_COPY[sectionId];
  const panelId = `my-work-panel-${sectionId}`;
  const headerId = `my-work-header-${sectionId}`;

  return (
    <section className={`my-work-section ${copy.className}`} aria-labelledby={headerId}>
      <button
        id={headerId}
        type="button"
        className="my-work-section__header"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="my-work-section__heading">
          <span className="my-work-section__title">
            {copy.title} ({items.length})
          </span>
          <span className="my-work-section__meta">{copy.hint}</span>
        </span>
        <svg
          className="my-work-section__chevron"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className="my-work-section__panel"
        hidden={!expanded}
      >
        <ul className="my-work-section__list">
          {items.map((item) => (
            <MyWorkItemCard key={`${item.workType}-${item.id}`} item={item} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function friendlyErrorMessage(err: unknown): string {
  const raw =
    (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
      ?.error ||
    (err as { message?: string })?.message ||
    "";
  if (!raw) return "We could not load your work. Please try again.";
  // Avoid dumping stacks / internal paths
  if (/stack|at Object\.|ECONNREFUSED|Mongo|Internal/i.test(raw) || raw.length > 160) {
    return "We could not load your work. Please try again.";
  }
  return raw;
}

export default function StudentMyWorkPage() {
  const [data, setData] = useState<MyWorkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TypeFilter>("all");
  /** null = use automatic first-non-empty expansion for current filter */
  const [expandedOverride, setExpandedOverride] = useState<Partial<
    Record<MyWorkSectionId, boolean>
  > | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentMyWork();
      setData(res);
      setFilter("all");
      setExpandedOverride(null);
    } catch (e: unknown) {
      setData(null);
      setError(friendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allItems = useMemo(
    () => (data ? normalizeMyWorkItems(data) : []),
    [data]
  );

  const counts = useMemo(() => {
    const worksheet = allItems.filter((i) => i.workType === "worksheet").length;
    const quiz = allItems.filter((i) => i.workType === "quiz").length;
    const assessment = allItems.filter((i) => i.workType === "assessment").length;
    return {
      all: allItems.length,
      worksheet,
      quiz,
      assessment,
    };
  }, [allItems]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return allItems;
    return allItems.filter((i) => i.workType === filter);
  }, [allItems, filter]);

  const groups = useMemo(() => groupMyWorkItems(filteredItems), [filteredItems]);

  const expanded = useMemo(() => {
    if (expandedOverride) return expandedOverride;
    const first = firstNonEmptySection(groups);
    const next: Partial<Record<MyWorkSectionId, boolean>> = {};
    for (const id of MY_WORK_SECTION_ORDER) {
      next[id] = id === first;
    }
    return next;
  }, [expandedOverride, groups]);

  const setFilterAndResetExpand = (next: TypeFilter) => {
    setFilter(next);
    setExpandedOverride(null);
  };

  const toggleSection = (sectionId: MyWorkSectionId) => {
    setExpandedOverride((prev) => {
      const base = prev ?? expanded;
      return {
        ...base,
        [sectionId]: !base[sectionId],
      };
    });
  };

  const visibleSections = MY_WORK_SECTION_ORDER.filter((id) => groups[id].length > 0);
  const pageEmpty = !loading && !error && allItems.length === 0;
  const filterEmpty = !loading && !error && allItems.length > 0 && filteredItems.length === 0;

  return (
    <div className="my-work">
      <Link to="/student-dashboard" className="my-work__back">
        ← Back to Dashboard
      </Link>
      <h1 className="my-work__title">My Work</h1>
      <p className="my-work__subtitle">
        Pick up work in progress, check deadlines and view released results.
      </p>

      {!loading && !error && allItems.length > 0 && (
        <MyWorkTypeFilters filter={filter} counts={counts} onChange={setFilterAndResetExpand} />
      )}

      {loading && (
        <div className="my-work__loading" role="status" aria-live="polite">
          Loading your work…
        </div>
      )}

      {error && (
        <div className="my-work__error" role="alert">
          <div>{error}</div>
          <div className="my-work__error-actions">
            <button type="button" className="my-work__retry" onClick={() => void load()}>
              Try again
            </button>
          </div>
        </div>
      )}

      {pageEmpty && (
        <div className="my-work__empty">
          <h2 className="my-work__empty-title">No work here yet</h2>
          <p className="my-work__empty-copy">
            When you begin a worksheet, quiz or assessment, it will appear here.
          </p>
          <Link to="/browse-lessons" className="my-work__cta">
            Browse lessons
          </Link>
        </div>
      )}

      {filterEmpty && (
        <div className="my-work__empty">
          <h2 className="my-work__empty-title">
            {filter === "worksheet" && "No worksheets here yet."}
            {filter === "quiz" && "No quizzes here yet."}
            {filter === "assessment" && "No assessments here yet."}
          </h2>
          <p className="my-work__empty-copy">Try another filter or browse lessons to practise.</p>
          <Link to="/browse-lessons" className="my-work__cta">
            Browse lessons
          </Link>
        </div>
      )}

      {!loading && !error && visibleSections.length > 0 && (
        <div className="my-work__sections">
          {visibleSections.map((sectionId) => (
            <MyWorkStatusAccordion
              key={sectionId}
              sectionId={sectionId}
              items={groups[sectionId]}
              expanded={!!expanded[sectionId]}
              onToggle={() => toggleSection(sectionId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
