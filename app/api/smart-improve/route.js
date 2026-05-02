import { NextResponse } from "next/server";
import { parseLessonText } from "@/lib/parseLessonText";

const SYSTEM = "You are improving a GCSE lesson.";
const REJECT_REASON = "Smart Improve changed structure";

function normalizePasteTarget(t) {
  return String(t ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getModernStructuralRows(blocks) {
  return blocks
    .filter(
      (b) =>
        typeof b.number === "number" &&
        Number.isFinite(b.number) &&
        b.pasteTarget != null,
    )
    .slice()
    .sort((a, b) => a.number - b.number);
}

/** Legacy / unstructured lines: skip bare page markers only. */
function getLegacyStructuralRows(blocks) {
  return blocks.filter((b) => b.type !== "page");
}

function checkpointOptionLength(block) {
  if (block.type !== "checkpoint" && block.type !== "quick-check") {
    return null;
  }
  const opts = Array.isArray(block.options) ? block.options : [];
  return opts.length;
}

function keywordsItemLength(block) {
  if (block.type !== "keywords") return null;
  const items = Array.isArray(block.items) ? block.items : [];
  return items.length;
}

function isDiagramLikeBlock(block) {
  const t = block.type;
  return (
    t === "diagram" ||
    t === "interactive-diagram" ||
    t === "step-by-step-diagram"
  );
}

/** Returns { ok: true } or { ok: false }. */
function validatePreservedStructure(draftText, improvedText) {
  const original = parseLessonText(draftText);
  const improved = parseLessonText(improvedText);

  const origModern = getModernStructuralRows(original);
  const imprModern = getModernStructuralRows(improved);

  if (origModern.length > 0 || imprModern.length > 0) {
    if (origModern.length !== imprModern.length) {
      return { ok: false };
    }

    let origDiagrams = 0;
    let imprDiagrams = 0;

    for (let i = 0; i < origModern.length; i++) {
      const o = origModern[i];
      const n = imprModern[i];

      if (
        normalizePasteTarget(o.pasteTarget) !==
        normalizePasteTarget(n.pasteTarget)
      ) {
        return { ok: false };
      }

      const oOpts = checkpointOptionLength(o);
      const nOpts = checkpointOptionLength(n);
      if (oOpts !== null || nOpts !== null) {
        if (oOpts !== nOpts) return { ok: false };
      }

      const oKw = keywordsItemLength(o);
      const nKw = keywordsItemLength(n);
      if (oKw !== null || nKw !== null) {
        if (oKw !== nKw) return { ok: false };
      }

      if (isDiagramLikeBlock(o)) origDiagrams++;
      if (isDiagramLikeBlock(n)) imprDiagrams++;
    }

    if (origDiagrams !== imprDiagrams) {
      return { ok: false };
    }

    return { ok: true };
  }

  const oLeg = getLegacyStructuralRows(original);
  const iLeg = getLegacyStructuralRows(improved);

  if (oLeg.length !== iLeg.length) {
    return { ok: false };
  }

  let oDiagrams = oLeg.filter(isDiagramLikeBlock).length;
  let iDiagrams = iLeg.filter(isDiagramLikeBlock).length;

  if (oDiagrams !== iDiagrams) {
    return { ok: false };
  }

  for (let i = 0; i < oLeg.length; i++) {
    if (oLeg[i].type !== iLeg[i].type) {
      return { ok: false };
    }

    const oOpts = checkpointOptionLength(oLeg[i]);
    const nOpts = checkpointOptionLength(iLeg[i]);
    if (oOpts !== null || nOpts !== null) {
      if (oOpts !== nOpts) return { ok: false };
    }

    const oKw = keywordsItemLength(oLeg[i]);
    const nKw = keywordsItemLength(iLeg[i]);
    if (oKw !== null || nKw !== null) {
      if (oKw !== nKw) return { ok: false };
    }
  }

  return { ok: true };
}

function buildUserMessage({ draft, topic, subject }) {
  const lines = [];

  const subj = typeof subject === "string" ? subject.trim() : "";
  const top = typeof topic === "string" ? topic.trim() : "";
  if (subj || top) {
    lines.push(
      `Context: Subject: ${subj || "Science"}. Topic: ${top || "—"}.`,
      "",
    );
  }

  lines.push(
    "Improve the clarity, flow, and teacher tone of this lesson.",
    "",
    "Rules:",
    "- Do NOT change structure",
    "- Do NOT remove sections",
    "- Do NOT change checkpoint format",
    "- Do NOT change keywords format",
    "- Do NOT change diagram instructions",
    "- Keep all headings EXACTLY the same",
    "- Only improve wording, clarity, and explanation quality",
    "",
    "Return the improved lesson.",
    "",
    typeof draft === "string" ? draft.trim() : "",
  );

  return lines.join("\n");
}

async function chatComplete({ apiKey, model, messages }) {
  const baseUrl =
    (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      messages,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      `OpenAI HTTP ${res.status}`;
    throw new Error(msg);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Empty response from model.");
  }

  return text.trim();
}

export async function POST(req) {
  try {
    const body = await req.json();
    const draft = body.draft ?? "";
    const topic = body.topic ?? "";
    const subject = body.subject ?? "";

    if (!String(draft).trim()) {
      return NextResponse.json(
        { error: "Missing draft lesson text." },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 },
      );
    }

    const model =
      process.env.SMART_IMPROVE_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-4o-mini";

    const userContent = buildUserMessage({ draft, topic, subject });

    const improved = await chatComplete({
      apiKey,
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userContent },
      ],
    });

    const structural = validatePreservedStructure(String(draft), improved);
    if (!structural.ok) {
      return NextResponse.json({
        text: String(draft),
        rejected: true,
        reason: REJECT_REASON,
      });
    }

    return NextResponse.json({ text: improved });
  } catch (error) {
    console.error("smart-improve:", error);
    return NextResponse.json(
      { error: error.message || "Smart improve failed." },
      { status: 500 },
    );
  }
}
