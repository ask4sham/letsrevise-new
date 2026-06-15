/**
 * P1.3B — Merge topic profile, LLM image_prompt, and visual style into final image prompt.
 */
const { buildVisualStyleContract } = require("./visualStyleContract");
const { resolveTopicDiagramProfile, buildProfilePromptSection } = require("./topicDiagramProfiles");

const MAX_FINAL_IMAGE_PROMPT_CHARS = 3800;

/**
 * @param {{
 *   topic?: string;
 *   context?: string|null;
 *   subject?: string;
 *   examBoard?: string;
 *   tier?: string;
 *   llmImagePrompt?: string|null;
 * }} params
 * @returns {{
 *   finalImagePrompt: string;
 *   profileId: string|null;
 *   profileConfidence: "high"|"medium"|"low"|null;
 * }}
 */
function buildFinalImagePrompt({
  topic = "",
  context = null,
  subject = "GCSE Biology",
  examBoard = "AQA",
  tier = "Higher",
  llmImagePrompt = null,
} = {}) {
  const resolved = resolveTopicDiagramProfile({ topic, context, subject, examBoard, tier });
  const style = buildVisualStyleContract({ subject, examBoard });

  const sections = [
    "Create a labelled GCSE exam revision diagram.",
    style,
  ];

  if (resolved?.profile) {
    sections.push(buildProfilePromptSection(resolved.profile));
  } else {
    sections.push(
      "Draw a clear labelled GCSE diagram for the topic below. Include all scientifically important parts with large uppercase labels and directional arrows where relevant."
    );
  }

  sections.push(`Topic: ${String(topic || "").trim() || "GCSE science topic"}.`);

  if (context && String(context).trim()) {
    const ctx = String(context).trim().replace(/[.]+$/g, "");
    sections.push(`Lesson context: ${ctx}.`);
  }

  const llm = String(llmImagePrompt || "").trim();
  if (llm) {
    sections.push(`Additional diagram detail from examiner notes: ${llm}`);
  }

  let finalImagePrompt = sections.join("\n\n");

  if (finalImagePrompt.length > MAX_FINAL_IMAGE_PROMPT_CHARS) {
    finalImagePrompt = `${finalImagePrompt.slice(0, MAX_FINAL_IMAGE_PROMPT_CHARS - 1).trim()}…`;
  }

  return {
    finalImagePrompt,
    profileId: resolved?.profileId ?? null,
    profileConfidence: resolved?.confidence ?? null,
  };
}

module.exports = {
  MAX_FINAL_IMAGE_PROMPT_CHARS,
  buildFinalImagePrompt,
  resolveTopicDiagramProfile,
  buildVisualStyleContract,
  buildProfilePromptSection,
};
