/**
 * Context-aware diagram generation (Algorithm 4 lightweight + Phase 2 alignment).
 * Uses OpenAI gpt-image-1-mini (Images API b64_json). See docs/ai/DIAGRAM_GENERATION_RESEARCH.md
 * for alternatives (Flux, template diagrams, dedicated science APIs). "Replace diagram" is the recommended path.
 */
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const { FILE_STORAGE_PATH } = require("../config/paths");
const {
  allowLocalUploadFallback,
  cloudUploadRequiredMessage,
  warnLocalDiskFallback,
} = require("../config/storage");
const { tryPutBuffer } = require("./uploadObjectStorage");
const UPLOADS_BASE = FILE_STORAGE_PATH;
const AI_DIAGRAMS_FOLDER = "ai-diagrams";
const IMAGE_MODEL = "gpt-image-1-mini";
const IMAGE_SIZE = "1024x1024";
const IMAGE_MIME = "image/png";
const ALIGNMENT_THRESHOLD = 7; // 0-10 scale; retry if below
const ALIGNMENT_MODEL = "gpt-4o"; // vision-capable for image + text

function safeStr(v, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s.trim() : fallback;
}

/**
 * Build an educational image prompt. Short, clear prompts work best with DALL·E 3.
 * When purpose is set we use only that (no lesson context) to avoid clutter and confusion.
 * @param {{ content: string, subject?: string, level?: string, topic?: string, purpose?: string }} ctx
 */
function buildDiagramPrompt(ctx) {
  const content = safeStr(ctx.content, "").slice(0, 1500);
  const subject = safeStr(ctx.subject, "Science");
  const level = safeStr(ctx.level, "GCSE");
  const topic = safeStr(ctx.topic, "");
  const purpose = safeStr(ctx.purpose, "");

  if (purpose) {
    // Original-only: do not copy existing diagrams. No text (labels added in-app).
    return `Create an original illustration from scratch for ${level} ${subject}: ${purpose}. Do not copy, replicate, or imitate any existing diagram, textbook figure, or copyrighted image. Design a new, unique diagram. One diagram only, one cell or one main shape. Clear, simple style with distinct colors for each part. Do not add any text, words, or labels in the image. Plain white or light background.`;
  }

  // No specific purpose: use lesson context
  let prompt = `Create an original diagram from scratch for UK ${level} ${subject} students. Do not copy any existing diagram or copyrighted material.`;
  if (topic) prompt += ` Topic: ${topic}.`;
  prompt += ` Simple schematic, no text in the image. Plain light background.`;
  if (content) prompt += ` Content to show: ${content.slice(0, 600)}`;
  return prompt;
}

/**
 * Parse a data:image/...;base64,... ref into a buffer.
 * @param {string} dataUrl
 * @returns {{ buffer: Buffer, mimeType: string }}
 */
function parseImageDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image data URL");
  }
  return {
    buffer: Buffer.from(match[2], "base64"),
    mimeType: match[1] || IMAGE_MIME,
  };
}

/**
 * Call OpenAI Images API (gpt-image-1-mini), return a data URL or legacy remote URL.
 * @param {string} prompt
 * @returns {Promise<string>} data:image/png;base64,... or temporary http URL
 */
async function callOpenAIImages(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const resp = await axios.post(
    "https://api.openai.com/v1/images/generations",
    {
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: IMAGE_SIZE,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 120000,
    }
  );

  const item = resp.data?.data?.[0];
  const b64 = item?.b64_json;
  if (b64) {
    return `data:${IMAGE_MIME};base64,${b64}`;
  }

  const url = item?.url;
  if (url) return url;

  throw new Error("OpenAI Images API did not return image data");
}

/**
 * Download image from data URL or remote URL and save under uploads/ai-diagrams/{userId}/{filename}.png.
 * Returns public path (e.g. /uploads/ai-diagrams/xxx/file.png).
 * @param {string} imageRef - data:image/...;base64,... or http(s) URL
 * @param {string} userId - for namespacing (owner or "shared")
 * @returns {Promise<{ publicPath: string, localPath: string }>}
 */
async function downloadAndSaveImage(imageRef, userId) {
  const filename = `diagram-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.png`;
  const storageRel = `${AI_DIAGRAMS_FOLDER}/${userId || "shared"}/${filename}`.replace(/\\/g, "/");

  let buffer;
  let contentType = IMAGE_MIME;
  if (String(imageRef).startsWith("data:")) {
    const parsed = parseImageDataUrl(imageRef);
    buffer = parsed.buffer;
    contentType = parsed.mimeType;
  } else {
    const resp = await axios.get(imageRef, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024,
    });
    buffer = Buffer.from(resp.data);
  }

  const cloud = await tryPutBuffer(buffer, storageRel, contentType);
  if (cloud) {
    return { publicPath: cloud.url, localPath: null, storage: cloud.storage };
  }

  if (!allowLocalUploadFallback()) {
    throw new Error(cloudUploadRequiredMessage());
  }

  warnLocalDiskFallback(`diagramGeneration:${storageRel}`);

  const dir = path.join(UPLOADS_BASE, AI_DIAGRAMS_FOLDER, String(userId || "shared"));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const localPath = path.join(dir, filename);
  fs.writeFileSync(localPath, buffer);

  const publicPath = `/uploads/${storageRel}`.replace(/\\/g, "/");
  return { publicPath, localPath, storage: "local" };
}

/**
 * Phase 2: Verify image matches lesson content using vision model (0-10 score).
 * @param {string} imageUrl - public URL we can send to OpenAI (must be accessible; use data URL or hosted URL)
 * @param {string} lessonSnippet
 * @returns {Promise<{ score: number, feedback?: string }>}
 */
async function verifyImageContentAlignment(imageUrl, lessonSnippet) {
  if (process.env.DISABLE_OPENAI === "1") {
    return { score: 10, feedback: "Skipped (DISABLE_OPENAI)" };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { score: 10 };

  const snippet = safeStr(lessonSnippet, "").slice(0, 1000);
  if (!snippet) return { score: 10 };

  // OpenAI vision requires an absolute, publicly reachable image URL.
  if (!imageUrl || !imageUrl.startsWith("http")) {
    return { score: 10, feedback: "Skipped (no absolute image URL)" };
  }

  try {
    const resp = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: ALIGNMENT_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Rate from 0 to 10 how well this diagram illustrates the following lesson content for students. Reply with ONLY a JSON object: {"score": number, "feedback": "one sentence"}. Lesson content: ${snippet}`,
              },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 150,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const raw = resp.data?.choices?.[0]?.message?.content || "";
    const match = raw.match(/\{\s*"score"\s*:\s*(\d+(?:\.\d+)?)/);
    const score = match ? Math.min(10, Math.max(0, parseFloat(match[1]))) : 10;
    const feedbackMatch = raw.match(/"feedback"\s*:\s*"([^"]*)"/);
    const feedback = feedbackMatch ? feedbackMatch[1] : undefined;
    return { score, feedback };
  } catch (err) {
    console.warn("verifyImageContentAlignment error:", err?.message || err);
    return { score: 10, feedback: "Verification failed" };
  }
}

/**
 * Generate alt text for the diagram. When the user provided a caption (purpose), use it so we don't replace their instruction with AI-generated text.
 * @param {string} lessonSnippet
 * @param {string} [purpose] - user's caption; when set and short, return as-is so caption stays the user's instruction
 * @returns {Promise<string>}
 */
async function generateAltText(lessonSnippet, purpose) {
  if (process.env.DISABLE_OPENAI === "1") return (purpose && String(purpose).trim()) ? String(purpose).trim().slice(0, 125) : "Educational diagram for this lesson.";

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return (purpose && String(purpose).trim()) ? String(purpose).trim().slice(0, 125) : "Educational diagram.";

  const purposeStr = purpose && String(purpose).trim() ? String(purpose).trim() : "";
  if (purposeStr.length > 0) return purposeStr.slice(0, 125);

  const snippet = safeStr(lessonSnippet, "").slice(0, 500);
  try {
    const resp = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: purposeStr
              ? `One short caption (under 125 chars) for a diagram that shows: "${purposeStr}". No preamble.`
              : `Write one short sentence (under 125 chars) describing an educational diagram that would illustrate this content. No preamble. Content: ${snippet}`,
          },
        ],
        max_tokens: 60,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 10000,
      }
    );
    const text = resp.data?.choices?.[0]?.message?.content?.trim() || (purposeStr || "Educational diagram for this lesson.");
    return text.slice(0, 125);
  } catch (err) {
    console.warn("generateAltText error:", err?.message);
    return purposeStr || "Educational diagram for this lesson.";
  }
}

/**
 * Main entry: generate diagram, optionally verify and retry once, save and return.
 * @param {{
 *   content: string,
 *   subject?: string,
 *   level?: string,
 *   topic?: string,
 *   purpose?: string,
 *   userId: string,
 *   runAlignmentCheck?: boolean,
 *   baseUrl?: string - e.g. http://localhost:5000 for absolute image URL in vision call
 * }}
 * @returns {Promise<{ imageUrl: string, altText: string, imageSource: string, alignmentScore?: number, retried?: boolean }>}
 */
async function generateContextAwareDiagram(opts) {
  const {
    content,
    subject,
    level,
    topic,
    purpose,
    userId,
    runAlignmentCheck = false,
    baseUrl = "",
  } = opts;

  const snippet = safeStr(content, "").slice(0, 1500);
  let prompt = buildDiagramPrompt({ content: snippet, subject, level, topic, purpose });
  let remoteUrl = await callOpenAIImages(prompt);
  let { publicPath } = await downloadAndSaveImage(remoteUrl, userId);
  const imageUrl = publicPath;

  let alignmentScore = null;
  let retried = false;

  const canRunAlignment = runAlignmentCheck && process.env.DISABLE_OPENAI !== "1" && baseUrl && baseUrl.startsWith("http");
  if (canRunAlignment) {
    const absoluteImageUrl = !imageUrl.startsWith("http") ? `${baseUrl.replace(/\/$/, "")}${imageUrl}` : imageUrl;
    const verification = await verifyImageContentAlignment(absoluteImageUrl, snippet);
    alignmentScore = verification.score;

    if (verification.score < ALIGNMENT_THRESHOLD && verification.feedback) {
      const refinedPrompt = `${prompt}\n\nImprovement note: ${verification.feedback}`;
      try {
        remoteUrl = await callOpenAIImages(refinedPrompt);
        const saved = await downloadAndSaveImage(remoteUrl, userId);
        publicPath = saved.publicPath;
        retried = true;
        const retryAbsolute = baseUrl && !publicPath.startsWith("http") ? `${baseUrl.replace(/\/$/, "")}${publicPath}` : publicPath;
        const retryVerification = await verifyImageContentAlignment(retryAbsolute, snippet);
        alignmentScore = retryVerification.score;
      } catch (err) {
        console.warn("Diagram retry failed:", err?.message);
      }
    }
  }

  const altText = await generateAltText(snippet, purpose);

  return {
    imageUrl: publicPath,
    altText,
    imageSource: "ai",
    ...(alignmentScore != null && { alignmentScore }),
    ...(retried && { retried: true }),
  };
}

module.exports = {
  buildDiagramPrompt,
  callOpenAIImages,
  downloadAndSaveImage,
  verifyImageContentAlignment,
  generateAltText,
  generateContextAwareDiagram,
  AI_DIAGRAMS_FOLDER,
  ALIGNMENT_THRESHOLD,
};
