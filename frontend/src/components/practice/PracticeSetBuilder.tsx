/**
 * Practice setup — unified panel: class → course → topic → Start.
 * No Teacher ID / Student ID in the normal student UI.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SpecSelector } from "../SpecSelector";
import { getTaxonomyTopicsFlat, type SpecKey } from "../../api/taxonomy";
import { useTaxonomy } from "../../hooks/useTaxonomy";
import type { StudentClassMembershipSummary } from "../../api/studentClasses";

export type PracticeSetBuilderProps = {
  memberships: StudentClassMembershipSummary[];
  membershipsLoading: boolean;
  membershipsError: string | null;
  onRetryMemberships: () => void;
  selectedMembershipPublicId: string;
  onMembershipChange: (membershipPublicId: string) => void;
  specKey: SpecKey;
  onSpecKeyChange: (v: SpecKey) => void;
  topicKeys: string[];
  onTopicKeysChange: (v: string[]) => void;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
};

type StepId = "class" | "course" | "topic";

function membershipLabel(m: StudentClassMembershipSummary): string {
  const bits = [m.class.name];
  const meta = m.class.board || m.class.subject;
  if (meta && !m.class.name.toLowerCase().includes(String(meta).toLowerCase())) {
    bits.push(meta);
  }
  bits.push(m.teacher.displayName);
  return bits.join(" — ");
}

function resolveStepStates(args: {
  classComplete: boolean;
  courseComplete: boolean;
  topicComplete: boolean;
}): Record<StepId, "complete" | "current" | "upcoming"> {
  const { classComplete, courseComplete, topicComplete } = args;

  if (classComplete && courseComplete && topicComplete) {
    return { class: "complete", course: "complete", topic: "complete" };
  }

  let current: StepId = "class";
  if (!classComplete) current = "class";
  else if (!courseComplete) current = "course";
  else current = "topic";

  const stateFor = (id: StepId, complete: boolean): "complete" | "current" | "upcoming" => {
    if (id === current) return complete ? "complete" : "current";
    if (complete) return "complete";
    return "upcoming";
  };

  return {
    class: stateFor("class", classComplete),
    course: stateFor("course", courseComplete),
    topic: stateFor("topic", topicComplete),
  };
}

export function PracticeSetBuilder({
  memberships,
  membershipsLoading,
  membershipsError,
  onRetryMemberships,
  selectedMembershipPublicId,
  onMembershipChange,
  specKey,
  onSpecKeyChange,
  topicKeys,
  onTopicKeysChange,
  onGenerate,
  generating,
  error,
}: PracticeSetBuilderProps) {
  const { data: taxonomy } = useTaxonomy(specKey);
  const [topicInput, setTopicInput] = useState("");
  const [topicError, setTopicError] = useState<string | null>(null);
  const [simpleTopicKey, setSimpleTopicKey] = useState("");

  const topicOptions = useMemo(() => {
    return getTaxonomyTopicsFlat(taxonomy)
      .filter((t) => t?.key)
      .map((t) => ({ key: t.key, label: t.topic || t.key }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [taxonomy]);

  const prefix = `${specKey}:`;
  const selectedMembership = memberships.find(
    (m) => m.membershipPublicId === selectedMembershipPublicId
  );

  useEffect(() => {
    setSimpleTopicKey("");
  }, [specKey]);

  useEffect(() => {
    if (topicKeys.length === 1 && topicKeys[0].startsWith(prefix)) {
      setSimpleTopicKey(topicKeys[0].slice(prefix.length));
    }
  }, [topicKeys, prefix]);

  const applySimpleTopic = (slug: string) => {
    setSimpleTopicKey(slug);
    if (!slug.trim()) {
      onTopicKeysChange([]);
      return;
    }
    onTopicKeysChange([`${prefix}${slug}`]);
  };

  const addTopic = () => {
    const trimmed = topicInput.trim();
    setTopicError(null);
    if (!trimmed) return;
    if (!trimmed.startsWith(prefix)) {
      setTopicError(`Topic must start with ${prefix}`);
      return;
    }
    const slug = trimmed.slice(prefix.length);
    if (!slug) {
      setTopicError("Topic key must have a slug after the colon");
      return;
    }
    if (topicKeys.includes(trimmed)) {
      setTopicError("Already added");
      return;
    }
    onTopicKeysChange([...topicKeys, trimmed]);
    setTopicInput("");
  };

  const removeTopic = (idx: number) => {
    onTopicKeysChange(topicKeys.filter((_, i) => i !== idx));
  };

  const classComplete = !!selectedMembershipPublicId;
  const courseComplete = !!specKey;
  const topicComplete = topicKeys.length > 0;
  const stepStates = resolveStepStates({ classComplete, courseComplete, topicComplete });

  const canStart =
    !!selectedMembershipPublicId && topicKeys.length > 0 && !generating && !membershipsLoading;

  let disabledHint: string | null = null;
  if (!membershipsLoading && !membershipsError) {
    if (memberships.length === 0) {
      disabledHint = "Accept a teacher invitation before starting teacher-linked Practice.";
    } else if (!selectedMembershipPublicId) {
      disabledHint = "Select a class to continue.";
    } else if (topicKeys.length === 0) {
      disabledHint = "Select a topic to continue.";
    }
  }

  const stepperSteps: Array<{ id: StepId; label: string; n: number }> = [
    { id: "class", label: "Class", n: 1 },
    { id: "course", label: "Course", n: 2 },
    { id: "topic", label: "Topic", n: 3 },
  ];

  return (
    <div className="practice-setup" data-testid="practice-setup-panel">
      <div className="practice-setup__panel-head">
        <h2 className="practice-setup__panel-title">Practice setup</h2>
        <p className="practice-setup__panel-sub">Choose a class, course and topic.</p>
      </div>

      <ol className="practice-setup__progress" aria-label="Practice setup progress">
        {stepperSteps.map((step) => {
          const state = stepStates[step.id];
          const stateLabel =
            state === "complete" ? "completed" : state === "current" ? "current" : "upcoming";
          return (
            <li
              key={step.id}
              className={`practice-setup__progress-item practice-setup__progress-item--${step.id} practice-setup__progress-item--${state}`}
              data-testid={`practice-stepper-${step.id}`}
              data-state={state}
            >
              <span
                className="practice-setup__progress-seg"
                aria-current={state === "current" ? "step" : undefined}
              >
                <span className="practice-setup__progress-mark" aria-hidden="true">
                  {state === "complete" ? "✓" : step.n}
                </span>
                <span className="practice-setup__progress-label">{step.label}</span>
                <span className="practice-setup__sr-only">{stateLabel}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <section
        className="practice-setup__row practice-setup__row--class"
        aria-labelledby="practice-step-class"
        data-testid="practice-row-class"
      >
        <div className="practice-setup__rail" aria-hidden="true">
          <span className="practice-setup__rail-num">1</span>
          <span className="practice-setup__rail-name">Class</span>
        </div>
        <div className="practice-setup__body">
          <h3 id="practice-step-class" className="practice-setup__row-title">
            Practice with class
          </h3>
          <p className="practice-setup__row-help">
            Choose the teacher and class for this practice set.
          </p>

          {membershipsLoading && (
            <p className="practice-setup__meta" role="status" aria-live="polite">
              Loading your classes…
            </p>
          )}

          {!membershipsLoading && membershipsError && (
            <div className="practice-setup__error" role="alert">
              <p>{membershipsError}</p>
              <button
                type="button"
                className="practice-setup__btn practice-setup__btn--secondary"
                onClick={onRetryMemberships}
              >
                Try again
              </button>
            </div>
          )}

          {!membershipsLoading && !membershipsError && memberships.length === 0 && (
            <div className="practice-setup__empty">
              <p className="practice-setup__empty-title">You have not joined a class yet.</p>
              <p>Accept a teacher invitation before starting teacher-linked Practice.</p>
              <Link to="/student/classes" className="practice-setup__btn practice-setup__btn--primary">
                View my classes
              </Link>
            </div>
          )}

          {!membershipsLoading && !membershipsError && memberships.length > 0 && (
            <div className="practice-setup__controls">
              <label htmlFor="practice-class" className="practice-setup__label">
                Class
              </label>
              <select
                id="practice-class"
                value={selectedMembershipPublicId}
                onChange={(e) => onMembershipChange(e.target.value)}
                className="practice-setup__select"
              >
                {memberships.length > 1 && <option value="">Select a class…</option>}
                {memberships.map((m) => (
                  <option key={m.membershipPublicId} value={m.membershipPublicId}>
                    {membershipLabel(m)}
                  </option>
                ))}
              </select>
              {selectedMembership && (
                <p className="practice-setup__chip" aria-live="polite">
                  Selected: <strong>{selectedMembership.class.name}</strong>
                  {" · "}
                  {selectedMembership.teacher.displayName}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <section
        className="practice-setup__row practice-setup__row--course"
        aria-labelledby="practice-step-course"
        data-testid="practice-row-course"
      >
        <div className="practice-setup__rail" aria-hidden="true">
          <span className="practice-setup__rail-num">2</span>
          <span className="practice-setup__rail-name">Course</span>
        </div>
        <div className="practice-setup__body">
          <h3 id="practice-step-course" className="practice-setup__row-title">
            Course
          </h3>
          <p className="practice-setup__row-help">Confirm the course for this practice set.</p>
          <div className="practice-setup__controls">
            <SpecSelector
              value={specKey}
              onChange={onSpecKeyChange}
              label="Course"
              id="practice-course"
              className="practice-setup__spec"
            />
          </div>
        </div>
      </section>

      <section
        className="practice-setup__row practice-setup__row--topic"
        aria-labelledby="practice-step-topic"
        data-testid="practice-topic-card"
      >
        <div className="practice-setup__rail" aria-hidden="true">
          <span className="practice-setup__rail-num">3</span>
          <span className="practice-setup__rail-name">Topic</span>
        </div>
        <div className="practice-setup__body">
          <h3 id="practice-step-topic" className="practice-setup__row-title">
            Topic
          </h3>
          <p className="practice-setup__row-help">Choose what you want to practise.</p>

          <div className="practice-setup__controls">
            <label htmlFor="practice-topic" className="practice-setup__label">
              Topic
            </label>
            <select
              id="practice-topic"
              value={simpleTopicKey}
              onChange={(e) => applySimpleTopic(e.target.value)}
              className="practice-setup__select"
              disabled={!selectedMembershipPublicId && memberships.length > 0}
            >
              <option value="">Select a topic…</option>
              {topicOptions.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="practice-setup__help">Topics match your selected course.</p>

            <details className="practice-setup__optional">
              <summary>
                <span className="practice-setup__optional-chevron" aria-hidden="true" />
                Optional topic filters
              </summary>
              <div className="practice-setup__optional-body">
                <label className="practice-setup__label" htmlFor="practice-topic-code">
                  Add topic by code
                </label>
                <div className="practice-setup__inline">
                  <input
                    id="practice-topic-code"
                    type="text"
                    value={topicInput}
                    onChange={(e) => {
                      setTopicInput(e.target.value);
                      setTopicError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
                    placeholder={`e.g. ${specKey}:cell-structure`}
                    className="practice-setup__input"
                  />
                  <button
                    type="button"
                    onClick={addTopic}
                    className="practice-setup__btn practice-setup__btn--secondary"
                  >
                    Add topic
                  </button>
                </div>
                {topicError && (
                  <p className="practice-setup__field-error" role="alert">
                    {topicError}
                  </p>
                )}
                {topicKeys.length > 0 && (
                  <ul className="practice-setup__chips">
                    {topicKeys.map((tk, i) => (
                      <li key={`${tk}-${i}`}>
                        <span>{tk}</span>
                        <button
                          type="button"
                          onClick={() => removeTopic(i)}
                          aria-label={`Remove ${tk}`}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          </div>
        </div>
      </section>

      {error && (
        <div className="practice-setup__panel-error" role="alert">
          {error}
        </div>
      )}

      <div className="practice-setup__footer" data-testid="practice-action-footer">
        <p className="practice-setup__footer-hint" id="practice-start-hint">
          {generating ? "Starting your practice set…" : disabledHint || "Ready when you are."}
        </p>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canStart}
          className="practice-setup__btn practice-setup__btn--primary practice-setup__btn--start"
          aria-describedby="practice-start-hint"
          aria-busy={generating || undefined}
        >
          {generating ? "Starting…" : "Start practice"}
        </button>
      </div>
    </div>
  );
}
