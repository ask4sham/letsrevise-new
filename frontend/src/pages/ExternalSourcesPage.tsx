/**
 * PR-022: External source moderation — teacher/admin only.
 * Route: /external-sources
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getExternalRecent,
  listPolicies,
  upsertPolicy,
  deletePolicy,
  promoteExternal,
  type ExternalSourceRecentItem,
  type ExternalSourcePolicy,
} from "../api/externalSources";

type Tab = "recent" | "denylist";

export default function ExternalSourcesPage() {
  const [searchParams] = useSearchParams();
  const appliedUrlParams = useRef(false);
  const [tab, setTab] = useState<Tab>("recent");
  const [recent, setRecent] = useState<ExternalSourceRecentItem[]>([]);
  const [policies, setPolicies] = useState<ExternalSourcePolicy[]>([]);
  const [specKey, setSpecKey] = useState<string>("");
  const [topicKey, setTopicKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promoteModal, setPromoteModal] = useState<ExternalSourceRecentItem | null>(null);
  const [promoteNoteTitle, setPromoteNoteTitle] = useState("");
  const [promoteNoteText, setPromoteNoteText] = useState("");
  const [promoteSubmitting, setPromoteSubmitting] = useState(false);

  const loadRecent = useCallback(async () => {
    try {
      const res = await getExternalRecent({ specKey: specKey || undefined, topicKey: topicKey || undefined, limit: 50 });
      setRecent(res.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [specKey, topicKey]);

  const loadPolicies = useCallback(async () => {
    try {
      const res = await listPolicies({ status: "denied" });
      setPolicies(res.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (appliedUrlParams.current) return;
    const sp = searchParams.get("specKey");
    const tp = searchParams.get("topicKey");
    if (sp || tp) {
      if (sp) setSpecKey(sp);
      if (tp) setTopicKey(tp);
      appliedUrlParams.current = true;
    }
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([loadRecent(), loadPolicies()])
      .finally(() => setLoading(false));
  }, [tab, loadRecent, loadPolicies]);

  const handleDenyDomain = async (domain: string) => {
    try {
      await upsertPolicy({ kind: "domain", value: domain, status: "denied" });
      await loadPolicies();
      await loadRecent();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDenyUrl = async (url: string) => {
    try {
      await upsertPolicy({ kind: "url", value: url, status: "denied" });
      await loadPolicies();
      await loadRecent();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handlePromote = async () => {
    if (!promoteModal) return;
    setPromoteSubmitting(true);
    try {
      await promoteExternal({
        enquiryLogId: promoteModal.enquiryLogId,
        url: promoteModal.url,
        title: promoteModal.title,
        specKey: promoteModal.specKey,
        topicKey: promoteModal.topicKey,
        noteTitle: promoteNoteTitle || undefined,
        noteText: promoteNoteText || undefined,
      });
      setPromoteModal(null);
      setPromoteNoteTitle("");
      setPromoteNoteText("");
      await loadRecent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPromoteSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 24, fontSize: 24 }}>External sources moderation</h1>
      <p style={{ marginBottom: 24, color: "#64748b", fontSize: 14 }}>
        Review and moderate external references used by the AI when course content is thin.
      </p>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, background: "#fef2f2", color: "#991b1b", borderRadius: 8 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <input
          type="text"
          placeholder="Spec key filter (e.g. aqa-gcse-biology)"
          value={specKey}
          onChange={(e) => setSpecKey(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, width: 220 }}
        />
        <input
          type="text"
          placeholder="Topic key (optional)"
          value={topicKey}
          onChange={(e) => setTopicKey(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, width: 200 }}
        />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setTab("recent")}
            style={{
              padding: "8px 16px",
              fontWeight: 600,
              background: tab === "recent" ? "#0284c7" : "#e2e8f0",
              color: tab === "recent" ? "#fff" : "#334155",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Recent sources
          </button>
          <button
            type="button"
            onClick={() => setTab("denylist")}
            style={{
              padding: "8px 16px",
              fontWeight: 600,
              background: tab === "denylist" ? "#0284c7" : "#e2e8f0",
              color: tab === "denylist" ? "#fff" : "#334155",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Denylist
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : tab === "recent" ? (
        <div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                <th style={{ padding: 12 }}>Date</th>
                <th style={{ padding: 12 }}>Question</th>
                <th style={{ padding: 12 }}>Title</th>
                <th style={{ padding: 12 }}>Domain</th>
                <th style={{ padding: 12 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={`${r.url}-${i}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: 12, maxWidth: 200 }} title={r.question}>
                    {(r.question || "").slice(0, 50)}{r.question && r.question.length > 50 ? "…" : ""}
                  </td>
                  <td style={{ padding: 12, maxWidth: 180 }} title={r.title}>
                    {(r.title || "").slice(0, 40)}{r.title && r.title.length > 40 ? "…" : ""}
                  </td>
                  <td style={{ padding: 12 }}>{r.domain || "—"}</td>
                  <td style={{ padding: 12 }}>
                    <button
                      type="button"
                      onClick={() => handleDenyDomain(r.domain)}
                      style={{ marginRight: 8, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                    >
                      Deny domain
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDenyUrl(r.url)}
                      style={{ marginRight: 8, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                    >
                      Deny URL
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPromoteModal(r);
                        setPromoteNoteTitle(r.title || "");
                        setPromoteNoteText("");
                      }}
                      style={{ padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                    >
                      Promote
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recent.length === 0 && <p style={{ padding: 24, color: "#64748b" }}>No recent external sources.</p>}
        </div>
      ) : (
        <div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                <th style={{ padding: 12 }}>Kind</th>
                <th style={{ padding: 12 }}>Value</th>
                <th style={{ padding: 12 }}>Reason</th>
                <th style={{ padding: 12 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p._id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: 12 }}>{p.kind}</td>
                  <td style={{ padding: 12 }}>{p.value}</td>
                  <td style={{ padding: 12 }}>{p.reason || "—"}</td>
                  <td style={{ padding: 12 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        await deletePolicy(p._id);
                        await loadPolicies();
                      }}
                      style={{ padding: "4px 8px", fontSize: 12, cursor: "pointer", color: "#dc2626" }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {policies.length === 0 && <p style={{ padding: 24, color: "#64748b" }}>No denied policies.</p>}
        </div>
      )}

      {promoteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !promoteSubmitting && setPromoteModal(null)}
        >
          <div
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 12,
              maxWidth: 500,
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 16 }}>Promote to Teacher Note</h3>
            <p style={{ marginBottom: 8, fontSize: 13 }}><strong>Title:</strong> {promoteModal.title || promoteModal.domain}</p>
            <p style={{ marginBottom: 16, fontSize: 12, color: "#64748b" }}>{promoteModal.url}</p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>Note title</label>
              <input
                type="text"
                value={promoteNoteTitle}
                onChange={(e) => setPromoteNoteTitle(e.target.value)}
                placeholder="Teacher note title"
                style={{ width: "100%", padding: 8, borderRadius: 6 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>Note text (optional)</label>
              <textarea
                value={promoteNoteText}
                onChange={(e) => setPromoteNoteText(e.target.value)}
                placeholder="Edit or leave blank to use snippet"
                rows={4}
                style={{ width: "100%", padding: 8, borderRadius: 6 }}
              />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setPromoteModal(null)} disabled={promoteSubmitting}>
                Cancel
              </button>
              <button type="button" onClick={handlePromote} disabled={promoteSubmitting}>
                {promoteSubmitting ? "Promoting…" : "Promote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
