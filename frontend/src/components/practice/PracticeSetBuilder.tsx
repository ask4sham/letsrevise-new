/**
 * Practice setup — class → course → topic → Start.
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

function membershipLabel(m: StudentClassMembershipSummary): string {
  const bits = [m.class.name];
  const meta = m.class.board || m.class.subject;
  if (meta && !m.class.name.toLowerCase().includes(String(meta).toLowerCase())) {
    bits.push(meta);
  }
  bits.push(m.teacher.displayName);
  return bits.join(" — ");
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

  const applySimpleTopic = (slug: string) => {
    setSimpleTopicKey(slug);
    if (!slug.trim()) {
      onTopicKeysChange([]);
      return;
    }
    const full = `${prefix}${slug}`;
    onTopicKeysChange([full]);
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

  return (
    <div className="practice-setup">
      <p className="practice-setup__intro">
        Build a focused set of questions for your course and topic.
      </p>

      <section className="practice-setup__stage practice-setup__stage--class" aria-labelledby="practice-step-class">
        <h2 id="practice-step-class" className="practice-setup__stage-title">
          <span className="practice-setup__step">1</span> Practice with class
        </h2>

        {membershipsLoading && (
          <p className="practice-setup__meta" aria-live="polite">
            Loading your classes…
          </p>
        )}

        {!membershipsLoading && membershipsError && (
          <div className="practice-setup__error" role="alert">
            <p>{membershipsError}</p>
            <button type="button" className="practice-setup__btn practice-setup__btn--secondary" onClick={onRetryMemberships}>
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
          <>
            <label htmlFor="practice-class" className="practice-setup__label">
              Practice with class
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
              <p className="practice-setup__selected" aria-live="polite">
                Selected: <strong>{selectedMembership.class.name}</strong>
                {" · "}
                {selectedMembership.teacher.displayName}
              </p>
            )}
          </>
        )}
      </section>

      <section className="practice-setup__stage practice-setup__stage--course" aria-labelledby="practice-step-course">
        <h2 id="practice-step-course" className="practice-setup__stage-title">
          <span className="practice-setup__step">2</span> Course
        </h2>
        <div className="practice-setup__field">
          <SpecSelector value={specKey} onChange={onSpecKeyChange} />
        </div>
      </section>

      <section className="practice-setup__stage practice-setup__stage--topic" aria-labelledby="practice-step-topic">
        <h2 id="practice-step-topic" className="practice-setup__stage-title">
          <span className="practice-setup__step">3</span> Topic
        </h2>
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
          <summary>Optional topic filters</summary>
          <div className="practice-setup__optional-body">
            <label className="practice-setup__label" htmlFor="practice-topic-code">
              Add topic by code
            </label>
            <div className="practice-setup__row">
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
              <button type="button" onClick={addTopic} className="practice-setup__btn practice-setup__btn--secondary">
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
                    <button type="button" onClick={() => removeTopic(i)} aria-label={`Remove ${tk}`}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </section>

      {error && (
        <p className="practice-setup__error" role="alert">
          {error}
        </p>
      )}

      <div className="practice-setup__actions">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canStart}
          className="practice-setup__btn practice-setup__btn--primary practice-setup__btn--start"
        >
          {generating ? "Starting…" : "Start practice"}
        </button>
        {disabledHint && !generating && (
          <p className="practice-setup__help" id="practice-start-hint">
            {disabledHint}
          </p>
        )}
      </div>
    </div>
  );
}
