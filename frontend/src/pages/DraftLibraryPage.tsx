/**
 * Admin Draft Question Library — bulk generation of flashcards and exam questions per SpecStatement.
 * Route: /admin/draft-library
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  generateDraftLibraryForTopic,
  generateDraftLibraryForSpec,
  fetchSpecCoverage,
  fetchAutopilotPromptPacks,
  type DraftLibraryTopicResult,
  type DraftLibrarySpecResult,
  type SpecCoverageResponse,
  type AutopilotPromptPack,
} from "../api/contentGraph";
import Toast from "../components/Toast";

const SPEC_OPTIONS: { value: string; label: string }[] = [
  { value: "aqa-gcse-biology", label: "AQA GCSE Biology" },
  { value: "aqa-gcse-chemistry", label: "AQA GCSE Chemistry" },
  { value: "aqa-gcse-physics", label: "AQA GCSE Physics" },
  { value: "aqa-gcse-maths-foundation", label: "AQA GCSE Maths (Foundation)" },
  { value: "aqa-gcse-maths-higher", label: "AQA GCSE Maths (Higher)" },
];

function formatTopicKey(key: string): string {
  const part = key.includes(":") ? key.split(":").pop()! : key;
  return part.replace(/-/g, " ");
}

const DraftLibraryPage: React.FC = () => {
  const [specKey, setSpecKey] = useState("aqa-gcse-biology");
  const [topicKey, setTopicKey] = useState("");
  const [limitPerTopic, setLimitPerTopic] = useState<number | "">("");
  const [dryRun, setDryRun] = useState(true);
  const [promptPackId, setPromptPackId] = useState("");
  const [promptPackVersion, setPromptPackVersion] = useState("");
  const [topicLoading, setTopicLoading] = useState(false);
  const [specLoading, setSpecLoading] = useState(false);
  const [topicResult, setTopicResult] = useState<DraftLibraryTopicResult | null>(null);
  const [specResult, setSpecResult] = useState<DraftLibrarySpecResult | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [coverage, setCoverage] = useState<SpecCoverageResponse | null>(null);
  const [promptPacks, setPromptPacks] = useState<AutopilotPromptPack[]>([]);

  React.useEffect(() => {
    fetchAutopilotPromptPacks()
      .then((r) => {
        setPromptPacks(r.promptPacks || []);
        const defaultPack = (r.promptPacks || []).find((p) => p.isDefault);
        if (defaultPack && !promptPackId) {
          setPromptPackId(defaultPack.promptPackId);
          setPromptPackVersion(defaultPack.promptPackVersion);
        }
      })
      .catch(() => setPromptPacks([]));
  }, []);

  React.useEffect(() => {
    fetchSpecCoverage(specKey)
      .then(setCoverage)
      .catch(() => setCoverage(null));
  }, [specKey]);

  const handleTopicGenerate = async () => {
    const tk = topicKey.trim();
    if (!tk) {
      setToast({ message: "Enter a topic key (e.g. cell-structure)", type: "error" });
      return;
    }
    setTopicLoading(true);
    setTopicResult(null);
    setToast(null);
    try {
      const res = await generateDraftLibraryForTopic({
        specKey,
        topicKey: tk,
        dryRun,
        promptPackId: promptPackId || undefined,
        promptPackVersion: promptPackVersion || undefined,
      });
      setTopicResult(res);
      if (res.skipped) {
        setToast({ message: res.reason || "Skipped", type: "error" });
      } else {
        const suffix = res.dryRun ? " (dry run)" : "";
        setToast({
          message: `${res.dryRun ? "Would create" : "Created"} ${res.flashcardsGenerated} flashcards, ${res.examQuestionsGenerated} exam questions${suffix}`,
          type: "success",
        });
      }
    } catch (err: any) {
      setToast({ message: err?.response?.data?.error || err?.message || "Generation failed", type: "error" });
    } finally {
      setTopicLoading(false);
    }
  };

  const handleSpecGenerate = async () => {
    setSpecLoading(true);
    setSpecResult(null);
    setToast(null);
    try {
      const res = await generateDraftLibraryForSpec({
        specKey,
        limitPerTopic: typeof limitPerTopic === "number" ? limitPerTopic : undefined,
        dryRun,
        promptPackId: promptPackId || undefined,
        promptPackVersion: promptPackVersion || undefined,
      });
      setSpecResult(res);
      if (res.error) {
        setToast({ message: res.error, type: "error" });
      } else {
        const suffix = res.dryRun ? " (dry run)" : "";
        setToast({
          message: `${res.dryRun ? "Would process" : "Processed"} ${res.topicsProcessed} topics: ${res.flashcardsGenerated} flashcards, ${res.examQuestionsGenerated} exam questions${suffix}`,
          type: "success",
        });
      }
    } catch (err: any) {
      setToast({ message: err?.response?.data?.error || err?.message || "Generation failed", type: "error" });
    } finally {
      setSpecLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Draft Question Library</h1>
      <p style={{ color: "#64748b", marginBottom: "0.5rem" }}>
        Generate draft flashcards and exam questions for every SpecStatement. All content starts as <strong>draft</strong> for teacher QA.
      </p>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: "1rem", padding: "0.75rem", background: "#f8fafc", borderRadius: 6 }}>
        Generated from SpecStatements only. Content is created as draft for teacher review. No external educational site scraping; no copying copyrighted teaching wording.
      </p>

      <Link to="/admin/autopilot-approval" style={{ color: "#0369a1", textDecoration: "none", marginBottom: "1rem", display: "inline-block" }}>
        ← Review drafts in Autopilot Approval
      </Link>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          <span style={{ fontWeight: 600 }}>Dry run (preview only, no saves)</span>
        </label>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Spec</label>
        <select
          value={specKey}
          onChange={(e) => setSpecKey(e.target.value)}
          style={{ padding: "0.5rem", minWidth: 220 }}
        >
          {SPEC_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Prompt pack (optional)</label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <select
            value={promptPackId}
            onChange={(e) => {
              setPromptPackId(e.target.value);
              const pack = promptPacks.find((p) => p.promptPackId === e.target.value);
              if (pack) setPromptPackVersion(pack.promptPackVersion);
            }}
            style={{ padding: "0.5rem", minWidth: 180 }}
          >
            <option value="">Default</option>
            {promptPacks.map((p) => (
              <option key={`${p.promptPackId}::${p.promptPackVersion}`} value={p.promptPackId}>
                {p.promptPackId} ({p.promptPackVersion})
              </option>
            ))}
          </select>
          <select
            value={promptPackVersion}
            onChange={(e) => setPromptPackVersion(e.target.value)}
            style={{ padding: "0.5rem", minWidth: 100 }}
          >
            {promptPacks
              .filter((p) => p.promptPackId === promptPackId)
              .map((p) => (
                <option key={p.promptPackVersion} value={p.promptPackVersion}>
                  {p.promptPackVersion}
                </option>
              ))}
          </select>
        </div>
      </div>

      <hr style={{ margin: "1.5rem 0", border: "none", borderTop: "1px solid #e2e8f0" }} />

      <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Generate for topic</h2>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: "1rem" }}>
        Generates 5–8 flashcards and 2–3 exam questions per SpecStatement for one topic.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: 12 }}>Topic key</label>
          <input
            type="text"
            value={topicKey}
            onChange={(e) => setTopicKey(e.target.value)}
            placeholder="e.g. cell-structure"
            style={{ padding: "0.5rem", width: 180 }}
          />
        </div>
        <button
          onClick={handleTopicGenerate}
          disabled={topicLoading}
          style={{
            padding: "0.5rem 1rem",
            background: "#0369a1",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: topicLoading ? "not-allowed" : "pointer",
          }}
        >
          {topicLoading ? "Generating…" : "Generate topic"}
        </button>
      </div>
      {coverage?.topics && (
        <div style={{ marginTop: "0.5rem", fontSize: 12, color: "#64748b" }}>
          Topics:{" "}
          {coverage.topics.slice(0, 8).map((t) => (
            <button
              key={t.topicKey || t.specKey}
              type="button"
              onClick={() => setTopicKey((t.topicKey || "").split(":").pop() || t.topicKey || "")}
              style={{
                background: "none",
                border: "none",
                color: "#0369a1",
                cursor: "pointer",
                padding: "0 4px",
                textDecoration: "underline",
              }}
            >
              {formatTopicKey(t.topicKey || "")}
            </button>
          ))}
          {coverage.topics.length > 8 && ` … +${coverage.topics.length - 8} more`}
        </div>
      )}
      {topicResult && (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            background: topicResult.skipped ? "#fef2f2" : topicResult.dryRun ? "#fffbeb" : "#f0fdf4",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          <strong>Result:</strong> {topicResult.statementsUsed} statements → {topicResult.flashcardsGenerated} flashcards,{" "}
          {topicResult.examQuestionsGenerated} exam questions
          {topicResult.duplicatesSkipped > 0 && ` (${topicResult.duplicatesSkipped} duplicates skipped)`}
          {topicResult.dryRun && " [dry run]"}
          {topicResult.errors?.length ? (
            <div style={{ marginTop: "0.5rem", color: "#b91c1c" }}>
              {topicResult.errors.length} error(s): {topicResult.errors.map((e) => e.message).join("; ")}
            </div>
          ) : null}
        </div>
      )}

      <hr style={{ margin: "1.5rem 0", border: "none", borderTop: "1px solid #e2e8f0" }} />

      <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Generate for entire spec</h2>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: "1rem" }}>
        Processes all leaf topics. Skips topics with &gt;100 flashcards or &gt;40 exam questions.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: 12 }}>Limit statements per topic (optional)</label>
          <input
            type="number"
            value={limitPerTopic}
            onChange={(e) => setLimitPerTopic(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
            placeholder="All"
            min={1}
            style={{ padding: "0.5rem", width: 100 }}
          />
        </div>
        <button
          onClick={handleSpecGenerate}
          disabled={specLoading}
          style={{
            padding: "0.5rem 1rem",
            background: "#0369a1",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: specLoading ? "not-allowed" : "pointer",
          }}
        >
          {specLoading ? "Generating…" : "Generate spec"}
        </button>
      </div>
      {specResult && !specResult.error && (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            background: specResult.dryRun ? "#fffbeb" : "#f0fdf4",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          <strong>Result:</strong> {specResult.topicsProcessed} topics processed →{" "}
          {specResult.flashcardsGenerated} flashcards, {specResult.examQuestionsGenerated} exam questions
          {specResult.duplicatesSkipped > 0 && ` (${specResult.duplicatesSkipped} duplicates skipped)`}
          {specResult.dryRun && " [dry run]"}
          {specResult.skippedTopics?.length ? (
            <div style={{ marginTop: "0.5rem", fontSize: 13 }}>
              Skipped: {specResult.skippedTopics.length} topics ({specResult.skippedTopics.slice(0, 3).map((s) => s.reason).join(", ")}
              {specResult.skippedTopics.length > 3 && "…"})
            </div>
          ) : null}
          {specResult.results?.length ? (
            <details style={{ marginTop: "0.5rem" }}>
              <summary>Per-topic details</summary>
              <ul style={{ margin: "0.5rem 0 0 1rem", padding: 0 }}>
                {specResult.results.slice(0, 20).map((r, i) => (
                  <li key={i}>
                    {r.topicKey || "—"}: {r.flashcardsGenerated} fc, {r.examQuestionsGenerated} eq
                    {r.skipped && ` (${r.reason})`}
                  </li>
                ))}
                {specResult.results.length > 20 && <li>… +{specResult.results.length - 20} more</li>}
              </ul>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default DraftLibraryPage;
