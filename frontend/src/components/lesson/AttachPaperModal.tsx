/**
 * Attach Paper modal for the Lesson editor.
 * Filters: Kind, Search; defaults from lesson (subject / examBoard / level); optional topicKey.
 * Uses GET /api/assessment-papers and POST /api/lessons/:id/assessment-papers.
 */
import React, { useEffect, useMemo, useState } from "react";

/** Backend uses past_paper | mock_exam | practice_set */
type PaperKind = "past_paper" | "mock_exam" | "practice_set";

type AssessmentPaperSummary = {
  _id: string;
  title?: string;
  kind?: PaperKind | string;
  subject?: string;
  examBoard?: string;
  level?: string;
  tier?: string;
  topicKey?: string;
  timeSeconds?: number;
  questionCount?: number;
  updatedAt?: string;
};

function formatKindLabel(kind?: string) {
  const k = String(kind || "").toLowerCase();
  if (k === "past_paper") return "Past paper";
  if (k === "mock_exam") return "Exam paper";
  if (k === "practice_set") return "Practice set";
  return kind?.replace(/_/g, " ") || "Paper";
}

function minsLabel(timeSeconds?: number) {
  if (!timeSeconds || timeSeconds <= 0) return null;
  const mins = Math.max(1, Math.round(timeSeconds / 60));
  return `${mins} min`;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
      {children}
    </span>
  );
}

export function AttachPaperModal(props: {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  lessonContext: {
    subject?: string;
    examBoard?: string;
    level?: string;
    topicKey?: string;
  };
  attachedIds: string[];
  onAttachSuccess: () => Promise<void> | void;
  api: { get: (url: string, opts?: { params?: Record<string, string> }) => Promise<{ data: any }>; post: (url: string, body: any) => Promise<any> };
}) {
  const { open, onClose, lessonId, lessonContext, attachedIds, onAttachSuccess, api } = props;

  const [kind, setKind] = useState<PaperKind>("practice_set");
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [topicOnly, setTopicOnly] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [papers, setPapers] = useState<AssessmentPaperSummary[]>([]);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);

  const canUseTopic = Boolean(lessonContext.topicKey && String(lessonContext.topicKey).trim());

  const effectiveTopicKey = useMemo(() => {
    if (!canUseTopic) return undefined;
    return topicOnly ? String(lessonContext.topicKey).trim() : undefined;
  }, [canUseTopic, topicOnly, lessonContext.topicKey]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSearch("");
    setKind("practice_set");
    setTopicOnly(true);
  }, [open]);

  const PAGE_SIZE = 50;

  useEffect(() => {
    if (!open) return;

    const fetchPapers = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = {
          kind,
          fields: "summary",
          page: "1",
          limit: String(PAGE_SIZE),
          ...(lessonContext.subject && { subject: lessonContext.subject }),
          ...(lessonContext.examBoard && { examBoard: lessonContext.examBoard }),
          ...(lessonContext.level && { level: lessonContext.level }),
        };
        if (effectiveTopicKey) params.topicKey = effectiveTopicKey;
        if (search.trim()) params.q = search.trim();

        const res = await api.get("/assessment-papers", { params });
        const list = Array.isArray(res.data?.papers) ? res.data.papers : Array.isArray(res.data?.items) ? res.data.items : Array.isArray(res.data) ? res.data : [];
        setPapers(list);
        setPagination(res.data?.pagination ?? null);
      } catch (e: any) {
        console.error("[AttachPaperModal] load failed", e);
        setError(e?.response?.data?.error || e?.response?.data?.msg || e?.message || "Request failed");
        setPapers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPapers();
  }, [open, kind, effectiveTopicKey, lessonContext.subject, lessonContext.examBoard, lessonContext.level, search]);

  const loadMore = () => {
    const next = (pagination?.page ?? 1) + 1;
    if (next <= (pagination?.totalPages ?? 0)) {
      const fetchMore = async () => {
        setLoadingMore(true);
        setError(null);
        try {
          const params: Record<string, string> = {
            kind,
            fields: "summary",
            page: String(next),
            limit: String(PAGE_SIZE),
            ...(lessonContext.subject && { subject: lessonContext.subject }),
            ...(lessonContext.examBoard && { examBoard: lessonContext.examBoard }),
            ...(lessonContext.level && { level: lessonContext.level }),
          };
          if (effectiveTopicKey) params.topicKey = effectiveTopicKey;
          if (searchQuery.trim()) params.q = searchQuery.trim();
          const res = await api.get("/assessment-papers", { params });
          const list = Array.isArray(res.data?.papers) ? res.data.papers : Array.isArray(res.data?.items) ? res.data.items : [];
          const pag = res.data?.pagination ?? null;
          setPapers((prev) => [...prev, ...list]);
          setPagination(pag);
        } catch (e: any) {
          setError(e?.response?.data?.error || e?.response?.data?.msg || e?.message || "Load more failed");
        } finally {
          setLoadingMore(false);
        }
      };
      fetchMore();
    }
  };

  const filteredPapers = papers;

  const attachPaper = async (paperId: string) => {
    setAttachingId(paperId);
    setError(null);
    try {
      await api.post(`/lessons/${lessonId}/assessment-papers`, { paperId });
      await onAttachSuccess();
    } catch (e: any) {
      console.error("[AttachPaperModal] attach failed", e);
      setError(e?.response?.data?.error || e?.response?.data?.msg || e?.message || "Attach failed");
    } finally {
      setAttachingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <div className="text-base font-semibold text-slate-900">Attach assessment paper</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {lessonContext.subject && <Chip>{lessonContext.subject}</Chip>}
              {lessonContext.level && <Chip>{lessonContext.level}</Chip>}
              {lessonContext.examBoard && <Chip>{lessonContext.examBoard}</Chip>}
              {canUseTopic && <Chip>{String(lessonContext.topicKey)}</Chip>}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Choose a paper to attach to this lesson. Students will access it from the lesson page.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="text-xs font-medium text-slate-700">Kind</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as PaperKind)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="practice_set">Practice set</option>
              <option value="mock_exam">Exam paper</option>
              <option value="past_paper">Past paper</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-700">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by paper title…"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          {canUseTopic && (
            <div className="sm:col-span-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={topicOnly}
                  onChange={(e) => setTopicOnly(e.target.checked)}
                />
                Only show papers for this topic
              </label>
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          {error && (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <div className="text-sm font-medium text-slate-900">
                Available papers{" "}
                {loading ? "(loading…)" : pagination?.total != null ? `(${filteredPapers.length} of ${pagination.total})` : `(${filteredPapers.length})`}
              </div>
              {canUseTopic && (
                <div className="text-xs text-slate-500">
                  {topicOnly ? "Topic-filtered" : "All topics"}
                </div>
              )}
            </div>

            <ul className="max-h-[360px] overflow-auto p-2" style={{ listStyle: "none", margin: 0 }}>
              {!loading && filteredPapers.length === 0 && (
                <li className="p-4 text-sm text-slate-600">
                  No papers found for these filters. Try switching kind, turning off topic-only, or creating a new paper.
                </li>
              )}

              {filteredPapers.map((p) => {
                const isAttached = attachedIds.some((id) => String(id) === String(p._id));
                const isAttaching = attachingId === p._id;

                const meta: string[] = [];
                meta.push(formatKindLabel(p.kind));
                if (p.tier) meta.push(p.tier);
                if (p.questionCount != null) meta.push(`${p.questionCount} questions`);
                const mins = minsLabel(p.timeSeconds);
                if (mins) meta.push(mins);

                return (
                  <li
                    key={p._id}
                    className="mb-2 flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {p.title || "Untitled paper"}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">{meta.join(" • ")}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {[p.subject ?? lessonContext.subject, p.level ?? lessonContext.level, p.examBoard ?? lessonContext.examBoard].filter(Boolean).join(" • ")}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={isAttached || isAttaching}
                        onClick={() => attachPaper(p._id)}
                        className={
                          "rounded-lg px-3 py-2 text-sm font-medium " +
                          (isAttached
                            ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                            : "bg-indigo-600 text-white hover:bg-indigo-700")
                        }
                      >
                        {isAttached ? "Attached" : isAttaching ? "Attaching…" : "Attach"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {pagination && pagination.page < pagination.totalPages && (
              <div className="border-t border-slate-200 p-2 text-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={loadMore}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : `Load more (${pagination.total - papers.length} remaining)`}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 p-4">
          <div className="text-xs text-slate-500">
            Tip: keep papers topic-specific for faster teacher workflows.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
