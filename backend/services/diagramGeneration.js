/**
 * Context-aware diagram generation (Algorithm 4 lightweight + Phase 2 alignment).
 * - Builds prompt from lesson context; calls DALL·E 3; saves image to uploads; optional alignment check + retry.
 */
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const UPLOADS_BASE = path.join(__dirname, "..", "uploads");
const AI_DIAGRAMS_FOLDER = "ai-diagrams";
const IMAGE_MODEL = "dall-e-3";
const IMAGE_SIZE = "1024x1024";
const ALIGNMENT_THRESHOLD = 7; // 0-10 scale; retry if below
const ALIGNMENT_MODEL = "gpt-4o"; // vision-capable for image + text

function safeStr(v, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s.trim() : fallback;
}

/**
 * Build an educational image prompt from lesson context.
 * @param {{ content: string, subject?: string, level?: string, topic?: string, purpose?: string }} ctx
 */
function buildDiagramPrompt(ctx) {
  const content = safeStr(ctx.content, "").slice(0, 1500);
  const subject = safeStr(ctx.subject, "Science");
  const level = safeStr(ctx.level, "GCSE");
  const topic = safeStr(ctx.topic, "");
  const purpose = safeStr(ctx.purpose, "");

  let prompt = `Create a single educational diagram or illustration for UK ${level} ${subject} students.`;
  if (topic) prompt += ` Topic: ${topic}.`;
  if (purpose) prompt += ` Purpose: ${purpose}.`;
  prompt += ` Style: clear, labelled diagram suitable for revision notes. Age-appropriate for 14-16 year olds. Avoid clutter; focus on one main concept. No text blocks in the image except minimal labels. Clean background.`;
  if (content) {
    prompt += ` The diagram must accurately represent the following content: ${content.slice(0, 800)}`;
  }
  return prompt;
}

/**
 * Call OpenAI Images API (DALL·E 3), return first image URL.
 * @param {string} prompt
 * @returns {Promise<string>} temporary URL (must be downloaded promptly)
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
      response_format: "url",
      quality: "standard",
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    }
  );

  const url = resp.data?.data?.[0]?.url;
  if (!url) throw new Error("OpenAI Images API did not return an image URL");
  return url;
}

/**
 * Download image from URL and save under uploads/ai-diagrams/{userId}/{filename}.png.
 * Returns public path (e.g. /uploads/ai-diagrams/xxx/file.png).
 * @param {string} remoteUrl
 * @param {string} userId - for namespacing (owner or "shared")
 * @returns {Promise<{ publicPath: string, localPath: string }>}
 */
async function downloadAndSaveImage(remoteUrl, userId) {
  const dir = path.join(UPLOADS_BASE, AI_DIAGRAMS_FOLDER, String(userId || "shared"));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `diagram-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.png`;
  const localPath = path.join(dir, filename);

  const resp = await axios.get(remoteUrl, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxContentLength: 10 * 1024 * 1024,
  });

  fs.writeFileSync(localPath, resp.data);

  const publicPath = `/uploads/${AI_DIAGRAMS_FOLDER}/${userId || "shared"}/${filename}`.replace(/\\/g, "/");
  return { publicPath, localPath };
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
 * Generate alt text for the diagram using lesson context (accessibility).
 * @param {string} imagePublicPath - for context only (we don't send image again)
 * @param {string} lessonSnippet
 * @returns {Promise<string>}
 */
async function generateAltText(lessonSnippet) {
  if (process.env.DISABLE_OPENAI === "1") return "Educational diagram for this lesson.";

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "Educational diagram.";

  const snippet = safeStr(lessonSnippet, "").slice(0, 500);
  try {
    const resp = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Write one short sentence (under 125 chars) describing an educational diagram that would illustrate this content. No preamble. Content: ${snippet}`,
          },
        ],
        max_tokens: 60,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 10000,
      }
    );
    const text = resp.data?.choices?.[0]?.message?.content?.trim() || "Educational diagram for this lesson.";
    return text.slice(0, 125);
  } catch (err) {
    console.warn("generateAltText error:", err?.message);
    return "Educational diagram for this lesson.";
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

  const altText = await generateAltText(snippet);

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
