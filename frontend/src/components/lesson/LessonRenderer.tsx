import React from "react";
import type {
  Lesson,
  LessonBlock,
  QuizBlock,
  FlashcardsBlock,
  TableBlock,
  ImageBlock,
} from "../../types/lesson";

type Props = {
  lesson: Lesson;
};

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid #eee",
  borderRadius: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  padding: 18,
};

const muted: React.CSSProperties = { color: "#666" };

// ✅ Backend base (so /uploads and /content load from backend, not frontend)
const BACKEND_BASE =
  (process.env.REACT_APP_BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");

// ✅ Convert "/uploads/..." → "http://localhost:5000/uploads/..."
function resolveAssetUrl(src: string) {
  if (!src) return src;

  // already absolute
  if (/^https?:\/\//i.test(src)) return src;

  // force backend for these roots
  if (src.startsWith("/uploads/") || src.startsWith("/content/")) {
    return `${BACKEND_BASE}${src}`;
  }

  // leave other relative paths alone (e.g. "/logo.png" from frontend public)
  return src;
}

const LessonRenderer: React.FC<Props> = ({ lesson }) => {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "18px 14px" }}>
      {/* Header */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.8rem" }}>{lesson.title}</h1>
            <div style={{ marginTop: 6, ...muted }}>
              <b>{lesson.stage}</b> • <b>{lesson.subject}</b>
              {lesson.topic ? <> • {lesson.topic}</> : null}
              {lesson.difficulty ? <> • {lesson.difficulty}</> : null}
              {typeof lesson.estimatedTime === "number" ? <> • {lesson.estimatedTime} min</> : null}
            </div>
          </div>
          <div style={{ ...muted, fontSize: "0.95rem" }}>
            Lesson ID: <code>{lesson.id}</code>
          </div>
        </div>
      </div>

      {/* Blocks */}
      <div style={{ display: "grid", gap: 14 }}>
        {lesson.blocks.map((block, idx) => (
          <Block key={`${block.type}-${idx}`} block={block} />
        ))}
      </div>
    </div>
  );
};

const Block: React.FC<{ block: LessonBlock }> = ({ block }) => {
  switch (block.type) {
    case "heading":
      return (
        <div style={card}>
          {block.level === 1 && <h2 style={{ margin: 0 }}>{block.text}</h2>}
          {block.level === 2 && <h3 style={{ margin: 0 }}>{block.text}</h3>}
          {block.level === 3 && <h4 style={{ margin: 0 }}>{block.text}</h4>}
        </div>
      );

    case "text":
      return (
        <div style={card}>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "#222" }}>
            {block.content}
          </div>
        </div>
      );

    case "image":
      return <ImageBlockView block={block} />;

    case "table":
      return <TableBlockView block={block} />;

    case "quiz":
      return <QuizBlockView block={block} />;

    case "flashcards":
      return <FlashcardsBlockView block={block} />;

    case "cta":
      return (
        <div style={card}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{block.label}</div>
          <div style={{ color: "#666" }}>
            CTA action: <code>{block.action}</code> (we’ll wire this later)
          </div>
        </div>
      );

    default:
      return (
        <div style={card}>
          <div style={{ color: "#b91c1c", fontWeight: 800 }}>Unknown block</div>
        </div>
      );
  }
};

const ImageBlockView: React.FC<{ block: ImageBlock }> = ({ block }) => {
  const imgSrc = block.src ? resolveAssetUrl(block.src) : "";

  return (
    <div style={card}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>Diagram</div>

      {imgSrc ? (
        <img
          src={imgSrc}
          alt={block.caption || "Lesson diagram"}
          style={{
            width: "100%",
            maxHeight: 520,
            objectFit: "contain",
            borderRadius: 12,
            border: "1px solid #eee",
          }}
        />
      ) : (
        <div
          style={{
            background: "#f8f9fa",
            border: "1px dashed #cbd5e1",
            borderRadius: 12,
            padding: 16,
            color: "#475569",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>No image yet</div>
          <div style={{ fontSize: "0.95rem" }}>
            {block.prompt ? (
              <>
                Prompt stored for generation:
                <div style={{ marginTop: 8 }}>
                  <code>{block.prompt}</code>
                </div>
              </>
            ) : (
              <>This lesson block expects an image (src or prompt).</>
            )}
          </div>
        </div>
      )}

      {block.caption ? <div style={{ marginTop: 10, color: "#666" }}>{block.caption}</div> : null}
      {imgSrc ? (
        <div style={{ marginTop: 10, fontSize: "0.9rem", color: "#777" }}>
          Loaded from: <code>{imgSrc}</code>
        </div>
      ) : null}
    </div>
  );
};

const TableBlockView: React.FC<{ block: TableBlock }> = ({ block }) => {
  return (
    <div style={card}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>Table</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {block.headers.map((h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderBottom: "1px solid #eee",
                    background: "#f8f9fa",
                    fontWeight: 800,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    style={{ padding: "10px 12px", borderBottom: "1px solid #f1f1f1", color: "#222" }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const QuizBlockView: React.FC<{ block: QuizBlock }> = ({ block }) => {
  const [answers, setAnswers] = React.useState<Record<string, number | null>>({});

  return (
    <div style={card}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>Quick Quiz</div>

      <div style={{ display: "grid", gap: 12 }}>
        {block.questions.map((q, idx) => {
          const picked = answers[q.id] ?? null;
          const isCorrect = picked !== null && picked === q.correctAnswer;

          return (
            <div key={q.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                {idx + 1}. {q.question}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {q.options.map((opt, i) => (
                  <label
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #eee",
                      cursor: "pointer",
                      background: picked === i ? "#f8f9fa" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={picked === i}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>

              {picked !== null ? (
                <div style={{ marginTop: 10, fontWeight: 800, color: isCorrect ? "#16a34a" : "#dc2626" }}>
                  {isCorrect ? "Correct ✅" : "Not quite ❌"}
                </div>
              ) : null}

              {picked !== null && q.explanation ? (
                <div style={{ marginTop: 8, color: "#555" }}>{q.explanation}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FlashcardsBlockView: React.FC<{ block: FlashcardsBlock }> = ({ block }) => {
  const [open, setOpen] = React.useState<Record<number, boolean>>({});

  return (
    <div style={card}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>Flashcards</div>

      <div style={{ display: "grid", gap: 10 }}>
        {block.cards.map((c, i) => {
          const flipped = !!open[i];
          return (
            <button
              key={i}
              type="button"
              onClick={() => setOpen((p) => ({ ...p, [i]: !p[i] }))}
              style={{
                textAlign: "left",
                border: "1px solid #eee",
                background: "white",
                borderRadius: 12,
                padding: 14,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{flipped ? "Back" : "Front"}</div>
              <div style={{ color: "#222", lineHeight: 1.6 }}>{flipped ? c.back : c.front}</div>
              <div style={{ marginTop: 8, color: "#667eea", fontWeight: 800, fontSize: "0.95rem" }}>
                Click to {flipped ? "show front" : "flip"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LessonRenderer;
