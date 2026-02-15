// frontend/src/pages/AdminMetricsPage.tsx — Paywall conversion metrics (admin only)
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

const DAYS = 7;

async function setFreePreview(
  lessonId: string,
  isFreePreview: boolean,
  note?: string
) {
  const body: { isFreePreview: boolean; note?: string } = { isFreePreview };
  if (note != null && String(note).trim()) body.note = String(note).trim().slice(0, 200);
  await api.post(`/admin/lessons/${lessonId}/set-free-preview`, body);
}

interface ConversionResponse {
  ok: boolean;
  days: number;
  since: string;
  totals: {
    PAYWALL_NOT_ENTITLED: number;
    FREE_PREVIEW_VIEW: number;
    SUBSCRIBE_CTA_CLICK: number;
  };
  ctr: number | null;
  previewToClick: number | null;
  daily: Array<{
    day: string;
    PAYWALL_NOT_ENTITLED: number;
    FREE_PREVIEW_VIEW: number;
    SUBSCRIBE_CTA_CLICK: number;
  }>;
}

interface TopPaywalledResponse {
  ok: boolean;
  days: number;
  since: string;
  limit: number;
  lessons: Array<{
    lessonId: string;
    count: number;
    title: string | null;
    isFreePreview: boolean | null;
  }>;
}

type SuggestedPreviewItem = {
  lessonId: string;
  count: number;
  title: string | null;
  isFreePreview: boolean | null;
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "white",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1.25rem",
  boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
};

const AdminMetricsPage: React.FC = () => {
  const [conversion, setConversion] = useState<ConversionResponse | null>(null);
  const [topPaywalled, setTopPaywalled] = useState<TopPaywalledResponse | null>(null);
  const [suggestedPreviews, setSuggestedPreviews] = useState<SuggestedPreviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [suggestedNote, setSuggestedNote] = useState<Record<string, string>>({});

  const loadMetrics = useCallback(async () => {
    const [convRes, topRes, suggestedRes] = await Promise.all([
      api.get<ConversionResponse>(`/admin/metrics/conversion?days=${DAYS}`),
      api.get<TopPaywalledResponse>(`/admin/metrics/top-paywalled-lessons?days=${DAYS}&limit=20`),
      api.get<{ ok: boolean; lessons: SuggestedPreviewItem[] }>(
        `/admin/metrics/top-paywalled-lessons-without-preview?days=${DAYS}&limit=20`
      ),
    ]);
    setConversion(convRes.data);
    setTopPaywalled(topRes.data);
    setSuggestedPreviews(suggestedRes.data?.lessons ?? []);
  }, [DAYS]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setError(null);
        await loadMetrics();
        if (!mounted) return;
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.response?.data?.error || err?.message || "Failed to load metrics");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadMetrics]);

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading metrics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
        <p style={{ color: "#c00" }}>{error}</p>
        <Link to="/admin" style={{ display: "inline-block", marginTop: 12 }}>
          ← Back to Admin
        </Link>
      </div>
    );
  }

  const totals = conversion?.totals ?? {
    PAYWALL_NOT_ENTITLED: 0,
    FREE_PREVIEW_VIEW: 0,
    SUBSCRIBE_CTA_CLICK: 0,
  };
  const ctr = conversion?.ctr ?? null;
  const previewToClick = conversion?.previewToClick ?? null;
  const daily = conversion?.daily ?? [];
  const lessons = topPaywalled?.lessons ?? [];

  const formatPct = (n: number | null) =>
    n == null ? "—" : `${(n * 100).toFixed(2)}%`;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: 12 }}>
        <Link to="/admin" style={{ color: "#1976d2", textDecoration: "none" }}>
          ← Admin
        </Link>
        <span style={{ color: "#999" }}>|</span>
        <h1 style={{ fontSize: "1.5rem", margin: 0, fontWeight: 700 }}>
          Paywall metrics (last {DAYS} days)
        </h1>
      </div>

      {/* Totals */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={cardStyle}>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#b45309" }}>
            {totals.PAYWALL_NOT_ENTITLED}
          </div>
          <div style={{ color: "#666", fontSize: "0.9rem" }}>Paywall hits</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0d9488" }}>
            {totals.FREE_PREVIEW_VIEW}
          </div>
          <div style={{ color: "#666", fontSize: "0.9rem" }}>Preview views</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#059669" }}>
            {totals.SUBSCRIBE_CTA_CLICK}
          </div>
          <div style={{ color: "#666", fontSize: "0.9rem" }}>CTA clicks</div>
        </div>
      </div>

      {/* CTR + Preview-to-click */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={cardStyle}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{formatPct(ctr)}</div>
          <div style={{ color: "#666", fontSize: "0.9rem" }}>CTR (paywall → CTA)</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{formatPct(previewToClick)}</div>
          <div style={{ color: "#666", fontSize: "0.9rem" }}>Preview → CTA</div>
        </div>
      </div>

      {/* Daily table */}
      <div style={{ ...cardStyle, marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem 0" }}>Daily breakdown</h2>
        {daily.length === 0 ? (
          <p style={{ color: "#666", margin: 0 }}>No events in this period.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #eee" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Day</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>Paywall</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>Preview</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>CTA</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((row) => (
                  <tr key={row.day} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "0.5rem" }}>{row.day}</td>
                    <td style={{ textAlign: "right", padding: "0.5rem" }}>
                      {row.PAYWALL_NOT_ENTITLED}
                    </td>
                    <td style={{ textAlign: "right", padding: "0.5rem" }}>
                      {row.FREE_PREVIEW_VIEW}
                    </td>
                    <td style={{ textAlign: "right", padding: "0.5rem" }}>
                      {row.SUBSCRIBE_CTA_CLICK}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top paywalled lessons */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem 0" }}>Top paywalled lessons</h2>
        {lessons.length === 0 ? (
          <p style={{ color: "#666", margin: 0 }}>No paywall events with lesson in this period.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {lessons.map((l, i) => (
              <li
                key={l.lessonId}
                style={{
                  padding: "0.5rem 0",
                  borderBottom: i < lessons.length - 1 ? "1px solid #eee" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      {l.title ?? "(deleted or unpublished)"}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      {l.count} paywall hits
                    </div>
                  </div>
                  <button
                    disabled={!l.lessonId || l.title == null || togglingId === l.lessonId}
                    onClick={async () => {
                      try {
                        setTogglingId(l.lessonId);
                        const next = !(l.isFreePreview === true);
                        await setFreePreview(l.lessonId, next);
                        await loadMetrics();
                      } finally {
                        setTogglingId(null);
                      }
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #d0d7de",
                      background: l.isFreePreview ? "#eefdf3" : "#fff",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {togglingId === l.lessonId
                      ? "Saving…"
                      : l.isFreePreview
                        ? "Preview: ON"
                        : "Preview: OFF"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Suggested previews (top paywalled without preview) */}
      <div style={{ ...cardStyle, marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem 0" }}>
          Suggested previews (top paywalled without preview)
        </h2>
        {suggestedPreviews.length === 0 ? (
          <p style={{ color: "#666", margin: 0 }}>
            No paywalled lessons without preview in this period, or all top paywalled already have preview.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {suggestedPreviews.map((l, i) => (
              <li
                key={l.lessonId}
                style={{
                  padding: "0.5rem 0",
                  borderBottom: i < suggestedPreviews.length - 1 ? "1px solid #eee" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      {l.title ?? "(deleted or unpublished)"}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      {l.count} paywall hits
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <input
                        type="text"
                        placeholder="Optional note (e.g. GCSE Week 1 test)"
                        value={suggestedNote[l.lessonId] ?? ""}
                        onChange={(e) =>
                          setSuggestedNote((prev) => ({ ...prev, [l.lessonId]: e.target.value }))
                        }
                        style={{
                          width: "100%",
                          maxWidth: 280,
                          padding: "4px 8px",
                          fontSize: 12,
                          border: "1px solid #d0d7de",
                          borderRadius: 6,
                        }}
                      />
                    </div>
                  </div>
                  <button
                    disabled={!l.lessonId || l.title == null || togglingId === l.lessonId}
                    onClick={async () => {
                      try {
                        setTogglingId(l.lessonId);
                        const note = suggestedNote[l.lessonId]?.trim();
                        await setFreePreview(l.lessonId, true, note);
                        setSuggestedNote((prev) => {
                          const next = { ...prev };
                          delete next[l.lessonId];
                          return next;
                        });
                        await loadMetrics();
                      } finally {
                        setTogglingId(null);
                      }
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #d0d7de",
                      background: "#fff",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {togglingId === l.lessonId ? "Saving…" : "Preview: OFF → ON"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminMetricsPage;
