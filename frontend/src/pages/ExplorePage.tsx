import React, { useEffect, useMemo, useState } from "react";

type Ks3Topic = { topic: string; path: string; hasIndex: boolean };
type Ks3Subject = {
  subject: string;
  path: string;
  hasIndex: boolean;
  topicsPath: string;
  topics: Ks3Topic[];
};
type Ks3Year = { year: string; path: string; hasIndex: boolean; subjects: Ks3Subject[] };

type GcseTopic = { topic: string; path: string; hasIndex: boolean };
type GcseTier = {
  tier: "foundation" | "higher" | string;
  path: string;
  topicsPath: string;
  topics: GcseTopic[];
};
type GcseSubject = {
  subject: string;
  path: string;
  hasIndex: boolean;
  topicsPath: string;
  topics: GcseTopic[];
  tiers: GcseTier[];
};
type GcseBoard = { board: string; subjects: GcseSubject[] };

type ALevelTopic = { topic: string; path: string; hasIndex: boolean };
type ALevelSubject = {
  subject: string;
  path: string;
  hasIndex: boolean;
  topicsPath: string;
  topics: ALevelTopic[];
};
type ALevelBoard = { board: string; subjects: ALevelSubject[] };

type Ks3Tree = { stage: "ks3"; exists: boolean; years: Ks3Year[] };
type GcseTree = { stage: "gcse"; exists: boolean; boards: GcseBoard[]; subjects?: GcseSubject[] };
type ALevelTree = { stage: "a-level"; exists: boolean; boards: ALevelBoard[]; subjects: ALevelSubject[] };

type Stage = "ks3" | "gcse" | "a-level";

const API_BASE = "http://localhost:5000";

// Display-only list (your backend may return "Edexcel" etc — we normalize comparisons)
const ALEVEL_BOARDS_UI = ["AQA", "OCR", "Edexcel", "WJEC"];

function normalize(s: string) {
  return String(s || "").toLowerCase().trim();
}

function StagePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: "1px solid #2a2a2a",
        background: active ? "#111" : "#fff",
        color: active ? "#fff" : "#111",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function Card({
  title,
  subtitle,
  onClick,
  disabled,
}: {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const isDisabled = !!disabled || !onClick;

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      style={{
        width: "100%",
        textAlign: "left",
        padding: 14,
        borderRadius: 14,
        border: "1px solid #e8e8e8",
        background: "#fff",
        cursor: isDisabled ? "not-allowed" : "pointer",
        boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
        opacity: isDisabled ? 0.55 : 1,
        pointerEvents: "auto",
        position: "relative",
      }}
    >
      <div style={{ fontWeight: 850, fontSize: 16 }}>{title}</div>
      {subtitle ? (
        <div style={{ marginTop: 6, color: "#555", fontSize: 13 }}>{subtitle}</div>
      ) : null}
    </button>
  );
}

export default function ExplorePage() {
  const [stage, setStage] = useState<Stage>("gcse");

  const [ks3Tree, setKs3Tree] = useState<Ks3Tree | null>(null);
  const [gcseTree, setGcseTree] = useState<GcseTree | null>(null);
  const [alevelTree, setALevelTree] = useState<ALevelTree | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // KS3 selection
  const [ks3Year, setKs3Year] = useState<string>("");
  const [ks3Subject, setKs3Subject] = useState<string>("");

  // GCSE selection
  const [gcseBoard, setGcseBoard] = useState<string>("");
  const [gcseSubject, setGcseSubject] = useState<string>("");
  const [gcseTier, setGcseTier] = useState<string>(""); // foundation/higher or ""

  // A-Level selection (locked flow: Subject → Board → Topics)
  const [alevelSubject, setALevelSubject] = useState<string>("");
  const [alevelBoard, setALevelBoard] = useState<string>("AQA");

  async function fetchTree(nextStage: Stage) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/content-tree?stage=${encodeURIComponent(nextStage)}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();

      if (nextStage === "ks3") setKs3Tree(data);
      if (nextStage === "gcse") setGcseTree(data);
      if (nextStage === "a-level") setALevelTree(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load content tree");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTree(stage);

    // reset selections when stage changes
    setKs3Year("");
    setKs3Subject("");
    setGcseBoard("");
    setGcseSubject("");
    setGcseTier("");
    setALevelSubject("");
    setALevelBoard("AQA");
  }, [stage]);

  function openContent(relativePath: string) {
    // backend serves /content/... as static
    window.open(`${API_BASE}${relativePath}`, "_blank", "noopener,noreferrer");
  }

  // ===================== KS3 helpers =====================
  const ks3Years = useMemo(() => ks3Tree?.years || [], [ks3Tree]);

  const ks3SelectedYearObj = useMemo(
    () => ks3Years.find((y) => normalize(y.year) === normalize(ks3Year)) || null,
    [ks3Years, ks3Year]
  );

  const ks3Subjects = useMemo(() => ks3SelectedYearObj?.subjects || [], [ks3SelectedYearObj]);

  const ks3SelectedSubjectObj = useMemo(
    () => ks3Subjects.find((s) => normalize(s.subject) === normalize(ks3Subject)) || null,
    [ks3Subjects, ks3Subject]
  );

  // ===================== GCSE helpers =====================
  const gcseBoards = useMemo(() => gcseTree?.boards || [], [gcseTree]);

  const gcseSelectedBoardObj = useMemo(
    () => gcseBoards.find((b) => normalize(b.board) === normalize(gcseBoard)) || null,
    [gcseBoards, gcseBoard]
  );

  const gcseSubjects = useMemo(() => gcseSelectedBoardObj?.subjects || [], [gcseSelectedBoardObj]);

  const gcseSelectedSubjectObj = useMemo(
    () => gcseSubjects.find((s) => normalize(s.subject) === normalize(gcseSubject)) || null,
    [gcseSubjects, gcseSubject]
  );

  const gcseHasTiers = useMemo(
    () => (gcseSelectedSubjectObj?.tiers && gcseSelectedSubjectObj.tiers.length > 0) || false,
    [gcseSelectedSubjectObj]
  );

  const gcseTierObj = useMemo(() => {
    if (!gcseSelectedSubjectObj) return null;
    if (!gcseHasTiers) return null;
    return (
      gcseSelectedSubjectObj.tiers.find((t) => normalize(t.tier) === normalize(gcseTier)) || null
    );
  }, [gcseSelectedSubjectObj, gcseHasTiers, gcseTier]);

  // ===================== A-LEVEL helpers =====================
  // Your backend currently returns subjects at root (boards: []).
  // If later you add /a-level/<Board>/<Subject>/... this still works:
  // - subjects list becomes the UNION across boards
  const alevelSubjects = useMemo(() => {
    if (!alevelTree) return [];
    const direct = alevelTree.subjects || [];
    const viaBoards =
      alevelTree.boards?.flatMap((b) => b.subjects.map((s) => ({ ...s, __board: b.board } as any))) || [];

    // union by subject name
    const map = new Map<string, ALevelSubject>();
    for (const s of direct) map.set(normalize(s.subject), s);
    for (const s of viaBoards) {
      const key = normalize(s.subject);
      if (!map.has(key)) map.set(key, s);
    }
    return Array.from(map.values()).sort((a, b) => a.subject.localeCompare(b.subject));
  }, [alevelTree]);

  const alevelBoardsAvailableForSubject = useMemo(() => {
    if (!alevelTree) return [];
    if (!alevelSubject) return [];

    // If a-level boards exist in content tree, only show those boards that contain this subject.
    if (alevelTree.boards && alevelTree.boards.length > 0) {
      const boards = alevelTree.boards
        .filter((b) => b.subjects.some((s) => normalize(s.subject) === normalize(alevelSubject)))
        .map((b) => b.board);
      return boards.length ? boards : ALEVEL_BOARDS_UI;
    }

    // Otherwise UX list (same as GCSE)
    return ALEVEL_BOARDS_UI;
  }, [alevelTree, alevelSubject]);

  const alevelSelectedSubjectObj = useMemo(() => {
    if (!alevelTree || !alevelSubject) return null;

    // If boards exist in tree, try to resolve subject under selected board
    if (alevelTree.boards && alevelTree.boards.length > 0) {
      const boardObj =
        alevelTree.boards.find((b) => normalize(b.board) === normalize(alevelBoard)) ||
        alevelTree.boards[0] ||
        null;

      const subj =
        boardObj?.subjects.find((s) => normalize(s.subject) === normalize(alevelSubject)) || null;

      return subj;
    }

    // current reality: a-level/<subject>/topics
    return (
      (alevelTree.subjects || []).find((s) => normalize(s.subject) === normalize(alevelSubject)) ||
      null
    );
  }, [alevelTree, alevelSubject, alevelBoard]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18, position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>Explore</div>
          <div style={{ color: "#555", marginTop: 4 }}>
            KS3: Year → Subject → Topic • GCSE: Board → Subject → (Tier if exists) → Topic • A-Level: Subject → Board → Topic
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StagePill label="KS3" active={stage === "ks3"} onClick={() => setStage("ks3")} />
          <StagePill label="GCSE" active={stage === "gcse"} onClick={() => setStage("gcse")} />
          <StagePill label="A-Level" active={stage === "a-level"} onClick={() => setStage("a-level")} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {loading ? <div style={{ padding: 12 }}>Loading…</div> : null}
        {error ? (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: "#fff3f3",
              border: "1px solid #ffd0d0",
            }}
          >
            <b>Error:</b> {error}
          </div>
        ) : null}
      </div>

      {/* ===================== KS3 ===================== */}
      {stage === "ks3" && (
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>1) Choose Year</div>
            <div style={{ display: "grid", gap: 10 }}>
              {ks3Years.map((y) => (
                <Card
                  key={y.year}
                  title={y.year.toUpperCase()}
                  subtitle={`${y.subjects.length} subjects`}
                  onClick={() => {
                    setKs3Year(y.year);
                    setKs3Subject("");
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>2) Choose Subject</div>
            {!ks3SelectedYearObj ? (
              <div style={{ color: "#666" }}>Pick a year first.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {ks3Subjects.map((s) => (
                  <Card
                    key={s.subject}
                    title={s.subject}
                    subtitle={`${s.topics.length} topics`}
                    onClick={() => setKs3Subject(s.subject)}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>3) Topics</div>
            {!ks3SelectedSubjectObj ? (
              <div style={{ color: "#666" }}>Pick a subject.</div>
            ) : ks3SelectedSubjectObj.topics.length === 0 ? (
              <div style={{ color: "#666" }}>No topics yet in this folder.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {ks3SelectedSubjectObj.topics.map((t) => (
                  <Card
                    key={t.path}
                    title={t.topic}
                    subtitle={t.hasIndex ? "Open lesson" : "No index.html yet"}
                    onClick={() => openContent(t.path)}
                    disabled={!t.path}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== GCSE ===================== */}
      {stage === "gcse" && (
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>1) Choose Exam Board</div>
            <div style={{ display: "grid", gap: 10 }}>
              {gcseBoards.map((b) => (
                <Card
                  key={b.board}
                  title={b.board}
                  subtitle={`${b.subjects.length} subjects`}
                  onClick={() => {
                    setGcseBoard(b.board);
                    setGcseSubject("");
                    setGcseTier("");
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>2) Choose Subject</div>
            {!gcseSelectedBoardObj ? (
              <div style={{ color: "#666" }}>Pick a board first.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {gcseSubjects.map((s) => (
                  <Card
                    key={s.subject}
                    title={s.subject}
                    subtitle={
                      s.tiers && s.tiers.length > 0
                        ? `Has tiers (${s.tiers.map((t) => t.tier).join(", ")})`
                        : `${s.topics.length} topics`
                    }
                    onClick={() => {
                      setGcseSubject(s.subject);
                      setGcseTier("");
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>
              3) {gcseHasTiers ? "Choose Tier → Topics" : "Topics"}
            </div>

            {!gcseSelectedSubjectObj ? (
              <div style={{ color: "#666" }}>Pick a subject.</div>
            ) : gcseHasTiers ? (
              <div style={{ display: "grid", gap: 10 }}>
                {/* Tier buttons */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setGcseTier("foundation")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #e8e8e8",
                      background: normalize(gcseTier) === "foundation" ? "#111" : "#fff",
                      color: normalize(gcseTier) === "foundation" ? "#fff" : "#111",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Foundation
                  </button>

                  <button
                    type="button"
                    onClick={() => setGcseTier("higher")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #e8e8e8",
                      background: normalize(gcseTier) === "higher" ? "#111" : "#fff",
                      color: normalize(gcseTier) === "higher" ? "#fff" : "#111",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Higher
                  </button>
                </div>

                {/* Topics list */}
                {!gcseTierObj ? (
                  <div style={{ color: "#666" }}>Select Foundation or Higher.</div>
                ) : gcseTierObj.topics.length === 0 ? (
                  <div style={{ color: "#666" }}>No topics yet in this tier folder.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {gcseTierObj.topics.map((t) => (
                      <Card
                        key={t.path}
                        title={t.topic}
                        subtitle={t.hasIndex ? "Open lesson" : "No index.html yet"}
                        onClick={() => openContent(t.path)}
                        disabled={!t.path}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : gcseSelectedSubjectObj.topics.length === 0 ? (
              <div style={{ color: "#666" }}>No topics yet in this folder.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {gcseSelectedSubjectObj.topics.map((t) => (
                  <Card
                    key={t.path}
                    title={t.topic}
                    subtitle={t.hasIndex ? "Open lesson" : "No index.html yet"}
                    onClick={() => openContent(t.path)}
                    disabled={!t.path}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== A-LEVEL ===================== */}
      {stage === "a-level" && (
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>1) Choose Subject</div>
            <div style={{ display: "grid", gap: 10 }}>
              {alevelSubjects.map((s) => (
                <Card
                  key={s.subject}
                  title={s.subject}
                  subtitle="Open board options"
                  onClick={() => setALevelSubject(s.subject)}
                />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>2) Choose Exam Board</div>
            {!alevelSubject ? (
              <div style={{ color: "#666" }}>Pick a subject first.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {alevelBoardsAvailableForSubject.map((b) => (
                  <Card
                    key={b}
                    title={b}
                    subtitle={normalize(alevelBoard) === normalize(b) ? "Selected" : "Choose this board"}
                    onClick={() => setALevelBoard(b)}
                  />
                ))}
                {alevelTree?.boards?.length ? (
                  <div style={{ color: "#666", fontSize: 12, marginTop: 6 }}>
                    Board folders detected in content. Topics will open from: <b>/a-level/&lt;Board&gt;/&lt;Subject&gt;/topics</b>
                  </div>
                ) : (
                  <div style={{ color: "#666", fontSize: 12, marginTop: 6 }}>
                    Board selection is UX-only until you add board folders for A-Level.
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>3) Topics</div>
            {!alevelSelectedSubjectObj ? (
              <div style={{ color: "#666" }}>Pick a subject.</div>
            ) : alevelSelectedSubjectObj.topics.length === 0 ? (
              <div style={{ color: "#666" }}>No topics yet in this folder.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {alevelSelectedSubjectObj.topics.map((t) => (
                  <Card
                    key={t.path}
                    title={t.topic}
                    subtitle={`Open lesson • Board: ${alevelBoard}`}
                    onClick={() => openContent(t.path)}
                    disabled={!t.path}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
