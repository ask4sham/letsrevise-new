/**
 * Teacher Brain — P1.0 GCSE Visual Explanation panel.
 *
 * Single sticky panel mounted on LessonView between the header and the
 * blocks grid. Auth-gated (logged-in teacher only). On click:
 *   1. POST /api/visual-explanations/generate with {topic, context, ...}
 *   2. Render the labelled diagram + 8-section GCSE explanation.
 *   3. On image-provider failure, still render the explanation with a clean
 *      "image provider not connected" placeholder.
 *
 * Self-contained. If this component throws, the root ErrorBoundary catches it
 * and the rest of the lesson page stays unaffected.
 */
import { useState } from "react";
import { Sparkles, ImageOff, Loader2, AlertTriangle, Eye } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const SECTIONS = [
  { key: "what_image_shows",      label: "What this image shows" },
  { key: "key_parts",              label: "Key parts labelled" },
  { key: "step_by_step",           label: "Step-by-step" },
  { key: "why_it_matters_gcse",    label: "Why it matters for GCSE" },
  { key: "common_mistake",         label: "Common mistake" },
  { key: "exam_tip",               label: "Exam tip" },
  { key: "exam_question",          label: "Exam-style question" },
  { key: "model_answer",           label: "Model answer" },
];

export default function VisualExplanationPanel({ lesson }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(lesson?.topic || "");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { explanation, image_data_url, provider_status }
  const [error, setError] = useState("");

  const signedIn = !!user;

  const onGenerate = async () => {
    if (!signedIn) return;
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.generateVisualExplanation({
        topic: topic.trim(),
        context: context.trim() || null,
        subject: lesson?.subject || "GCSE Biology",
        exam_board: lesson?.exam_board || "AQA",
        tier: lesson?.tier || "Higher",
        lesson_id: lesson?.id || null,
      });
      setResult(res);
    } catch (e) {
      const detail =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to generate visual explanation.";
      setError(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      data-testid="visual-explanation-panel"
      className="rounded-2xl border border-[var(--tb-line)] bg-white shadow-sm overflow-hidden"
    >
      {/* Header strip */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="visual-explanation-toggle"
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[var(--tb-cream)]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="grid place-items-center h-9 w-9 rounded-full bg-[var(--tb-accent)]/15 text-[var(--tb-accent)]">
            <Sparkles size={18} />
          </span>
          <div>
            <div className="tb-display text-[18px] font-semibold leading-snug">
              Visual explanation
            </div>
            <div className="text-xs text-[var(--tb-ink-2)]">
              GCSE-style diagram + 8-section examiner explanation
            </div>
          </div>
        </div>
        <span className="text-xs tb-mono text-[var(--tb-muted)]">
          {open ? "Hide" : "Open"}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-6 pt-1 border-t border-[var(--tb-line)]">
          {!signedIn && (
            <div
              data-testid="visual-explanation-signin-gate"
              className="my-4 rounded-lg border border-[var(--tb-line)] bg-[var(--tb-cream)] p-4 text-sm text-[var(--tb-ink-2)] flex items-start gap-2"
            >
              <AlertTriangle size={16} className="mt-0.5" />
              <span>
                Sign in to generate a GCSE visual explanation. Each generation
                counts towards your daily AI usage cap.
              </span>
            </div>
          )}

          {/* Controls */}
          <div className="mt-4 grid sm:grid-cols-[1fr_220px] gap-3 items-end">
            <div>
              <label className="block text-[11px] tb-mono uppercase tracking-wide text-[var(--tb-muted)] mb-1">
                Topic to visualise
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={!signedIn || loading}
                placeholder="e.g. The eye"
                data-testid="visual-explanation-topic-input"
                className="tb-input w-full"
              />
            </div>
            <button
              onClick={onGenerate}
              disabled={!signedIn || loading || !topic.trim()}
              data-testid="visual-explanation-generate-btn"
              className="tb-btn h-[42px] justify-center"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Generate visual
                </>
              )}
            </button>
          </div>
          <div className="mt-3">
            <label className="block text-[11px] tb-mono uppercase tracking-wide text-[var(--tb-muted)] mb-1">
              Extra context (optional)
            </label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              disabled={!signedIn || loading}
              placeholder="e.g. focus on accommodation for near objects"
              data-testid="visual-explanation-context-input"
              className="tb-input w-full"
            />
          </div>

          {loading && (
            <div
              data-testid="visual-explanation-loading"
              className="mt-6 rounded-xl border border-dashed border-[var(--tb-line)] p-6 text-center text-sm text-[var(--tb-ink-2)]"
            >
              Drafting the GCSE explanation and the labelled diagram… this
              usually takes 30–60 seconds.
            </div>
          )}

          {error && (
            <div
              data-testid="visual-explanation-error"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-2"
            >
              <AlertTriangle size={16} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div
              data-testid="visual-explanation-result"
              className="mt-6 grid lg:grid-cols-[minmax(0,440px)_1fr] gap-6 items-start"
            >
              {/* Image */}
              <div className="rounded-xl border border-[var(--tb-line)] bg-[var(--tb-cream)]/50 overflow-hidden">
                {result.image_data_url ? (
                  <img
                    src={result.image_data_url}
                    alt={result.explanation?.what_image_shows || "GCSE diagram"}
                    data-testid="visual-explanation-image"
                    className="w-full h-auto block bg-white"
                  />
                ) : (
                  <div
                    data-testid="visual-explanation-image-placeholder"
                    className="aspect-[4/3] grid place-items-center text-center p-6 text-sm text-[var(--tb-ink-2)]"
                  >
                    <div>
                      <ImageOff size={28} className="mx-auto mb-2 opacity-60" />
                      <div className="font-semibold">
                        Image generation provider not connected
                      </div>
                      <div className="mt-1 text-xs">
                        The GCSE explanation below was generated successfully.
                        The diagram service is temporarily unavailable — please
                        try again in a moment.
                      </div>
                    </div>
                  </div>
                )}
                <div className="px-3 py-2 text-[11px] tb-mono text-[var(--tb-muted)] flex items-center gap-2 border-t border-[var(--tb-line)] bg-white">
                  <Eye size={11} />
                  {result.provider_status === "image_generated"
                    ? "© letsrevise.com · GCSE diagram"
                    : "© letsrevise.com · explanation only"}
                </div>
              </div>

              {/* Explanation */}
              <div className="space-y-4 min-w-0">
                {SECTIONS.map(({ key, label }) => {
                  const v = result.explanation?.[key];
                  if (v == null || (Array.isArray(v) && v.length === 0)) return null;
                  return (
                    <div
                      key={key}
                      data-testid={`visual-explanation-section-${key}`}
                      className="rounded-lg border border-[var(--tb-line)] bg-white p-4"
                    >
                      <div className="text-[11px] tb-mono uppercase tracking-wide text-[var(--tb-muted)] mb-1.5">
                        {label}
                      </div>
                      {key === "key_parts" && Array.isArray(v) ? (
                        <ul className="space-y-1.5">
                          {v.map((p, i) => (
                            <li key={i} className="text-sm leading-relaxed">
                              <span className="tb-mono text-[var(--tb-accent)] font-semibold">
                                {p.label}
                              </span>{" "}
                              <span className="text-[var(--tb-ink-2)]">— {p.what}</span>
                            </li>
                          ))}
                        </ul>
                      ) : key === "step_by_step" && Array.isArray(v) ? (
                        <ol className="list-decimal list-inside space-y-1 text-sm leading-relaxed">
                          {v.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {String(v)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
