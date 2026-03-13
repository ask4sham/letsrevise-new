/**
 * Step 3: Read-only storyboard builder.
 * Turns buildScript output into timed scenes for future Manim pipeline.
 * No routes. No DB. No integration.
 */

/**
 * Infer visualHint from text/title/topic.
 */
function inferVisualHint(text, title, topic) {
  const combined = [text, title, topic].filter(Boolean).join(" ").toLowerCase();
  if (combined.includes("microscope")) return "microscope";
  if (combined.includes("magnification")) return "formula";
  if (combined.includes("triangle")) return "triangle";
  if (combined.includes("cell")) return "cell-diagram";
  return "text-slide";
}

/**
 * Compute scene duration (seconds) from word count.
 * duration = clamp(ceil(wordCount / 2.5), 6, 20)
 */
function computeDuration(text) {
  const words = (text || "").trim().split(/\s+/).filter(Boolean).length;
  const raw = Math.ceil(words / 2.5);
  return Math.max(6, Math.min(20, raw));
}

/**
 * Infer scene kind from section index, total count, and content.
 */
function inferKind(idx, total, section) {
  if (idx === 0) return "intro";
  const combined = [section.title || "", section.text || ""].join(" ").toLowerCase();
  if (idx === total - 1 && /summary|recap|remember/.test(combined)) return "summary";
  return "explainer";
}

/**
 * Build storyboard from buildScript output.
 * @param {Object} scriptOutput - { narration, sections, metadata }
 * @returns {Object} { scenes: [{ id, kind, title, text, start, end, duration, visualHint }], metadata }
 */
function buildStoryboard(scriptOutput) {
  const input = scriptOutput || {};
  const sections = Array.isArray(input.sections) ? input.sections : [];
  const meta = input.metadata || {};
  const title = String(meta.title || "").trim();
  const subject = String(meta.subject || "").trim();
  const topic = String(meta.topic || "").trim();

  const scenes = [];
  let currentStart = 0;

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const text = String(s.text || "").trim();
    const sceneTitle = String(s.title || "").trim() || `Scene ${i + 1}`;

    const duration = computeDuration(text);
    const start = currentStart;
    const end = start + duration;
    currentStart = end;

    scenes.push({
      id: s.key || `scene_${i}`,
      kind: inferKind(i, sections.length, s),
      title: sceneTitle,
      text,
      start,
      end,
      duration,
      visualHint: inferVisualHint(text, sceneTitle, topic),
    });
  }

  const totalDurationSeconds = scenes.length > 0 ? scenes[scenes.length - 1].end : 0;

  return {
    scenes,
    metadata: {
      title,
      subject,
      topic,
      sceneCount: scenes.length,
      totalDurationSeconds,
    },
  };
}

module.exports = buildStoryboard;
