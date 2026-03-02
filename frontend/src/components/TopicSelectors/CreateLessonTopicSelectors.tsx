/**
 * Shared Subject → Spec → Main topic → Sub-topic dropdowns for Create Lesson and Generate with AI.
 * Uses taxonomy from /api/taxonomy/create-lesson-options. Outputs topicKey (namespaced) and topic (display).
 */
import React from "react";
import type { CreateLessonOptionsResponse } from "../../api/taxonomy";

export type TopicSelectionValue = {
  subject: string;
  specKey: string;
  mainTopicTitle: string;
  topicKey: string;
  topic: string;
};

export type TopicSelectorCells = {
  subject: React.ReactNode;
  spec: React.ReactNode;
  mainTopic: React.ReactNode;
  subTopic: React.ReactNode;
  topicDisplay: React.ReactNode;
  /** When renderGridCells is used, parent should render this (e.g. full-width below grid) */
  errorNode: React.ReactNode;
};

type Props = {
  options: CreateLessonOptionsResponse | null;
  loading: boolean;
  error: string | null;
  value: TopicSelectionValue;
  onChange: (value: TopicSelectionValue) => void;
  /** Show "Topic (display)" text input; default true */
  showTopicDisplay?: boolean;
  /** Inline styles for container / selects (optional) */
  style?: React.CSSProperties;
  selectStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  /** Grid layout: "grid" (default) or "stack" */
  layout?: "grid" | "stack";
  /** Fallback subject options when options load empty (e.g. API failed) */
  fallbackSubjects?: string[];
  /** When set, render these cells so parent can place them in an SS2 grid. Parent receives { subject, spec, mainTopic, subTopic, topicDisplay }. */
  renderGridCells?: (cells: TopicSelectorCells) => React.ReactNode;
};

const defaultSelectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1.5px solid rgba(15,23,42,0.22)",
  background: "rgba(255,255,255,0.95)",
  outline: "none",
};

const defaultLabelStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "0.8125rem",
  color: "#475569",
  marginBottom: 4,
  display: "block",
};

export function CreateLessonTopicSelectors({
  options,
  loading,
  error,
  value,
  onChange,
  showTopicDisplay = true,
  style,
  selectStyle,
  labelStyle,
  layout = "grid",
  fallbackSubjects = [
    "Biology",
    "Chemistry",
    "Physics",
    "Mathematics",
    "English Language",
    "English Literature",
  ],
  renderGridCells,
}: Props) {
  const subjects = options?.subjects ?? [];
  const useFallback = subjects.length === 0 && !loading;
  const subjectList = useFallback ? fallbackSubjects.map((s) => ({ subject: s })) : subjects;

  const currentSubject = subjects.find((s) => s.subject === value.subject);
  const currentSpec = currentSubject?.specs?.find((s) => s.specKey === value.specKey);
  const currentMainTopic = currentSpec?.mainTopics?.find((m) => m.title === value.mainTopicTitle);
  const subTopicOptions = currentMainTopic?.subTopics ?? [];

  const selectCss = { ...defaultSelectStyle, ...selectStyle };
  const labelCss = { ...defaultLabelStyle, ...labelStyle };

  const subjectField = (
    <label style={{ display: "block" }}>
      <span style={labelCss}>Subject *</span>
      <select
        value={loading ? "" : (useFallback ? value.subject : value.subject)}
        onChange={(e) => {
          const v = e.target.value;
          onChange({
            subject: v,
            specKey: "",
            mainTopicTitle: "",
            topicKey: "",
            topic: "",
          });
        }}
        style={selectCss}
        disabled={loading}
      >
        <option value="">{loading ? "Loading…" : "Select subject"}</option>
        {subjectList.map((s: { subject: string }) => (
          <option key={s.subject} value={s.subject}>
            {s.subject}
          </option>
        ))}
      </select>
    </label>
  );

  const specField = currentSubject ? (
    <label style={{ display: "block" }}>
      <span style={labelCss}>Spec</span>
      <select
        value={value.specKey}
        onChange={(e) => {
          const v = e.target.value;
          onChange({
            ...value,
            specKey: v,
            mainTopicTitle: "",
            topicKey: "",
            topic: "",
          });
        }}
        style={selectCss}
      >
        <option value="">Select spec</option>
        {currentSubject.specs.map((spec) => (
          <option key={spec.specKey} value={spec.specKey}>
            {spec.specLabel}
          </option>
        ))}
      </select>
    </label>
  ) : (
    <div />
  );

  const mainTopicField = currentSpec ? (
    <label style={{ display: "block" }}>
      <span style={labelCss}>Main topic</span>
      <select
        value={value.mainTopicTitle}
        onChange={(e) => {
          const v = e.target.value;
          onChange({
            ...value,
            mainTopicTitle: v,
            topicKey: "",
            topic: "",
          });
        }}
        style={selectCss}
      >
        <option value="">Select main topic</option>
        {currentSpec.mainTopics.map((m) => (
          <option key={m.title} value={m.title}>
            {m.title}
          </option>
        ))}
      </select>
    </label>
  ) : (
    <div />
  );

  const subTopicField = currentMainTopic ? (
    <label style={{ display: "block" }}>
      <span style={labelCss}>Sub-topic *</span>
      <select
        value={value.topicKey}
        onChange={(e) => {
          const topicKey = e.target.value;
          const sub = currentMainTopic.subTopics.find((s) => s.topicKey === topicKey);
          onChange({
            ...value,
            topicKey: topicKey || "",
            topic: sub?.title ?? "",
          });
        }}
        style={selectCss}
      >
        <option value="">Select sub-topic</option>
        {subTopicOptions.map((s) => (
          <option key={s.topicKey} value={s.topicKey}>
            {s.title}
          </option>
        ))}
      </select>
    </label>
  ) : (
    <div />
  );

  const topicDisplayField =
    showTopicDisplay ? (
      <label style={{ display: "block" }}>
        <span style={labelCss}>Topic (display) {value.topicKey ? "— from selection" : ""}</span>
        <input
          type="text"
          value={value.topic}
          onChange={(e) => onChange({ ...value, topic: e.target.value })}
          style={selectCss}
          placeholder="Set by sub-topic selection or type here"
        />
      </label>
    ) : null;

  const errorNode = error ? (
    <div
      style={{
        fontSize: "0.8125rem",
        color: "#b91c1c",
        marginBottom: 8,
      }}
    >
      {error} {showTopicDisplay ? "— you can still enter Topic below." : ""}
    </div>
  ) : null;

  if (renderGridCells) {
    return (
      <>
        {renderGridCells({
          subject: subjectField,
          spec: specField,
          mainTopic: mainTopicField,
          subTopic: subTopicField,
          topicDisplay: topicDisplayField,
          errorNode,
        })}
      </>
    );
  }

  const gridStyle: React.CSSProperties =
    layout === "grid"
      ? { display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }
      : { display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 };

  return (
    <div style={style}>
      <div style={gridStyle}>
        {subjectField}
        {specField}
        {mainTopicField}
        {subTopicField}
      </div>

      {error && (
        <div
          style={{
            gridColumn: "1 / -1",
            fontSize: "0.8125rem",
            color: "#b91c1c",
            marginBottom: 8,
          }}
        >
          {error} {showTopicDisplay ? "— you can still enter Topic below." : ""}
        </div>
      )}

      {showTopicDisplay && topicDisplayField}
    </div>
  );
}
