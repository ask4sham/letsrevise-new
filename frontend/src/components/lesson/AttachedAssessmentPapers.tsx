/**
 * Attached Assessment Papers panel for the Lesson editor (Assessments accordion).
 * Shows attached papers with title, kind, subject/level/examBoard, question count, duration; Attach / Remove.
 */

export type PaperKind = "past_paper" | "mock_exam" | "practice_set" | "QUIZ" | "PRACTICE" | "EXAM" | string;

export type AssessmentPaperSummary = {
  _id: string;
  title?: string;
  kind?: PaperKind;
  subject?: string;
  level?: string;
  examBoard?: string;
  /** Backend returns questionCount; spec uses questionsCount */
  questionsCount?: number;
  questionCount?: number;
  timeSeconds?: number;
};

function formatKind(kind?: PaperKind) {
  if (!kind) return "Paper";
  const k = String(kind).toLowerCase();
  if (k === "quiz" || k === "QUIZ") return "Quiz";
  if (k === "practice" || k === "PRACTICE" || k === "practice_set") return "Practice paper";
  if (k === "exam" || k === "EXAM" || k === "mock_exam") return "Exam paper";
  if (k === "past_paper") return "Past paper";
  return kind.replace(/_/g, " ");
}

function formatMins(timeSeconds?: number) {
  if (!timeSeconds || timeSeconds <= 0) return null;
  const mins = Math.max(1, Math.round(timeSeconds / 60));
  return `~${mins}m`;
}

export function AttachedAssessmentPapersPanel(props: {
  papers?: AssessmentPaperSummary[];
  paperIds?: string[];
  onAttach: () => void;
  onRemove: (paperId: string) => void;
}) {
  const { papers, paperIds, onAttach, onRemove } = props;

  const hasSummaries = Array.isArray(papers) && papers.length > 0;
  const idsOnly = !hasSummaries && Array.isArray(paperIds) ? paperIds : [];

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Attached assessment papers
          </div>
          <div className="text-xs text-slate-500">
            Attach a quiz / practice / exam paper so students can open it from this lesson.
          </div>
        </div>

        <button
          type="button"
          onClick={onAttach}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Attach paper
        </button>
      </div>

      {/* Empty state */}
      {!hasSummaries && idsOnly.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="text-sm font-medium text-slate-900">
            No assessment papers attached yet.
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Attach a quiz, practice paper, or exam paper so students can access it from this lesson.
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={onAttach}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Attach paper
            </button>
          </div>
        </div>
      )}

      {/* List (summaries available) */}
      {hasSummaries && (
        <ul className="mt-4 space-y-2">
          {papers!.map((p) => {
            const count = typeof p.questionsCount === "number" ? p.questionsCount : p.questionCount;
            const rightBits: string[] = [];
            if (typeof count === "number") rightBits.push(`${count} questions`);
            const mins = formatMins(p.timeSeconds);
            if (mins) rightBits.push(mins);

            return (
              <li
                key={p._id}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {p.title || "Untitled paper"}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">
                      {formatKind(p.kind)}
                    </span>
                    {p.subject && <span>{p.subject}</span>}
                    {p.level && <span>• {p.level}</span>}
                    {p.examBoard && <span>• {p.examBoard}</span>}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {rightBits.length > 0 && (
                    <div className="text-xs text-slate-600">{rightBits.join(" • ")}</div>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemove(p._id)}
                    className="rounded-lg px-2 py-1 text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* List (ids only fallback) */}
      {!hasSummaries && idsOnly.length > 0 && (
        <ul className="mt-4 space-y-2">
          {idsOnly.map((id) => (
            <li
              key={id}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  Attached paper
                </div>
                <div className="mt-1 text-xs text-slate-600">ID: {id}</div>
              </div>

              <button
                type="button"
                onClick={() => onRemove(id)}
                className="rounded-lg px-2 py-1 text-sm font-medium text-rose-600 hover:bg-rose-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
