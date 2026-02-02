// frontend/src/pages/CreateLesson.tsx
import React, { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import api from "../services/api";

type HeroType = "none" | "image" | "video" | "animation";
type LessonPageBlockType = "text" | "keyIdea" | "keyWords" | "examTip" | "commonMistake";

type LessonPageBlock = {
  type: LessonPageBlockType;
  content: string;
};

// Kept for backward compatibility only (UI removed)
type LessonPageHero = {
  type: HeroType;
  src: string;
  caption?: string;
};

type LessonPage = {
  pageId: string;
  title: string;
  order: number;
  pageType?: string;
  hero?: LessonPageHero; // legacy compat
  blocks: LessonPageBlock[];
  checkpoint?: {
    question?: string;
    options?: string[];
    answer?: string;
  };
};

type GcseTier = "" | "foundation" | "higher";

const EXAM_BOARDS = ["AQA", "OCR", "Edexcel", "WJEC"] as const;
const SUBJECTS = [
  "Mathematics",
  "Biology",
  "Chemistry",
  "Physics",
  "English",
  "History",
  "Geography",
  "Computer Science",
  "Business",
  "Economics",
] as const;

// Shared UI: Phase 2 – youthful modern polish (one radius + spacing scale)
const radius = 10;
const space = 12;
const ui = {
  page: {
    minHeight: "100vh",
    padding: "6px 10px 14px",
    background:
      "linear-gradient(165deg, #f8fafc 0%, #f1f5f9 40%, #ede9fe 100%), radial-gradient(800px 600px at 10% 10%, rgba(99,102,241,0.08) 0%, transparent 50%), radial-gradient(600px 500px at 90% 20%, rgba(34,197,94,0.06) 0%, transparent 45%), radial-gradient(500px 400px at 70% 80%, rgba(236,72,153,0.05) 0%, transparent 45%)",
  },
  shell: { maxWidth: 1200, margin: "0 auto" },
  card: {
    borderRadius: radius,
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(255,255,255,0.6)",
    boxShadow: "0 4px 24px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04)",
    padding: space,
    backdropFilter: "blur(12px)",
  },
  lessonDetailsSection: {
    borderRadius: radius,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15,23,42,0.04)",
    boxShadow: "0 2px 12px rgba(15,23,42,0.03)",
    padding: space,
  },
  pageEditorSection: {
    borderRadius: radius,
    background: "rgba(255,255,255,0.95)",
    border: "1px solid rgba(15,23,42,0.06)",
    boxShadow: "0 4px 20px rgba(15,23,42,0.05)",
    padding: space,
  },
  section: {
    borderRadius: radius,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15,23,42,0.04)",
    boxShadow: "0 2px 10px rgba(15,23,42,0.03)",
    padding: space,
  },
  sidebar: {
    borderRadius: radius,
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(15,23,42,0.05)",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    padding: 10,
  },
  sectionTitle: { fontWeight: 700, fontSize: "0.9rem", color: "#0f172a", marginBottom: 8 },
  label: { fontWeight: 600, fontSize: "0.8125rem", color: "#475569", marginBottom: 4 },
  labelPrimary: { fontWeight: 600, fontSize: "0.875rem", color: "#0f172a", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: radius,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "rgba(255,255,255,0.95)",
    outline: "none",
  },
  btnPrimary: {
    padding: "10px 18px",
    borderRadius: radius,
    border: "none",
    background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #22c55e 100%)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.9rem",
    boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
  },
  btnSecondary: {
    padding: "8px 12px",
    borderRadius: radius,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "rgba(255,255,255,0.7)",
    color: "#475569",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.8125rem",
  },
  btnDanger: {
    padding: "8px 12px",
    borderRadius: radius,
    border: "1px solid rgba(239,68,68,0.2)",
    background: "rgba(239,68,68,0.06)",
    color: "#b91c1c",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.8125rem",
  },
};

function safeStr(v: any, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s : fallback;
}

function newId() {
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function sortPages(pages: LessonPage[]) {
  return [...pages].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function clampOptions(raw: string[]) {
  return raw.map((s) => safeStr(s, "")).slice(0, 4);
}

// ============================
// Step 4.1 — Sanitize markdown helper
// ============================
function sanitizeTeacherMarkdown(input: string) {
  let text = (input || "").replace(/\r\n/g, "\n");

  // 1) Convert common bullet markers at start of line into "- "
  text = text.replace(/^[ \t]*[•·–—*]\s*/gm, "- ");
  // Also normalize dash bullets to "- "
  text = text.replace(/^[ \t]*-\s*(?=\S)/gm, "- ");

  // 2) If a "heading-like" line is followed by a list, convert to ### Heading
  // (only if it isn't already a markdown heading)
  const lines = text.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i].trim();
    const next = lines[i + 1].trim();

    const looksLikeHeading =
      cur.length > 0 &&
      cur.length <= 60 &&
      !cur.startsWith("#") &&
      !cur.startsWith("-") &&
      !cur.startsWith("*") &&
      !cur.endsWith(".") &&
      !cur.endsWith(":");

    const nextIsList = next.startsWith("- ");

    if (looksLikeHeading && nextIsList) {
      lines[i] = `### ${cur}`;
    }
  }

  return lines.join("\n").trimEnd();
}

// ============================
// Upload helpers (per-block)
// ============================

const MEDIA_BUCKET =
  (process.env.REACT_APP_SUPABASE_MEDIA_BUCKET as string) || "lesson-media";

function slugifyFilename(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.\-_]/g, "");
}

function buildMarkdownForFile(url: string, file: File) {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const alt = file.name.replace(/\.[^/.]+$/, "");

  if (isImage) return `\n\n![${alt}](${url})\n\n`;
  if (isVideo) return `\n\n[Video: ${alt}](${url})\n\n`;
  return `\n\n[${file.name}](${url})\n\n`;
}

/**
 * IMPORTANT FIX:
 * Your app login uses backend JWT (localStorage token), not Supabase auth.
 * So we must NOT block uploads by requiring supabase.auth.getUser().
 *
 * We still upload to Supabase Storage using the anon client.
 * Bucket policies must allow the client to upload (or it will error with 401/403).
 */
function getTeacherIdBestEffort() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return safeStr(u?.id || u?._id || u?.userId || u?.mongoId, "");
  } catch {
    return "";
  }
}

const CreateLessonPage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Upload UI
  const [uploadingKey, setUploadingKey] = useState<string>(""); // pageId:blockIndex
  const [uploadMsg, setUploadMsg] = useState<string>("");
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);

  // refs for cursor insertion + file picking
  const blockTextareasRef = useRef<Record<string, HTMLTextAreaElement | null>>(
    {}
  );
  const fileInputRef = useRef<Record<string, HTMLInputElement | null>>({});

  // Lesson details
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "Mathematics",
    level: "GCSE",
    board: "" as "" | (typeof EXAM_BOARDS)[number],
    tier: "" as GcseTier,
    topic: "",
    tags: "",
    externalResources: "",
    estimatedDuration: 60,
    shamCoinPrice: 0,
  });

  // Pages editor (same data model as EditLessonPage)
  const [pages, setPages] = useState<LessonPage[]>([
    {
      pageId: newId(),
      title: "Page 1",
      order: 1,
      pageType: "",
      hero: { type: "none", src: "", caption: "" }, // legacy compat
      blocks: [{ type: "text", content: "" }],
      checkpoint: { question: "", options: ["", "", "", ""], answer: "" },
    },
  ]);

  const orderedPages = useMemo(() => sortPages(pages), [pages]);

  const normalizeOrders = (arr: LessonPage[]) =>
    arr
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((p, idx) => ({ ...p, order: idx + 1 }));

  // ---------------------------
  // Basic handlers
  // ---------------------------
  const onChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "estimatedDuration" || name === "shamCoinPrice"
          ? Number(value)
          : (value as any),
    }));
  };

  // ---------------------------
  // Pages editor helpers
  // ---------------------------
  const addPage = () => {
    setPages((prev) => {
      const next = normalizeOrders(prev);
      const nextOrder = next.length + 1;
      return [
        ...next,
        {
          pageId: newId(),
          title: `Page ${nextOrder}`,
          order: nextOrder,
          pageType: "",
          hero: { type: "none", src: "", caption: "" }, // legacy compat
          blocks: [{ type: "text", content: "" }],
          checkpoint: { question: "", options: ["", "", "", ""], answer: "" },
        },
      ];
    });
  };

  const removePage = (pageId: string) => {
    if (!window.confirm("Delete this page?")) return;

    setPages((prev) => {
      const next = prev.filter((p) => p.pageId !== pageId);
      const normalized = normalizeOrders(next);
      return normalized.length
        ? normalized
        : [
            {
              pageId: newId(),
              title: "Page 1",
              order: 1,
              pageType: "",
              hero: { type: "none", src: "", caption: "" },
              blocks: [{ type: "text", content: "" }],
              checkpoint: { question: "", options: ["", "", "", ""], answer: "" },
            },
          ];
    });
  };

  const movePage = (pageId: string, dir: -1 | 1) => {
    setPages((prev) => {
      const ordered = normalizeOrders(prev);
      const idx = ordered.findIndex((p) => p.pageId === pageId);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= ordered.length) return ordered;

      const copy = [...ordered];
      const tmp = copy[idx];
      copy[idx] = copy[to];
      copy[to] = tmp;

      return normalizeOrders(copy);
    });
  };

  const updatePage = (pageId: string, patch: Partial<LessonPage>) => {
    setPages((prev) =>
      prev.map((p) => (p.pageId === pageId ? { ...p, ...patch } : p))
    );
  };

  const addBlock = (pageId: string, type: LessonPageBlockType) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageId !== pageId) return p;
        const blocks = Array.isArray(p.blocks) ? [...p.blocks] : [];
        blocks.push({ type, content: "" });
        return { ...p, blocks };
      })
    );
  };

  const removeBlock = (pageId: string, blockIndex: number) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageId !== pageId) return p;
        const blocks = Array.isArray(p.blocks) ? [...p.blocks] : [];
        blocks.splice(blockIndex, 1);
        return {
          ...p,
          blocks: blocks.length ? blocks : [{ type: "text", content: "" }],
        };
      })
    );
  };

  const moveBlock = (pageId: string, from: number, dir: -1 | 1) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageId !== pageId) return p;
        const blocks = Array.isArray(p.blocks) ? [...p.blocks] : [];
        const to = from + dir;
        if (
          from < 0 ||
          from >= blocks.length ||
          to < 0 ||
          to >= blocks.length
        )
          return p;
        const tmp = blocks[from];
        blocks[from] = blocks[to];
        blocks[to] = tmp;
        return { ...p, blocks };
      })
    );
  };

  const updateBlock = (
    pageId: string,
    blockIndex: number,
    patch: Partial<LessonPageBlock>
  ) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageId !== pageId) return p;
        const blocks = Array.isArray(p.blocks) ? [...p.blocks] : [];
        if (blockIndex < 0 || blockIndex >= blocks.length) return p;
        blocks[blockIndex] = { ...blocks[blockIndex], ...patch };
        return { ...p, blocks };
      })
    );
  };

  const updateCheckpoint = (
    pageId: string,
    patch: Partial<NonNullable<LessonPage["checkpoint"]>>
  ) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageId !== pageId) return p;
        const cp = p.checkpoint || {
          question: "",
          options: ["", "", "", ""],
          answer: "",
        };
        return { ...p, checkpoint: { ...cp, ...patch } };
      })
    );
  };

  const updateCheckpointOption = (
    pageId: string,
    optIndex: number,
    value: string
  ) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageId !== pageId) return p;
        const cp = p.checkpoint || {
          question: "",
          options: ["", "", "", ""],
          answer: "",
        };
        const options = Array.isArray(cp.options) ? [...cp.options] : [];
        while (options.length < 4) options.push("");
        options[optIndex] = value;
        return { ...p, checkpoint: { ...cp, options } };
      })
    );
  };

  // ---------------------------
  // Block upload (Supabase Storage)
  // ---------------------------
  const uploadIntoBlock = async (
    file: File,
    pageId: string,
    blockIndex: number,
    getCurrentValue: () => string,
    setValue: (next: string) => void
  ) => {
    if (!file) return;

    const ok =
      file.type.startsWith("image/") || file.type.startsWith("video/");
    if (!ok) {
      alert("Please upload an image (png/jpg/gif/webp) or a video (mp4/webm).");
      return;
    }

    // ✅ Use backend JWT presence as the "signed-in" check (not Supabase auth)
    const token = safeStr(localStorage.getItem("token"), "");
    if (!token) {
      alert("You must be signed in to upload media.");
      return;
    }

    // Best-effort teacher id for nicer storage paths (not security-critical)
    const teacherId = getTeacherIdBestEffort() || "teacher_unknown";

    const safeName = slugifyFilename(file.name || "upload");
    const path = `teacher_${teacherId}/lesson_new/page_${pageId}/block_${blockIndex}/${Date.now()}_${safeName}`;

    const key = `${pageId}:${blockIndex}`;

    try {
      setUploadingKey(key);
      setUploadMsg("");

      const { error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
        });

      if (error) {
        const msg = error.message || "Upload failed";
        // Helpful diagnostics for storage policy issues
        const lower = msg.toLowerCase();
        if (
          lower.includes("bucket not found") ||
          lower.includes("not found")
        ) {
          alert(
            `Bucket not found.\n\nFix:\n1) In Supabase Dashboard → Storage, create a bucket named "${MEDIA_BUCKET}"\n   (or set REACT_APP_SUPABASE_MEDIA_BUCKET to your real bucket name)\n2) Make the bucket Public OR add policies for read/upload.\n\nThen try upload again.`
          );
        } else if (
          lower.includes("unauthorized") ||
          lower.includes("permission") ||
          lower.includes("row-level") ||
          lower.includes("not allowed") ||
          lower.includes("forbidden")
        ) {
          alert(
            `Upload blocked by Supabase Storage policy.\n\nYour app is authenticated via backend JWT (not Supabase auth), so direct client uploads need a permissive Storage policy.\n\nFast fix options:\n- Make the bucket public and allow inserts (least strict), OR\n- Implement a backend upload endpoint that uses the Supabase SERVICE ROLE to upload.\n\nExact error:\n${msg}`
          );
        } else {
          alert(msg);
        }
        console.error(error);
        return;
      }

      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) {
        alert("Upload succeeded but URL could not be created.");
        return;
      }

      const insert = buildMarkdownForFile(publicUrl, file);
      const textarea = blockTextareasRef.current[key];
      const current = getCurrentValue();

      if (!textarea) {
        setValue(current + insert);
        setUploadMsg("✅ Uploaded and inserted.");
        return;
      }

      const start = textarea.selectionStart ?? current.length;
      const end = textarea.selectionEnd ?? current.length;

      const next = current.slice(0, start) + insert + current.slice(end);
      setValue(next);

      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + insert.length;
        textarea.setSelectionRange(pos, pos);
      });

      setUploadMsg("✅ Uploaded and inserted.");
      setTimeout(() => setUploadMsg(""), 2000);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Upload failed");
    } finally {
      setUploadingKey("");
    }
  };

  const triggerBlockUpload = (pageId: string, blockIndex: number) => {
    const key = `${pageId}:${blockIndex}`;
    const input = fileInputRef.current[key];
    if (!input) return;
    input.value = "";
    input.click();
  };

  // ---------------------------
  // Validation + Submit
  // ---------------------------
  const validate = () => {
    if (!formData.title.trim()) return "Lesson Title is required.";
    if (!formData.description.trim()) return "Short Description is required.";
    if (!formData.subject.trim()) return "Subject is required.";
    if (!formData.level.trim()) return "Level is required.";
    if (!formData.board.trim())
      return "Board is required (AQA/OCR/Edexcel/WJEC).";
    if (!formData.topic.trim()) return "Topic / Unit is required.";

    if (formData.level === "GCSE" && !formData.tier.trim()) {
      return "Tier is required for GCSE lessons (Foundation or Higher).";
    }

    const p = normalizeOrders(pages);
    if (p.length === 0) return "Add at least 1 page.";

    const anyContent = p.some((pg) =>
      (pg.blocks || []).some((b) => safeStr(b.content, "").length > 0)
    );
    if (!anyContent) return "Add some content in the page blocks.";

    // checkpoint sanity (optional)
    const badCheckpoint = p.find((pg) => {
      const q = safeStr(pg.checkpoint?.question, "");
      const opts = clampOptions((pg.checkpoint?.options || []) as string[]);
      const ans = safeStr(pg.checkpoint?.answer, "");
      if (!q && !opts.join("").trim() && !ans) return false;
      const nonEmptyOpts = opts.filter((x) => safeStr(x, "").length > 0);
      if (!q) return true;
      if (nonEmptyOpts.length < 2) return true;
      if (ans && !nonEmptyOpts.some((o) => o.trim() === ans.trim()))
        return true;
      return false;
    });
    if (badCheckpoint)
      return `Checkpoint on "${badCheckpoint.title}" needs question + at least 2 options (and answer must match an option).`;

    return "";
  };

  const handleSubmit = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      setSuccess("");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      // ============================
      // Step 4.2 — Sanitize content right before creating
      // ============================
      const sanitizedPages: LessonPage[] = normalizeOrders(pages).map((p) => ({
        pageId: p.pageId,
        title: safeStr(p.title, `Page ${p.order}`),
        order: p.order,
        pageType: safeStr(p.pageType, ""),
        // legacy compat: always none (UI removed)
        hero: { type: "none", src: "", caption: "" },
        blocks: (p.blocks || []).map((b) => ({
          type: b.type,
          content: sanitizeTeacherMarkdown(String(b.content || "")),
        })),
        checkpoint: p.checkpoint
          ? {
              question: safeStr(p.checkpoint.question, ""),
              options: clampOptions((p.checkpoint.options || []) as string[]),
              answer: safeStr(p.checkpoint.answer, ""),
            }
          : { question: "", options: ["", "", "", ""], answer: "" },
      }));

      const payload: any = {
        title: formData.title,
        description: formData.description,
        subject: formData.subject,
        level: formData.level,
        board: formData.board,
        topic: formData.topic,
        tags: formData.tags,
        content: "Structured lesson (see pages)",
        externalResources: formData.externalResources,
        estimatedDuration: formData.estimatedDuration,
        shamCoinPrice: formData.shamCoinPrice,
        pages: sanitizedPages, // Use sanitized pages instead of raw pages
      };

      if (formData.level === "GCSE" && formData.tier) payload.tier = formData.tier;

      await api.post(`/lessons`, payload);

      setSuccess("✅ Lesson created successfully!");
      setTimeout(() => navigate("/teacher-dashboard"), 700);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message || err?.message || "Failed to create lesson."
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------
  // UI helpers (same look as EditLessonPage)
  // ---------------------------
  const blockLabel = (t: LessonPageBlockType) => {
    if (t === "keyIdea") return "Key idea";
    if (t === "keyWords") return "Key words";
    if (t === "examTip") return "Exam tip";
    if (t === "commonMistake") return "Misconception";
    return "Text";
  };

  const blockStyle = (t: LessonPageBlockType): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: 12,
      borderRadius: 10,
      border: "1px solid rgba(15,23,42,0.06)",
      background: "#fff",
      boxShadow: "0 1px 4px rgba(15,23,42,0.03)",
    };
    if (t === "keyIdea")
      return { ...base, border: "1px solid rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.03)" };
    if (t === "keyWords")
      return { ...base, border: "1px solid rgba(100,116,139,0.2)", background: "rgba(100,116,139,0.04)" };
    if (t === "examTip")
      return { ...base, border: "1px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.03)" };
    if (t === "commonMistake")
      return { ...base, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.03)" };
    return base;
  };

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <div style={ui.page}>
      <div style={ui.shell}>
        {/* Top bar: Back + Create Lesson only */}
        <div
          style={{
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/teacher-dashboard"
            style={{ color: "#6366f1", textDecoration: "none", fontWeight: 600, fontSize: "0.875rem" }}
          >
            ← Back to Teacher Dashboard
          </Link>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              ...ui.btnPrimary,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Creating..." : "Create Lesson"}
          </button>
        </div>
        {/* Status line: error/success/upload (compact) */}
        {(error || success || uploadMsg) ? (
          <div style={{ marginBottom: 8, fontSize: "0.8125rem", color: error ? "#b91c1c" : "#15803d" }}>
            {error || success || uploadMsg}
          </div>
        ) : null}

        <div style={ui.card}>
          <div
            className="create-lesson-editor-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "200px minmax(0, 1fr) 260px",
              gap: space,
              alignItems: "start",
            }}
          >
            {/* LEFT: Pages sidebar (compact, stable width) */}
            <aside
              style={{
                position: "sticky",
                top: 10,
                alignSelf: "start",
                minWidth: 0,
                ...ui.sidebar,
              }}
            >
              <div style={{ ...ui.sectionTitle, marginBottom: 2 }}>Pages</div>
              <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: 8 }}>
                Add pages → edit in main area.
              </div>

              <button
                onClick={addPage}
                style={{ ...ui.btnSecondary, width: "100%", marginBottom: 8 }}
              >
                + Add page
              </button>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {orderedPages.map((p, idx) => (
                  <div
                    key={p.pageId || idx}
                    style={{
                      borderRadius: radius,
                      padding: 8,
                      background: "rgba(248,250,252,0.8)",
                      border: "1px solid rgba(15,23,42,0.06)",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#0f172a", marginBottom: 6 }}>
                      {p.title || `Page ${p.order}`}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => movePage(p.pageId, -1)}
                        disabled={p.order === 1}
                        style={{ ...ui.btnSecondary, flex: 1, padding: "6px 8px" }}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => movePage(p.pageId, 1)}
                        disabled={p.order === orderedPages.length}
                        style={{ ...ui.btnSecondary, flex: 1, padding: "6px 8px" }}
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removePage(p.pageId)}
                        disabled={orderedPages.length === 1}
                        style={{ ...ui.btnDanger, flex: 1, padding: "6px 8px" }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            {/* MIDDLE: lesson details + page editors */}
            <main style={{ minWidth: 0 }}>
              {/* Lesson details (lighter weight so Page editor is main canvas) */}
              <div style={ui.lessonDetailsSection}>
                <div style={ui.sectionTitle}>Lesson details</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <label style={{ display: "block" }}>
                    <div style={ui.labelPrimary}>Title *</div>
                    <input
                      name="title"
                      value={formData.title}
                      onChange={onChange}
                      style={ui.input}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={ui.labelPrimary}>Exam board *</div>
                    <select
                      name="board"
                      value={formData.board}
                      onChange={onChange}
                      style={ui.input}
                    >
                      <option value="">Select board…</option>
                      {EXAM_BOARDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={ui.label}>Subject *</div>
                    <select
                      name="subject"
                      value={formData.subject}
                      onChange={onChange}
                      style={ui.input}
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={ui.label}>Level *</div>
                    <select
                      name="level"
                      value={formData.level}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          level: value,
                          tier: value === "GCSE" ? prev.tier : "",
                        }));
                      }}
                      style={ui.input}
                    >
                      <option value="KS3">KS3</option>
                      <option value="GCSE">GCSE</option>
                      <option value="A-Level">A-Level</option>
                    </select>
                  </label>

                  {formData.level === "GCSE" ? (
                    <label style={{ display: "block" }}>
                      <div style={ui.label}>GCSE Tier *</div>
                      <select
                        name="tier"
                        value={formData.tier}
                        onChange={onChange}
                        style={ui.input}
                      >
                        <option value="">Select tier…</option>
                        <option value="foundation">Foundation</option>
                        <option value="higher">Higher</option>
                      </select>
                    </label>
                  ) : (
                    <div />
                  )}

                  <label style={{ display: "block" }}>
                    <div style={ui.label}>Topic *</div>
                    <input
                      name="topic"
                      value={formData.topic}
                      onChange={onChange}
                      style={ui.input}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={ui.label}>Estimated duration (mins)</div>
                    <input
                      name="estimatedDuration"
                      type="number"
                      value={formData.estimatedDuration}
                      onChange={onChange}
                      style={ui.input}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={ui.label}>ShamCoin price</div>
                    <input
                      name="shamCoinPrice"
                      type="number"
                      value={formData.shamCoinPrice}
                      onChange={onChange}
                      style={ui.input}
                    />
                  </label>
                </div>

                <label style={{ display: "block", width: "100%" }}>
                  <div style={ui.label}>Description *</div>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={onChange}
                    rows={3}
                    style={{ ...ui.input, resize: "vertical", width: "100%" }}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                  <label style={{ display: "block" }}>
                    <div style={ui.label}>Tags (comma separated)</div>
                    <input
                      name="tags"
                      value={formData.tags}
                      onChange={onChange}
                      style={ui.input}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={ui.label}>External resources (comma URLs)</div>
                    <input
                      name="externalResources"
                      value={formData.externalResources}
                      onChange={onChange}
                      style={ui.input}
                    />
                  </label>
                </div>
              </div>

              {/* Editing Page cards (main canvas – stronger emphasis) */}
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                {orderedPages.map((pg) => (
                  <div key={pg.pageId} style={ui.pageEditorSection}>
                    <div style={{ ...ui.sectionTitle, marginBottom: 12 }}>
                      Editing Page: {pg.title || `Page ${pg.order}`}
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                      <button
                        onClick={() => addBlock(pg.pageId, "text")}
                        style={ui.btnSecondary}
                      >
                        + Text
                      </button>
                      <button
                        onClick={() => addBlock(pg.pageId, "keyIdea")}
                        style={{ ...ui.btnSecondary, borderColor: "rgba(59,130,246,0.35)", background: "rgba(59,130,246,0.06)" }}
                      >
                        + Key idea
                      </button>
                      <button
                        onClick={() => addBlock(pg.pageId, "keyWords")}
                        style={{ ...ui.btnSecondary, borderColor: "rgba(100,116,139,0.35)", background: "rgba(100,116,139,0.06)" }}
                      >
                        + Key words
                      </button>
                      <button
                        onClick={() => addBlock(pg.pageId, "examTip")}
                        style={{ ...ui.btnSecondary, borderColor: "rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.06)" }}
                      >
                        + Exam tip
                      </button>
                      <button
                        onClick={() => addBlock(pg.pageId, "commonMistake")}
                        style={{ ...ui.btnSecondary, borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.06)" }}
                      >
                        + Misconception
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <label style={{ display: "block" }}>
                        <div style={ui.label}>Page title</div>
                        <input
                          value={safeStr(pg.title, "")}
                          onChange={(e) => updatePage(pg.pageId, { title: e.target.value })}
                          style={ui.input}
                        />
                      </label>
                      <label style={{ display: "block" }}>
                        <div style={ui.label}>Page type</div>
                        <input
                          value={safeStr(pg.pageType, "")}
                          onChange={(e) => updatePage(pg.pageId, { pageType: e.target.value })}
                          style={ui.input}
                        />
                      </label>
                    </div>

                    {/* Blocks */}
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                      {(pg.blocks || []).map((b, idx) => {
                        const key = `${pg.pageId}:${idx}`;
                        const isUploading = uploadingKey === key;

                        return (
                          <div key={key} style={blockStyle(b.type)}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#334155" }}>{blockLabel(b.type)}</div>
                              <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                  onClick={() => moveBlock(pg.pageId, idx, -1)}
                                  disabled={idx === 0}
                                  style={{ ...ui.btnSecondary, padding: "6px 10px", opacity: idx === 0 ? 0.5 : 1 }}
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => moveBlock(pg.pageId, idx, 1)}
                                  disabled={idx === (pg.blocks?.length || 0) - 1}
                                  style={{ ...ui.btnSecondary, padding: "6px 10px", opacity: idx === (pg.blocks?.length || 0) - 1 ? 0.5 : 1 }}
                                >
                                  ↓
                                </button>
                                <button
                                  onClick={() => triggerBlockUpload(pg.pageId, idx)}
                                  disabled={isUploading}
                                  style={{ ...ui.btnSecondary, padding: "6px 10px" }}
                                >
                                  {isUploading ? "Uploading..." : "Upload image / video"}
                                </button>
                                <button
                                  onClick={() => removeBlock(pg.pageId, idx)}
                                  style={{ ...ui.btnDanger, padding: "6px 10px" }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            {/* hidden file input per block */}
                            <input
                              ref={(el) => {
                                fileInputRef.current[key] = el;
                              }}
                              type="file"
                              accept="image/*,video/*"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;

                                uploadIntoBlock(
                                  f,
                                  pg.pageId,
                                  idx,
                                  () => safeStr(pg.blocks?.[idx]?.content, ""),
                                  (next) => updateBlock(pg.pageId, idx, { content: next })
                                );
                              }}
                            />

                            <textarea
                              ref={(el) => {
                                blockTextareasRef.current[key] = el;
                              }}
                              value={safeStr(b.content, "")}
                              onChange={(e) => updateBlock(pg.pageId, idx, { content: e.target.value })}
                              onPaste={(e) => {
                                // Auto-format pasted bullets into proper markdown list items
                                const pasted = e.clipboardData?.getData("text/plain") ?? "";
                                if (!pasted) return;

                                const looksLikeBullets =
                                  /(^|\n)\s*(•|·|–|—|-|\*)\s+/.test(pasted) || pasted.includes("•");

                                let text = pasted;
                                
                                if (looksLikeBullets) {
                                  e.preventDefault();

                                  // 1) Turn "• a • b • c" into lines if needed
                                  text = pasted.replace(/\s*•\s*/g, "\n• ").trim();

                                  // 2) Convert bullet markers to "- " (with space)
                                  text = text
                                    .split("\n")
                                    .map((line) =>
                                      line.replace(/^[•·–—*-]\s*/gm, "- ")
                                    )
                                    .join("\n");

                                  // 3) Clean double dashes and ensure proper spacing
                                  text = text.replace(/^-\s*(?=\S)/gm, "- ");
                                }
                                
                                // 4) Auto-convert plain headings followed by bullets into markdown headings
                                const lines = text.split("\n");
                                
                                for (let i = 0; i < lines.length - 1; i++) {
                                  const current = lines[i].trim();
                                  const next = lines[i + 1].trim();
                                
                                  const looksLikeHeading =
                                    current.length > 0 &&
                                    current.length < 60 &&
                                    !current.startsWith("-") &&
                                    !current.startsWith("*") &&
                                    !current.endsWith(".") &&
                                    /^- /.test(next);
                                
                                  if (looksLikeHeading) {
                                    lines[i] = `### ${current}`;
                                  }
                                }
                                
                                text = lines.join("\n");

                                const el = e.currentTarget;
                                const start = el.selectionStart ?? el.value.length;
                                const end = el.selectionEnd ?? el.value.length;

                                const before = el.value.slice(0, start);
                                const after = el.value.slice(end);

                                const nextValue = before + text + after;

                                updateBlock(pg.pageId, idx, { content: nextValue });

                                // Optional: restore cursor after paste (next tick)
                                setTimeout(() => {
                                  try {
                                    el.focus();
                                    const pos = start + text.length;
                                    el.setSelectionRange(pos, pos);
                                  } catch {}
                                }, 0);
                              }}
                              placeholder="Write markdown here... (images/videos you upload will be inserted at your cursor)"
                              rows={6}
                              style={{
                                ...ui.input,
                                marginTop: 10,
                                resize: "vertical",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                              }}
                            />
                            <div style={{ marginTop: 8, color: "#64748b", fontSize: "0.8rem" }}>
                              Tip: paste from Word/Google Docs — bullets (•) become <b>- lists</b>, and headings above bullets become <b>### headings</b>.
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Checkpoint */}
                    <div style={{ marginTop: 12, ...ui.section }}>
                      <div style={ui.sectionTitle}>Checkpoint</div>
                      <label style={{ display: "block" }}>
                        <div style={ui.label}>Question</div>
                        <input
                          value={safeStr(pg.checkpoint?.question, "")}
                          onChange={(e) => updateCheckpoint(pg.pageId, { question: e.target.value })}
                          style={ui.input}
                        />
                      </label>
                      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {[0, 1, 2, 3].map((i) => (
                          <label key={i} style={{ display: "block" }}>
                            <div style={ui.label}>Option {i + 1}</div>
                            <input
                              value={safeStr(pg.checkpoint?.options?.[i], "")}
                              onChange={(e) => updateCheckpointOption(pg.pageId, i, e.target.value)}
                              style={ui.input}
                            />
                          </label>
                        ))}
                      </div>
                      <label style={{ display: "block", marginTop: 12 }}>
                        <div style={ui.label}>Answer (text must match one option)</div>
                        <input
                          value={safeStr(pg.checkpoint?.answer, "")}
                          onChange={(e) => updateCheckpoint(pg.pageId, { answer: e.target.value })}
                          style={ui.input}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Advanced (optional) – collapsed by default */}
              <div style={{ marginTop: space, border: "1px solid rgba(15,23,42,0.05)", borderRadius: radius, overflow: "hidden", background: "rgba(255,255,255,0.6)" }}>
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((o) => !o)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "rgba(248,250,252,0.8)",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    color: "#475569",
                  }}
                >
                  <span>Advanced (optional)</span>
                  <span style={{ fontSize: "0.75rem" }}>{advancedOpen ? "▼" : "▶"}</span>
                </button>
                {advancedOpen && (
                  <div style={{ padding: space, background: "rgba(255,255,255,0.9)", borderTop: "1px solid rgba(15,23,42,0.05)" }}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                      Revision materials, flashcards, quiz questions, and student review settings can be added here in a future update.
                    </p>
                  </div>
                )}
              </div>
            </main>

            {/* RIGHT: Preview */}
            <aside
              style={{
                position: "sticky",
                top: 10,
                alignSelf: "start",
                minWidth: 0,
                ...ui.sidebar,
              }}
            >
              <div style={{ ...ui.sectionTitle, marginBottom: 8 }}>Preview</div>
              <div style={{ fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.5 }}>
                {formData.title ? (
                  <>
                    <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>{formData.title}</div>
                    {formData.description && (
                      <div style={{ marginBottom: 8 }}>{formData.description.slice(0, 120)}{formData.description.length > 120 ? "…" : ""}</div>
                    )}
                    <div style={{ marginTop: 8 }}>{orderedPages.length} page{orderedPages.length !== 1 ? "s" : ""}</div>
                  </>
                ) : (
                  <span>Lesson title and content will appear here.</span>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateLessonPage;