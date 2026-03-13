import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

type MisconceptionItem = {
  questionId: string;
  question?: string;
  marks?: number;
  topicKey?: string;
  topic?: string;
  type?: string;
  attempts: number;
  correct: number;
  wrong: number;
  accuracy: number | null;
  highConfidenceWrong: number;
  avgConfidence?: number;
};

type HotspotTopic = {
  topicKey: string;
  topic?: string;
  attempts: number;
  wrong: number;
  correct: number;
  highConfidenceWrong: number;
};

type Props = {
  lessonId: string | null;
  isPublished?: boolean;
  /** Default 7 */
  defaultDays?: number;
};

export function MisconceptionsCard({ lessonId, isPublished = false, defaultDays = 7 }: Props) {
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [misconceptionItems, setMisconceptionItems] = useState<MisconceptionItem[]>([]);
  const [hotspotTopics, setHotspotTopics] = useState<HotspotTopic[]>([]);
  const [insightsDays, setInsightsDays] = useState(defaultDays);
  const [attachedIds, setAttachedIds] = useState<Set<string>>(new Set());
  const [attachToast, setAttachToast] = useState<string | null>(null);
  const [attachingQuestionId, setAttachingQuestionId] = useState<string | null>(null);
  const [attachingTopicKey, setAttachingTopicKey] = useState<string | null>(null);
  const [fixingTopicKey, setFixingTopicKey] = useState<string | null>(null);
  const [fixErrorByTopic, setFixErrorByTopic] = useState<Record<string, string>>({});
  const [bulkFixLoading, setBulkFixLoading] = useState(false);
  const [bulkFixError, setBulkFixError] = useState<string | null>(null);
  const [attachByTopicToast, setAttachByTopicToast] = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId) {
      setMisconceptionItems([]);
      setHotspotTopics([]);
      setAttachedIds(new Set());
      return;
    }
    api.get(`/lessons/${lessonId}/exam-questions`).then((res) => {
      const questions = Array.isArray(res?.data?.questions) ? res.data.questions : [];
      setAttachedIds(new Set(questions.map((q: { _id?: string }) => String(q?._id ?? ""))));
    }).catch(() => setAttachedIds(new Set()));
  }, [lessonId]);

  useEffect(() => {
    if (!lessonId) {
      setInsightsLoading(false);
      setInsightsError(null);
      return;
    }
    let cancelled = false;
    setInsightsLoading(true);
    setInsightsError(null);
    api
      .get<{ ok: boolean; items?: MisconceptionItem[]; topics?: HotspotTopic[] }>(
        `/reports/lessons/${lessonId}/question-insights`,
        { params: { days: insightsDays, limit: 10 } }
      )
      .then((res) => {
        if (cancelled) return;
        if (res?.data?.ok) {
          setMisconceptionItems(Array.isArray(res.data.items) ? res.data.items : []);
          setHotspotTopics(Array.isArray(res.data.topics) ? res.data.topics : []);
        }
      })
      .catch((e: any) => {
        if (cancelled) return;
        const status = e?.response?.status;
        const msg = e?.response?.data?.error ?? e?.message ?? "Failed to load insights";
        setInsightsError(status === 403 ? "Insights are only available to the lesson owner." : msg);
        setMisconceptionItems([]);
        setHotspotTopics([]);
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => { cancelled = true; };
  }, [lessonId, insightsDays]);

  const refreshAttached = () => {
    if (!lessonId) return;
    api.get(`/lessons/${lessonId}/exam-questions`).then((res) => {
      const questions = Array.isArray(res?.data?.questions) ? res.data.questions : [];
      setAttachedIds(new Set(questions.map((q: { _id?: string }) => String(q?._id ?? ""))));
    }).catch(() => {});
  };

  if (!lessonId) {
    return (
      <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "2px solid rgba(0,0,0,0.08)", background: "#f8fafc" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Misconceptions (last 7 days)</div>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Select a lesson to view question insights and hotspots.</p>
      </div>
    );
  }

  if (!isPublished) {
    return (
      <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "2px solid rgba(0,0,0,0.08)", background: "#f8fafc" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Misconceptions (last {insightsDays} days)</div>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Publish to start collecting attempts.</p>
      </div>
    );
  }

  if (insightsLoading) {
    return (
      <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "2px solid rgba(0,0,0,0.08)", background: "#f8fafc" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Misconceptions (last {insightsDays} days)</div>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Loading insights…</p>
      </div>
    );
  }

  if (insightsError) {
    return (
      <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "2px solid rgba(0,0,0,0.08)", background: "#f8fafc" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Misconceptions (last {insightsDays} days)</div>
        <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{insightsError}</p>
      </div>
    );
  }

  if (misconceptionItems.length === 0 && hotspotTopics.length === 0) {
    return (
      <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "2px solid rgba(0,0,0,0.08)", background: "#f8fafc" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Misconceptions (last {insightsDays} days)</div>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>No practice attempts recorded yet.</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "2px solid rgba(0,0,0,0.08)", background: "#f8fafc" }}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>Misconceptions (last {insightsDays} days)</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>Period:</span>
        {([7, 14, 30] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setInsightsDays(d)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: insightsDays === d ? "2px solid #2563eb" : "1px solid #e2e8f0",
              background: insightsDays === d ? "rgba(37,99,235,0.1)" : "#fff",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {d} days
          </button>
        ))}
        <button
          type="button"
          disabled={fixingTopicKey !== null || bulkFixLoading}
          onClick={async () => {
            if (!lessonId) return;
            setBulkFixLoading(true);
            setBulkFixError(null);
            try {
              await api.post(`/reports/lessons/${lessonId}/one-click-fix-bulk`, {
                days: insightsDays,
                attachByTopic: true,
                attachLimitPerTopic: 10,
                regeneratePlan: true,
                planLimit: 10,
              });
              setAttachByTopicToast("Done");
              setTimeout(() => setAttachByTopicToast(null), 4000);
              refreshAttached();
            } catch (e: any) {
              setBulkFixError(e?.response?.data?.error || e?.response?.data?.message || "Failed to run bulk fix.");
            } finally {
              setBulkFixLoading(false);
            }
          }}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "2px solid #059669",
            background: bulkFixLoading || fixingTopicKey ? "#e5e7eb" : "rgba(5,150,105,0.12)",
            cursor: bulkFixLoading || fixingTopicKey ? "not-allowed" : "pointer",
            fontSize: 12,
            fontWeight: 600,
            color: "#047857",
          }}
        >
          {bulkFixLoading ? "Fixing…" : "Fix top hotspots (3)"}
        </button>
      </div>
      {bulkFixError && <div style={{ marginBottom: 8, fontSize: 12, color: "#dc2626" }}>{bulkFixError}</div>}
      {misconceptionItems.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#374151" }}>Top misconceptions</div>
          <ul style={{ margin: 0, paddingLeft: 16, listStyle: "none" }}>
            {misconceptionItems.map((item) => {
              const snippet = (item.question ?? "").slice(0, 120);
              const isAttached = attachedIds.has(item.questionId);
              const isAttaching = attachingQuestionId === item.questionId;
              return (
                <li key={item.questionId} style={{ marginBottom: 10, padding: 8, borderRadius: 6, background: "#fff", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}>{snippet}{snippet.length >= 120 ? "…" : ""}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                    High-conf wrong: {item.highConfidenceWrong} · Accuracy: {item.accuracy != null ? Math.round(item.accuracy * 100) : "—"}% · {item.topic ?? item.topicKey ?? "—"}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={isAttached || isAttaching}
                      onClick={async () => {
                        if (!lessonId) return;
                        setAttachingQuestionId(item.questionId);
                        try {
                          await api.post(`/lessons/${lessonId}/exam-questions`, { questionIds: [item.questionId] });
                          refreshAttached();
                          setAttachToast("Attached");
                          setTimeout(() => setAttachToast(null), 2500);
                        } finally {
                          setAttachingQuestionId(null);
                        }
                      }}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #22c55e",
                        background: isAttached ? "#e2e8f0" : "rgba(34,197,94,0.12)",
                        cursor: isAttached || isAttaching ? "not-allowed" : "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                        color: isAttached ? "#64748b" : "#166534",
                      }}
                    >
                      {isAttaching ? "Attaching…" : isAttached ? "Attached" : "Attach to lesson"}
                    </button>
                    <Link
                      to={item.topicKey ? `/teacher/exam-question-bank?topicKey=${encodeURIComponent(item.topicKey)}` : "/teacher/exam-question-bank"}
                      style={{ fontSize: 11, color: "#2563eb", fontWeight: 600 }}
                    >
                      Open in Question Bank
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          {attachToast && <div style={{ marginTop: 6, fontSize: 12, color: "#166534", fontWeight: 600 }}>{attachToast}</div>}
        </div>
      )}
      {hotspotTopics.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#374151" }}>Topic hot-spots</div>
          <ul style={{ margin: 0, paddingLeft: 16, listStyle: "none" }}>
            {hotspotTopics.map((t) => {
              const isAttaching = attachingTopicKey === t.topicKey;
              return (
                <li key={t.topicKey} style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#374151" }}>
                    {t.topic ?? t.topicKey} · Wrong {t.wrong}/{t.attempts}
                    {t.highConfidenceWrong > 0 && <span style={{ color: "#b91c1c", marginLeft: 4 }}>· High-conf wrong: {t.highConfidenceWrong}</span>}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={isAttaching}
                      onClick={async () => {
                        if (!lessonId) return;
                        setAttachingTopicKey(t.topicKey);
                        try {
                          const res = await api.post(`/lessons/${lessonId}/exam-questions/attach-by-topic`, { topicKey: t.topicKey, limit: 10 });
                          const added = res?.data?.added ?? 0;
                          refreshAttached();
                          setAttachByTopicToast(added > 0 ? `Added ${added} question${added !== 1 ? "s" : ""}` : "No new questions to add");
                          setTimeout(() => setAttachByTopicToast(null), 3000);
                        } finally {
                          setAttachingTopicKey(null);
                        }
                      }}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #94a3b8",
                        background: "#f1f5f9",
                        cursor: isAttaching ? "not-allowed" : "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#475569",
                      }}
                    >
                      {isAttaching ? "Attaching…" : "Attach top 10"}
                    </button>
                    <button
                      type="button"
                      disabled={fixingTopicKey === t.topicKey}
                      onClick={async () => {
                        if (!lessonId) return;
                        const topicKey = String(t.topicKey || "");
                        setFixingTopicKey(topicKey);
                        setFixErrorByTopic((prev) => ({ ...prev, [topicKey]: "" }));
                        try {
                          const res = await api.post(`/reports/lessons/${lessonId}/one-click-fix`, {
                            days: insightsDays,
                            topicKey,
                            attachByTopic: true,
                            attachLimit: 10,
                            regeneratePlan: true,
                            planLimit: 10,
                          });
                          if (!res?.data?.ok) {
                            setFixErrorByTopic((prev) => ({ ...prev, [topicKey]: "One-click fix failed" }));
                            return;
                          }
                          refreshAttached();
                          setAttachByTopicToast("Done");
                          setTimeout(() => setAttachByTopicToast(null), 4000);
                        } catch (e: any) {
                          const msg = e?.response?.data?.error || e?.response?.data?.message || "Failed to run one-click fix.";
                          setFixErrorByTopic((prev) => ({ ...prev, [topicKey]: msg }));
                        } finally {
                          setFixingTopicKey(null);
                        }
                      }}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "2px solid #059669",
                        background: "rgba(5,150,105,0.12)",
                        cursor: fixingTopicKey === t.topicKey ? "not-allowed" : "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#047857",
                      }}
                    >
                      {fixingTopicKey === t.topicKey ? "Fixing…" : "One-click fix"}
                    </button>
                  </div>
                  {fixErrorByTopic[t.topicKey] && (
                    <div style={{ width: "100%", fontSize: 11, color: "#dc2626", marginTop: 4 }}>{fixErrorByTopic[t.topicKey]}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {attachByTopicToast && <div style={{ marginTop: 6, fontSize: 12, color: "#166534", fontWeight: 600 }}>{attachByTopicToast}</div>}
        </div>
      )}
    </div>
  );
}
