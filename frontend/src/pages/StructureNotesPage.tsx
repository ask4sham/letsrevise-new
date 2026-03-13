/**
 * Step 7 (LLM Roadmap): Create your own notes — paste notes, get summary + flashcards.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { structureNotes } from "../api/ai";

const MAX_NOTES_LENGTH = 8000;

export default function StructureNotesPage() {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<{ front: string; back: string }[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = notes.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    setFlashcards([]);
    try {
      const res = await structureNotes({ notes: trimmed });
      setSummary(res.summary || null);
      setFlashcards(Array.isArray(res.flashcards) ? res.flashcards : []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e?.response?.data?.error || e?.message || "Failed to structure notes");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSummary(null);
    setFlashcards([]);
    setError(null);
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link to="/student-dashboard" style={{ color: "#667eea", textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>
      </div>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Create your own notes</h1>
      <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
        Paste your revision notes and we’ll turn them into a short summary and flashcards.
      </p>

      {!summary ? (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor="notes" style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
              Your notes *
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste or type your revision notes here…"
              maxLength={MAX_NOTES_LENGTH}
              disabled={loading}
              rows={12}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 16,
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
            <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>
              {notes.length} / {MAX_NOTES_LENGTH} characters
            </div>
          </div>
          {error && <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !notes.trim()}
            style={{
              padding: "0.6rem 1.2rem",
              background: loading ? "#94a3b8" : "#7c3aed",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              alignSelf: "flex-start",
            }}
          >
            {loading ? "Structuring…" : "Create summary & flashcards"}
          </button>
        </form>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <strong>Result</strong>
            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: "4px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                background: "#f8fafc",
                cursor: "pointer",
              }}
            >
              New notes
            </button>
          </div>
          <div
            style={{
              padding: "1rem",
              background: "#f8fafc",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6, color: "#374151" }}>Summary</div>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{summary}</p>
          </div>
          {flashcards.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                Flashcards ({flashcards.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {flashcards.map((card, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "1rem",
                      background: "#fff",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 4 }}>Front</div>
                    <div style={{ fontWeight: 500, marginBottom: 8 }}>{card.front || "—"}</div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 4 }}>Back</div>
                    <div style={{ color: "#475569" }}>{card.back || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
