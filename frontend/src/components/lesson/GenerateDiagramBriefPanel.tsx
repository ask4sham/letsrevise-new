import React, { useCallback, useState } from "react";
import { generateDiagramBriefFromBlock } from "../../api/diagramBriefs";
import "./generateDiagramBriefPanel.css";

export type GenerateDiagramBriefPanelProps = {
  block: Record<string, unknown>;
  lesson: Record<string, unknown>;
  page?: Record<string, unknown>;
};

export function GenerateDiagramBriefPanel({
  block,
  lesson,
  page,
}: GenerateDiagramBriefPanelProps): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<string>("");
  const [teacherMetadata, setTeacherMetadata] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [metaCopyStatus, setMetaCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateDiagramBriefFromBlock({ block, lesson, page });
      setBrief(result.brief || "");
      setTeacherMetadata(result.teacherMetadata || null);
      setExpanded(true);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Could not generate diagram brief.";
      setError(message);
      setBrief("");
      setTeacherMetadata(null);
    } finally {
      setLoading(false);
    }
  }, [block, lesson, page]);

  const copyText = useCallback(async (text: string, which: "brief" | "metadata") => {
    if (!text) return;
    const setStatus = which === "brief" ? setCopyStatus : setMetaCopyStatus;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2500);
    }
  }, []);

  return (
    <div className="lr-diagram-brief-panel" data-testid="generate-diagram-brief-panel">
      <div className="lr-diagram-brief-panel__header">
        <div>
          <div className="lr-diagram-brief-panel__title">Generate Diagram Brief</div>
          <div className="lr-diagram-brief-panel__subtitle">
            ChatGPT-ready image prompt from this block — no image generation, no API cost.
          </div>
        </div>
        <button
          type="button"
          className="lr-diagram-brief-panel__generate"
          disabled={loading}
          onClick={() => void handleGenerate()}
        >
          {loading ? "Generating…" : brief ? "Regenerate brief" : "Generate Diagram Brief"}
        </button>
      </div>

      {error ? (
        <p className="lr-diagram-brief-panel__error" role="alert">
          {error}
        </p>
      ) : null}

      {brief ? (
        <>
          <div className="lr-diagram-brief-panel__section-header">
            <span className="lr-diagram-brief-panel__section-title">Image prompt (paste into ChatGPT)</span>
            <div className="lr-diagram-brief-panel__actions">
              <button type="button" className="lr-diagram-brief-panel__copy" onClick={() => void copyText(brief, "brief")}>
                {copyStatus === "copied" ? "Copied" : copyStatus === "error" ? "Copy failed" : "Copy prompt"}
              </button>
              <button
                type="button"
                className="lr-diagram-brief-panel__toggle"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
              >
                {expanded ? "Collapse" : "Expand"}
              </button>
            </div>
          </div>
          {expanded ? <pre className="lr-diagram-brief-panel__pre">{brief}</pre> : null}
        </>
      ) : null}

      {teacherMetadata ? (
        <>
          <div className="lr-diagram-brief-panel__section-header">
            <span className="lr-diagram-brief-panel__section-title">Teacher metadata (do not paste into ChatGPT)</span>
            <button
              type="button"
              className="lr-diagram-brief-panel__copy"
              onClick={() => void copyText(teacherMetadata, "metadata")}
            >
              {metaCopyStatus === "copied" ? "Copied" : metaCopyStatus === "error" ? "Copy failed" : "Copy metadata"}
            </button>
          </div>
          <pre className="lr-diagram-brief-panel__pre lr-diagram-brief-panel__pre--metadata">{teacherMetadata}</pre>
        </>
      ) : null}
    </div>
  );
}
