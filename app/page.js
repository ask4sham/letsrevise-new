"use client";

import { useMemo, useState } from "react";
import GeneratorForm from "@/components/GeneratorForm";
import LessonRenderer from "@/components/LessonRenderer";
import { parseLessonText } from "@/lib/parseLessonText";
import { validateLessonOutput } from "@/lib/validateLessonOutput";
import { findSpecEntry, inferQualificationTypeFromSubject } from "@/lib/specDatabase";

const defaultLessonCtx = {
  subject: "Biology",
  keyStage: "KS4 - GCSE",
  examBoard: "AQA",
  tier: "Higher Tier",
  topic: "",
  qualificationType: "",
  showExamBoard: true,
};

export default function Home() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoFixing, setAutoFixing] = useState(false);
  const [improving, setImproving] = useState(false);
  const [lessonCtx, setLessonCtx] = useState(defaultLessonCtx);
  const [lastFixesApplied, setLastFixesApplied] = useState([]);

  const blocks = useMemo(() => {
    if (!result) return [];
    return parseLessonText(result);
  }, [result]);

  const specLookup = useMemo(() => {
    const qType =
      lessonCtx.qualificationType ||
      inferQualificationTypeFromSubject(lessonCtx.subject);
    return findSpecEntry({
      subject: lessonCtx.subject,
      keyStage: lessonCtx.keyStage,
      examBoard: lessonCtx.showExamBoard ? lessonCtx.examBoard : "",
      topic: lessonCtx.topic,
      tier: lessonCtx.tier || "",
      qualificationType: qType,
    });
  }, [
    lessonCtx.subject,
    lessonCtx.keyStage,
    lessonCtx.examBoard,
    lessonCtx.topic,
    lessonCtx.showExamBoard,
    lessonCtx.tier,
    lessonCtx.qualificationType,
  ]);

  const specEntry = specLookup.entry;
  const specMatchInfo = specLookup.matchInfo;

  const validation = useMemo(() => {
    if (!result) return null;
    return validateLessonOutput(blocks, result, { specEntry, specMatchInfo });
  }, [blocks, result, specEntry, specMatchInfo]);

  async function runAutoFixLesson() {
    if (!result || !validation || autoFixing) return;

    setAutoFixing(true);

    try {
      const autofixRes = await fetch("/api/autofix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          draft: result,
          subject: lessonCtx.subject,
          keyStage: lessonCtx.keyStage,
          examBoard: lessonCtx.showExamBoard ? lessonCtx.examBoard : "",
          topic: lessonCtx.topic,
          tier: lessonCtx.tier || "",
          qualificationType:
            lessonCtx.qualificationType ||
            inferQualificationTypeFromSubject(lessonCtx.subject),
        }),
      });

      const autofixData = await autofixRes.json();

      if (!autofixRes.ok) {
        throw new Error(autofixData.error || "Deterministic auto-fix failed.");
      }

      const fixedText = autofixData.text || result;
      const fixesApplied = autofixData.fixesApplied || [];

      setLastFixesApplied(fixesApplied);
      setResult(fixedText);
    } catch (error) {
      console.error(error);
      alert(error.message || "Auto-fix failed.");
    } finally {
      setAutoFixing(false);
    }
  }

  async function runSmartImprove() {
    if (!result) return;

    setImproving(true);

    try {
      const res = await fetch("/api/smart-improve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          draft: result,
          topic: lessonCtx.topic,
          subject: lessonCtx.subject,
        }),
      });

      const data = await res.json();

      if (res.ok && data.text && !data.rejected) {
        setResult(data.text);
        setLastFixesApplied([
          "Applied Smart Improve (AI writing enhancement)",
        ]);
      } else if (res.ok && data.rejected) {
        alert(data.reason || "Smart Improve was skipped (structure unchanged).");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setImproving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-slate-900">
            LetsRevise Generator
          </h1>

          <GeneratorForm
            onResult={(text) => {
              setLastFixesApplied([]);
              setResult(text);
            }}
            onLoading={setLoading}
            onLessonContext={setLessonCtx}
          />

          {validation && (
            <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">
                  SS1 Quality Check
                </h2>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    validation.rating === "Excellent"
                      ? "bg-emerald-100 text-emerald-700"
                      : validation.rating === "Strong"
                      ? "bg-blue-100 text-blue-700"
                      : validation.rating === "Usable"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {validation.rating}
                </span>
              </div>

              <p className="mb-3 text-xs text-slate-600">
                {(() => {
                  const ent = validation.specEntry ?? specEntry;
                  const minfo = validation.specMatchInfo ?? specMatchInfo;
                  if (ent) {
                    const label = minfo?.partial
                      ? "Specification entry found (partial match): "
                      : "Specification entry found: ";
                    return `${label}${ent.board} — ${ent.topic}`;
                  }
                  if (minfo?.combinedScienceRejected) {
                    return "Warning: Combined Science-specific local entry not found for this topic.";
                  }
                  if (minfo?.partial && minfo?.reason && !ent) {
                    return "No specification row for this lesson context.";
                  }
                  return "No local specification entry found.";
                })()}
              </p>
              {(() => {
                const minfo = validation.specMatchInfo ?? specMatchInfo;
                if (!minfo?.reason || minfo.exact) return null;
                return (
                  <p className="mb-3 text-xs text-amber-800">{minfo.reason}</p>
                );
              })()}
              <p className="mb-3 text-xs text-slate-500">
                Context:{" "}
                {(() => {
                  const ent = validation.specEntry ?? specEntry;
                  if (
                    lessonCtx.keyStage === "KS4 - GCSE" &&
                    ["Biology", "Chemistry", "Physics", "Combined Science"].includes(
                      lessonCtx.subject
                    ) &&
                    ent?.qualification
                  ) {
                    return ent.qualification;
                  }
                  return lessonCtx.subject;
                })()}
                , {lessonCtx.keyStage}
                {lessonCtx.showExamBoard ? `, ${lessonCtx.examBoard}` : ""}
                {lessonCtx.tier && lessonCtx.keyStage === "KS4 - GCSE"
                  ? `, ${lessonCtx.tier}`
                  : ""}
              </p>

              <div className="mb-4">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium text-slate-700">Score</span>
                  <span className="font-bold text-slate-900">
                    {validation.score}/100
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${
                      validation.score >= 90
                        ? "bg-emerald-500"
                        : validation.score >= 75
                        ? "bg-blue-500"
                        : validation.score >= 60
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${validation.score}%` }}
                  />
                </div>
              </div>

              {validation.intelligence && (
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-900">
                    Next best action
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {validation.intelligence.nextBestAction}
                  </p>
                </div>
              )}

              {lastFixesApplied.length > 0 && (
                <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
                  <p className="text-sm font-bold text-indigo-900">
                    Last auto-fix pass
                  </p>
                  <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto text-xs text-indigo-900">
                    {lastFixesApplied.map((item, idx) => (
                      <li key={idx}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={runAutoFixLesson}
                disabled={autoFixing}
                className="mt-4 w-full rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-60"
              >
                {autoFixing ? "Auto-fixing..." : "Auto-fix lesson"}
              </button>

              {validation.score < 80 && (
                <button
                  type="button"
                  onClick={runSmartImprove}
                  disabled={improving}
                  className="mt-2 w-full rounded-lg bg-purple-700 px-4 py-2 text-sm font-bold text-white hover:bg-purple-800 disabled:opacity-60"
                >
                  {improving ? "Improving..." : "✨ Improve writing (AI)"}
                </button>
              )}

              <p className="mt-2 text-xs text-slate-500">
                Auto-fix uses deterministic patches only. It does not call OpenAI.
              </p>

              {validation.errors?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-bold text-red-700">
                    Critical fixes
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-red-700">
                    {validation.errors.slice(0, 6).map((item, index) => (
                      <li key={index}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.warnings?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-bold text-amber-700">
                    Suggestions
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-700">
                    {validation.warnings.slice(0, 6).map((item, index) => (
                      <li key={index}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.intelligence?.strengths?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-bold text-emerald-700">
                    Strengths
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-emerald-700">
                    {validation.intelligence.strengths
                      .slice(0, 5)
                      .map((item, index) => (
                        <li key={index}>• {item}</li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          {loading ? (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-600">Generating lesson...</p>
            </div>
          ) : (
            <LessonRenderer text={result} />
          )}
        </div>
      </div>
    </main>
  );
}
