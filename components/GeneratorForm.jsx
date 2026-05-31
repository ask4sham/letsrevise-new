"use client";

import { useEffect, useMemo, useState } from "react";

const keyStageOptions = ["KS2", "KS3", "KS4 - GCSE", "A-Level"];

const subjectOptions = [
  "Biology",
  "Chemistry",
  "Physics",
  "Combined Science",
  "Mathematics",
  "English",
  "Geography",
  "History",
];

const examBoardOptions = ["AQA", "Edexcel", "OCR", "WJEC / Eduqas", "CCEA"];

const qualityModes = [
  { value: "SS1 Interactive", label: "SS1 Interactive" },
  { value: "Exam Focused", label: "Exam Focused" },
  { value: "Standard", label: "Standard" },
];

const tierOptions = ["Higher Tier", "Foundation Tier", "Mixed"];

function qualificationTypeFromSubject(subject) {
  const s = String(subject || "");
  if (s === "Combined Science") return "combined-science";
  if (["Biology", "Chemistry", "Physics"].includes(s)) return "single-science";
  return "";
}

function buildExtras({
  qualityMode,
  tier,
  autoFixMissingBlocks,
  lessonSuggestions,
  useLessonGeneratorV2,
  useLessonGeneratorV3,
}) {
  const ss1Rules = `Output in numbered LetsRevise lesson sections.
Do not use the word "BLOCK" in the lesson.
Make the lesson suitable for copy and paste into LetsRevise teacher Create Lesson.

QUALITY MODE:
${qualityMode}

TIER:
${tier}

LESSON CONTENT SUGGESTIONS FROM TEACHER:
${lessonSuggestions || "None"}

INTERACTIVE REQUIREMENTS:
- Include at least 1 Drag and drop match.
- Include at least 1 Interactive diagram.
- Include at least 1 Step-by-step diagram.
- Include at least 2 Checkpoint blocks.
- Include at least 1 Quick check.
- Include at least 1 Worked example with hidden answer.
- Include at least 1 Common mistake block.
- Include at least 1 Exam tip block.
- Include exactly 1 Key words block with exactly 10 keywords.

LEARNING LOOP:
Every major concept must follow:
Explain → Visual → Interaction → Exam thinking

ANSWER RULES:
- Checkpoint answers must be plain text and match one option exactly.
- Non-checkpoint answers must use <details> and <summary>.
- Model answers must use <details><summary>Reveal Model Answer</summary>.

DIAGRAM RULES:
- Diagrams are visual-only.
- Do not put questions or answers inside diagrams.
- Include exactly 3 diagram-related blocks.

STYLE:
- Teacher speak.
- GCSE language.
- Short chunks.
- Cause → effect explanations.
- Clear exam phrasing.
- No teacher guidance notes inside copied lesson content.`;

  if (!autoFixMissingBlocks) return ss1Rules;

  return `${ss1Rules}

AUTO-FIX RULE:
Before outputting, check whether any required SS1 block is missing.
If missing, insert it naturally into the lesson before finalising.`;
}

function buildPlannerExtras({ useLessonGeneratorV2, useLessonGeneratorV3, useLessonGeneratorV4 }) {
  if (!useLessonGeneratorV2 && !useLessonGeneratorV3 && !useLessonGeneratorV4) return "";
  const lines = ["", "--- Lesson Generator V2/V3/V4 (prompt guidance for this run) ---"];
  if (useLessonGeneratorV2) {
    lines.push(
      "V2 planner: Use teach→test rhythm — never more than 2 teaching blocks in a row without a checkpoint or activity.",
      "Place activities immediately after the concept they assess (not all at the end)."
    );
  }
  if (useLessonGeneratorV3) {
    lines.push(
      "V3 structure: Include objectives, prior knowledge, scenario/hook, core rule, then teach/checkpoint alternation, exam technique, exam practice, summary, keywords.",
      "Avoid duplicate checkpoint wording for the same concept."
    );
  }
  if (useLessonGeneratorV4) {
    lines.push(
      "V4 teaching: Sound like an outstanding GCSE teacher — hook, prior bridge, WHAT/HOW/WHY for each concept.",
      "Weave in: Students often write… / AQA expects… / A better answer would be… / Full-mark example…",
      "Spiral retrieval checkpoints; activities from recall through to exam-style thinking."
    );
  }
  lines.push(
    "Note: Full V2 blueprint + V3 enforcement + V4 teaching scores run on Teacher Dashboard → Generate lesson with AI (saves via /api/ai/generate-and-save)."
  );
  return lines.join("\n");
}

export default function GeneratorForm({ onResult, onLoading, onLessonContext }) {
  const [subject, setSubject] = useState("Biology");
  const [keyStage, setKeyStage] = useState("KS4 - GCSE");
  const [examBoard, setExamBoard] = useState("AQA");
  const [topic, setTopic] = useState("");
  const [qualityMode, setQualityMode] = useState("SS1 Interactive");
  const [tier, setTier] = useState("Higher Tier");
  const [autoFixMissingBlocks, setAutoFixMissingBlocks] = useState(true);
  const [polishAfterGeneration, setPolishAfterGeneration] = useState(false);
  const [useLessonGeneratorV2, setUseLessonGeneratorV2] = useState(false);
  const [useLessonGeneratorV3, setUseLessonGeneratorV3] = useState(false);
  const [useLessonGeneratorV4, setUseLessonGeneratorV4] = useState(false);
  const [lessonSuggestions, setLessonSuggestions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const extras = useMemo(
    () =>
      buildExtras({
        qualityMode,
        tier,
        autoFixMissingBlocks,
        lessonSuggestions,
        useLessonGeneratorV2,
        useLessonGeneratorV3,
        useLessonGeneratorV4,
      }) + buildPlannerExtras({ useLessonGeneratorV2, useLessonGeneratorV3, useLessonGeneratorV4 }),
    [
      qualityMode,
      tier,
      autoFixMissingBlocks,
      lessonSuggestions,
      useLessonGeneratorV2,
      useLessonGeneratorV3,
      useLessonGeneratorV4,
    ]
  );

  const showExamBoard = keyStage === "KS4 - GCSE" || keyStage === "A-Level";
  const showTier = keyStage === "KS4 - GCSE";

  useEffect(() => {
    const genTopic =
      showTier && tier !== "Mixed" ? `${topic.trim()} (${tier})` : topic.trim();
    onLessonContext?.({
      subject,
      keyStage,
      examBoard,
      tier,
      topic: genTopic || topic.trim(),
      showExamBoard,
      qualificationType: qualificationTypeFromSubject(subject),
    });
  }, [subject, keyStage, examBoard, tier, topic, showExamBoard, showTier, onLessonContext]);

  async function handleSubmit(e) {
    e.preventDefault();
    onLoading(true);
    onResult("");
    setSubmitting(true);

    try {
      const generateRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          keyStage,
          examBoard: showExamBoard ? examBoard : "",
          topic: showTier && tier !== "Mixed" ? `${topic} (${tier})` : topic,
          tier: showTier ? tier : "",
          qualificationType: qualificationTypeFromSubject(subject),
          extras,
          useLessonGeneratorV2: useLessonGeneratorV2 === true,
          useLessonGeneratorV3: useLessonGeneratorV3 === true,
          useLessonGeneratorV4: useLessonGeneratorV4 === true,
        }),
      });

      const generateData = await generateRes.json();

      if (!generateRes.ok) {
        throw new Error(generateData.error || "Failed to generate lesson");
      }

      const draft = generateData.text || "";

      if (!polishAfterGeneration) {
        onResult(draft || "No response received.");
        return;
      }

      const polishRes = await fetch("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });

      const polishData = await polishRes.json();

      if (!polishRes.ok) {
        throw new Error(polishData.error || "Failed to polish lesson");
      }

      onResult(polishData.text || draft || "No response received.");
    } catch (error) {
      console.error(error);
      onResult(error.message || "Something went wrong while generating the lesson.");
    } finally {
      onLoading(false);
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm"
    >
      <div>
        <label className="mb-2 block text-sm font-medium">Subject</label>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
        >
          {subjectOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Key Stage</label>
        <select
          value={keyStage}
          onChange={(e) => setKeyStage(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
        >
          {keyStageOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {showExamBoard && (
        <div>
          <label className="mb-2 block text-sm font-medium">Exam Board</label>
          <select
            value={examBoard}
            onChange={(e) => setExamBoard(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          >
            {examBoardOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-500">
            Specification locking uses local starter entries. Verify against official specification before publishing.
          </p>
        </div>
      )}

      {showTier && (
        <div>
          <label className="mb-2 block text-sm font-medium">Tier</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          >
            {tierOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium">Quality Mode</label>
        <select
          value={qualityMode}
          onChange={(e) => setQualityMode(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
        >
          {qualityModes.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-start gap-3 rounded-xl border bg-slate-50 p-3 text-sm">
        <input
          type="checkbox"
          checked={autoFixMissingBlocks}
          onChange={(e) => setAutoFixMissingBlocks(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block font-semibold text-slate-900">
            Auto-fix missing SS1 blocks
          </span>
          <span className="text-slate-600">
            Forces the generator to insert missing interactive, diagram, and exam blocks.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-xl border bg-slate-50 p-3 text-sm">
        <input
          type="checkbox"
          checked={polishAfterGeneration}
          onChange={(e) => setPolishAfterGeneration(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block font-semibold text-slate-900">
            Polish after generation (uses extra API)
          </span>
          <span className="text-slate-600">
            Runs a second model pass to refine wording. Leave off to save quota.
          </span>
        </span>
      </label>

      <fieldset className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
        <legend className="px-1 text-sm font-semibold text-emerald-900">
          Lesson planner (V2 / V3)
        </legend>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={useLessonGeneratorV2}
            onChange={(e) => {
              const checked = e.target.checked;
              setUseLessonGeneratorV2(checked);
              if (!checked) setUseLessonGeneratorV3(false);
            }}
            className="mt-1"
          />
          <span>
            <span className="block font-semibold text-slate-900">
              Generate with V2 planner (teach→test journey)
            </span>
            <span className="text-slate-600">
              Adds blueprint-style rules to this run. Full blueprint engine runs on Teacher Dashboard
              generate-and-save.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={useLessonGeneratorV3}
            disabled={!useLessonGeneratorV2}
            onChange={(e) => setUseLessonGeneratorV3(e.target.checked)}
            className="mt-1 disabled:opacity-50"
          />
          <span>
            <span className="block font-semibold text-slate-900">
              Enforce structure with V3 (architecture gate before save)
            </span>
            <span className="text-slate-600">
              Requires V2. Structural enforcement applies when saving via Teacher Dashboard
              (generate-and-save), not this SS1 text export.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={useLessonGeneratorV4}
            disabled={!useLessonGeneratorV2}
            onChange={(e) => setUseLessonGeneratorV4(e.target.checked)}
            className="mt-1 disabled:opacity-50"
          />
          <span>
            <span className="block font-semibold text-slate-900">
              Teaching intelligence V4 (teacher voice + exam modelling)
            </span>
            <span className="text-slate-600">
              Requires V2. Adds teaching journey and examiner language to the prompt; full scoring on
              generate-and-save.
            </span>
          </span>
        </label>
      </fieldset>

      <div>
        <label className="mb-2 block text-sm font-medium">Topic</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Plant cell organisation"
          className="w-full rounded-lg border px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Lesson Content Suggestions
        </label>
        <textarea
          value={lessonSuggestions}
          onChange={(e) => setLessonSuggestions(e.target.value)}
          placeholder="Paste your lesson notes, SS1-style guidance, required examples, keywords, practical links, or anything you want included."
          className="min-h-[160px] w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-xl border bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Active Generator Rules
        </p>
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">
          {extras}
        </pre>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-black px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Generating..." : "Generate SS1 Lesson"}
      </button>
    </form>
  );
}
