import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Download, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import { LESSON } from "@/constants/testIds";
import ExaminerCard from "@/components/ExaminerCard";
import LessonBlock from "@/components/LessonBlock";
import MarkItNow from "@/components/MarkItNow";
import VisualExplanationPanel from "@/components/VisualExplanationPanel";

function blocksToMarkdown(lesson) {
  if (!lesson) return "";
  const stripTags = (html) => (html || "").replace(/<\/?(p|h3|strong|em)\b[^>]*>/gi, "").replace(/<br\s*\/?>(\s*)/gi, "\n");
  const out = [
    `# ${lesson.topic}`,
    "",
    `_${lesson.subject} · ${lesson.exam_board} · ${lesson.tier} · ${lesson.spec_point || ""}_`,
    "",
    `> ${lesson.objective || ""}`,
    "",
  ];
  (lesson.blocks || []).forEach((b, i) => {
    out.push(`## ${i + 1}. ${b.title}`);
    const body = (b.body_html || "")
      .replace(/<li>/gi, "- ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/?(ul|ol)>/gi, "");
    out.push(stripTags(body).trim());
    if (b.score != null) {
      out.push("");
      out.push(`_Examiner score: ${b.score}/10_`);
    }
    out.push("");
  });
  return out.join("\n").trim();
}

export default function LessonView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    api.get(id).then(setLesson).catch((e) => setError(e?.message || "Lesson not found"));
  }, [id]);

  const workedBlock = useMemo(
    () => (lesson?.blocks || []).find((b) => b.key === "workedExample"),
    [lesson]
  );

  const markdown = useMemo(() => blocksToMarkdown(lesson), [lesson]);

  const copyMd = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(markdown);
        setCopied("Copied");
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch (_e) {
      // Fallback for non-secure contexts / permission denied
      try {
        const ta = document.createElement("textarea");
        ta.value = markdown;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied("Copied");
      } catch {
        setCopied("Copy failed");
      }
    }
    setTimeout(() => setCopied(""), 1800);
  };

  const downloadMd = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(lesson?.topic || "lesson").replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const regenerate = async () => {
    if (!lesson) return;
    setRegenLoading(true);
    try {
      const fresh = await api.generate(lesson.topic, lesson.exam_board, lesson.tier);
      navigate(`/lesson/${fresh.id}`);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Regenerate failed.");
      setRegenLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="tb-card p-8 max-w-md text-center">
          <AlertTriangle className="mx-auto text-[var(--tb-violation)]" />
          <h2 className="tb-display text-2xl font-semibold mt-3">Couldn&apos;t load lesson</h2>
          <p className="text-sm text-[var(--tb-muted)] mt-2">{error}</p>
          <Link to="/" className="tb-btn mt-6 inline-flex">Back to home</Link>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="tb-skeleton h-8 w-2/3 mb-4" />
        <div className="tb-skeleton h-4 w-1/3 mb-10" />
        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="tb-card p-6">
                <div className="tb-skeleton h-5 w-1/2 mb-3" />
                <div className="tb-skeleton h-4 w-full mb-2" />
                <div className="tb-skeleton h-4 w-4/5" />
              </div>
            ))}
          </div>
          <div className="tb-card p-6 h-fit">
            <div className="tb-skeleton h-5 w-1/2 mb-4" />
            <div className="tb-skeleton h-16 w-16 rounded-full mb-4" />
            <div className="tb-skeleton h-3 w-full mb-2" />
            <div className="tb-skeleton h-3 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid={LESSON.page}>
      {/* Header */}
      <header className="border-b border-[var(--tb-line)] bg-[var(--tb-cream)]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link
            to="/"
            data-testid={LESSON.backLink}
            className="flex items-center gap-2 text-sm text-[var(--tb-ink-2)] hover:text-[var(--tb-ink)]"
          >
            <ArrowLeft size={16} />
            <span className="tb-display font-semibold">Teacher Brain</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={regenerate}
              disabled={regenLoading}
              data-testid={LESSON.regenerateBtn}
              className="tb-btn ghost text-sm py-2 px-3"
              title="Regenerate this lesson"
            >
              <RefreshCw size={14} className={regenLoading ? "animate-spin" : ""} />
              {regenLoading ? "Regenerating…" : "Regenerate"}
            </button>
            <button
              onClick={copyMd}
              data-testid={LESSON.copyMdBtn}
              className="tb-btn ghost text-sm py-2 px-3"
            >
              <Copy size={14} />
              {copied || "Copy MD"}
            </button>
            <button
              onClick={downloadMd}
              data-testid={LESSON.exportMdBtn}
              className="tb-btn text-sm py-2 px-3"
            >
              <Download size={14} />
              Export .md
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="tb-chip">{lesson.subject}</span>
            <span className="tb-chip">{lesson.exam_board}</span>
            <span className="tb-chip">{lesson.tier}</span>
            {lesson.spec_point && (
              <span
                data-testid={LESSON.specBadge}
                className="tb-chip accent"
              >
                <ShieldCheck size={11} /> Spec {lesson.spec_point}
              </span>
            )}
          </div>
          <h1
            data-testid={LESSON.title}
            className="tb-display text-[44px] sm:text-[56px] font-semibold leading-[0.98] mt-4 tracking-tight"
          >
            {lesson.topic}
          </h1>
          {lesson.objective && (
            <p className="text-[var(--tb-ink-2)] text-[18px] leading-relaxed mt-4 max-w-3xl italic">
              {lesson.objective}
            </p>
          )}
        </motion.div>

        <div className="mt-8">
          <VisualExplanationPanel lesson={lesson} />
        </div>

        <div className="mt-10 grid lg:grid-cols-[1fr_320px] gap-8 items-start">
          {/* Blocks column */}
          <div className="space-y-5 min-w-0">
            {(lesson.blocks || []).map((b, idx) => (
              <div key={b.key + idx}>
                <LessonBlock block={b} index={idx} />
                {b.key === "workedExample" && (
                  <MarkItNow lessonId={lesson.id} block={b} />
                )}
              </div>
            ))}
          </div>

          {/* Sticky examiner card */}
          <div className="lg:sticky lg:top-[88px]">
            <ExaminerCard scoring={lesson.scoring} />
          </div>
        </div>
      </main>

      <footer className="border-t border-[var(--tb-line)] py-8 text-center text-xs text-[var(--tb-muted)] tb-mono">
        Generated by {lesson.model_used || "Teacher Brain"} · scored read-only by Examiner Language V2
      </footer>
    </div>
  );
}
