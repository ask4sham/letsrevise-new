/**
 * Admin Autopilot Experiments — A/B testing for prompt packs.
 * Route: /admin/autopilot-experiments
 */
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  fetchAutopilotExperiments,
  fetchAutopilotPromptPacks,
  createAutopilotExperiment,
  updateAutopilotExperiment,
  fetchExperimentResults,
  type AutopilotExperiment,
  type AutopilotPromptPack,
  type ExperimentPerformance,
} from "../api/contentGraph";

const AutopilotExperimentsPage: React.FC = () => {
  const [experiments, setExperiments] = useState<AutopilotExperiment[]>([]);
  const [promptPacks, setPromptPacks] = useState<AutopilotPromptPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResults, setSelectedResults] = useState<ExperimentPerformance | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    experimentId: "",
    label: "",
    description: "",
    specKey: "",
    topicKey: "",
    promptPacks: [
      { promptPackId: "", promptPackVersion: "", weight: 1 },
      { promptPackId: "", promptPackVersion: "", weight: 1 },
    ],
    assignmentMode: "round_robin" as "round_robin" | "weighted_random",
  });

  const loadExperiments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expRes, packsRes] = await Promise.all([
        fetchAutopilotExperiments(),
        fetchAutopilotPromptPacks(),
      ]);
      setExperiments(expRes.experiments || []);
      setPromptPacks(packsRes.promptPacks || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load experiments");
      setExperiments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  const loadResults = useCallback(async (id: string) => {
    setResultsLoading(true);
    setSelectedResults(null);
    try {
      const res = await fetchExperimentResults(id);
      setSelectedResults(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load results");
    } finally {
      setResultsLoading(false);
    }
  }, []);

  const handlePause = async (exp: AutopilotExperiment) => {
    try {
      await updateAutopilotExperiment(exp._id, { status: "paused" });
      await loadExperiments();
      if (selectedResults?.experimentId === exp.experimentId) setSelectedResults(null);
    } catch (err: any) {
      setError(err?.message || "Failed to pause");
    }
  };

  const handleActivate = async (exp: AutopilotExperiment) => {
    try {
      await updateAutopilotExperiment(exp._id, { status: "active" });
      await loadExperiments();
    } catch (err: any) {
      setError(err?.message || "Failed to activate");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.experimentId.trim() || !createForm.label.trim()) {
      setError("experimentId and label required");
      return;
    }
    const packs = createForm.promptPacks.filter((p) => p.promptPackId && p.promptPackVersion);
    if (packs.length < 2) {
      setError("At least 2 prompt packs required");
      return;
    }
    try {
      await createAutopilotExperiment({
        experimentId: createForm.experimentId.trim(),
        label: createForm.label.trim(),
        description: createForm.description.trim() || undefined,
        specKey: createForm.specKey.trim() || undefined,
        topicKey: createForm.topicKey.trim() || undefined,
        promptPacks: packs,
        assignmentMode: createForm.assignmentMode,
      });
      setShowCreate(false);
      setCreateForm({
        experimentId: "",
        label: "",
        description: "",
        specKey: "",
        topicKey: "",
        promptPacks: [
          { promptPackId: "", promptPackVersion: "", weight: 1 },
          { promptPackId: "", promptPackVersion: "", weight: 1 },
        ],
        assignmentMode: "round_robin",
      });
      await loadExperiments();
    } catch (err: any) {
      setError(err?.message || "Failed to create experiment");
    }
  };

  const packLabel = (id: string, version: string) => {
    const p = promptPacks.find((x) => x.promptPackId === id && x.promptPackVersion === version);
    return p ? p.label : `${id} ${version}`;
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <Link
          to="/admin"
          style={{
            padding: "0.5rem 1rem",
            background: "#f1f5f9",
            color: "#475569",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          ← Back to Admin
        </Link>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Autopilot Experiments</h1>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          style={{
            padding: "6px 12px",
            background: showCreate ? "#e2e8f0" : "#0369a1",
            color: showCreate ? "#475569" : "white",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showCreate ? "Cancel" : "Create Experiment"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          style={{
            padding: "1.5rem",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            marginBottom: "1.5rem",
          }}
        >
          <h3 style={{ margin: "0 0 1rem 0" }}>New Experiment</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Experiment ID</label>
              <input
                type="text"
                value={createForm.experimentId}
                onChange={(e) => setCreateForm((f) => ({ ...f, experimentId: e.target.value }))}
                placeholder="e.g. flashcard-v1-v2"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Label</label>
              <input
                type="text"
                value={createForm.label}
                onChange={(e) => setCreateForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Flashcard Generation Test"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Description (optional)</label>
              <input
                type="text"
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6 }}
              />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Spec (optional)</label>
                <input
                  type="text"
                  value={createForm.specKey}
                  onChange={(e) => setCreateForm((f) => ({ ...f, specKey: e.target.value }))}
                  placeholder="e.g. aqa-gcse-biology"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Topic (optional)</label>
                <input
                  type="text"
                  value={createForm.topicKey}
                  onChange={(e) => setCreateForm((f) => ({ ...f, topicKey: e.target.value }))}
                  placeholder="e.g. cell-structure"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6 }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Assignment mode</label>
              <select
                value={createForm.assignmentMode}
                onChange={(e) => setCreateForm((f) => ({ ...f, assignmentMode: e.target.value as "round_robin" | "weighted_random" }))}
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6 }}
              >
                <option value="round_robin">Round robin</option>
                <option value="weighted_random">Weighted random</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Prompt packs (min 2)</label>
              {createForm.promptPacks.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <select
                    value={`${p.promptPackId}::${p.promptPackVersion}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) {
                        const [id, ver] = v.split("::");
                        setCreateForm((f) => {
                          const next = [...f.promptPacks];
                          next[i] = { ...next[i], promptPackId: id, promptPackVersion: ver };
                          return { ...f, promptPacks: next };
                        });
                      }
                    }}
                    style={{ flex: 1, padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6 }}
                  >
                    <option value="">Select pack</option>
                    {promptPacks.map((x) => (
                      <option key={`${x.promptPackId}::${x.promptPackVersion}`} value={`${x.promptPackId}::${x.promptPackVersion}`}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                  {createForm.assignmentMode === "weighted_random" && (
                    <input
                      type="number"
                      min={0}
                      value={p.weight}
                      onChange={(e) => {
                        const w = parseFloat(e.target.value) || 1;
                        setCreateForm((f) => {
                          const next = [...f.promptPacks];
                          next[i] = { ...next[i], weight: w };
                          return { ...f, promptPacks: next };
                        });
                      }}
                      style={{ width: 60, padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6 }}
                    />
                  )}
                </div>
              ))}
            </div>
            <button type="submit" style={{ padding: "8px 16px", background: "#15803d", color: "white", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>
              Create
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>Loading...</div>
      ) : (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "white" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: 13, fontWeight: 700 }}>Label</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: 13, fontWeight: 700 }}>Scope</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: 13, fontWeight: 700 }}>Status</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: 13, fontWeight: 700 }}>Packs</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: 13, fontWeight: 700 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {experiments.map((exp) => (
                <tr key={exp._id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "0.75rem 1rem", fontSize: 14 }}>{exp.label}</td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: 13, color: "#64748b" }}>
                    {exp.specKey || "—"} {exp.topicKey ? ` / ${exp.topicKey}` : ""}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: exp.status === "active" ? "#dcfce7" : exp.status === "paused" ? "#fef3c7" : "#f1f5f9",
                        color: exp.status === "active" ? "#15803d" : exp.status === "paused" ? "#92400e" : "#64748b",
                      }}
                    >
                      {exp.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: 13 }}>
                    {(exp.promptPacks || []).map((p) => packLabel(p.promptPackId, p.promptPackVersion)).join(", ")}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => loadResults(exp._id)}
                        style={{ padding: "4px 10px", fontSize: 12, background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: 6, cursor: "pointer" }}
                      >
                        Results
                      </button>
                      {exp.status === "active" ? (
                        <button
                          type="button"
                          onClick={() => handlePause(exp)}
                          style={{ padding: "4px 10px", fontSize: 12, background: "#fef3c7", color: "#92400e", border: "none", borderRadius: 6, cursor: "pointer" }}
                        >
                          Pause
                        </button>
                      ) : exp.status === "paused" ? (
                        <button
                          type="button"
                          onClick={() => handleActivate(exp)}
                          style={{ padding: "4px 10px", fontSize: 12, background: "#dcfce7", color: "#15803d", border: "none", borderRadius: 6, cursor: "pointer" }}
                        >
                          Activate
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {experiments.length === 0 && !loading && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>No experiments yet. Create one to compare prompt packs.</div>
          )}
        </div>
      )}

      {selectedResults && (
        <div style={{ marginTop: "1.5rem", padding: "1.5rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0 }}>Results: {selectedResults.label}</h3>
            <button type="button" onClick={() => setSelectedResults(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}>
              ×
            </button>
          </div>
          {resultsLoading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>Loading results...</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#e2e8f0", borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: 12, fontWeight: 700 }}>Prompt Pack</th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: 12, fontWeight: 700 }}>Runs</th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: 12, fontWeight: 700 }}>Generated</th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: 12, fontWeight: 700 }}>Approved</th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: 12, fontWeight: 700 }}>Approval Rate</th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: 12, fontWeight: 700 }}>Avg Coverage Lift</th>
                </tr>
              </thead>
              <tbody>
                {(selectedResults.promptPacks || []).map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "0.5rem 0.75rem", fontSize: 13 }}>{packLabel(p.promptPackId, p.promptPackVersion)}</td>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: 13 }}>{p.runs}</td>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: 13 }}>{p.generatedItems}</td>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: 13 }}>{p.approvedItems}</td>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: 13 }}>{p.approvalRate != null ? `${p.approvalRate}%` : "—"}</td>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: 13 }}>{p.avgCoverageLift != null ? p.avgCoverageLift : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default AutopilotExperimentsPage;
