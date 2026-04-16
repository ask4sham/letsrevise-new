/**
 * Minimal JSON chat completion for lesson asset generation (flashcards / quiz / exam drafts).
 * Uses same env as enquiry: LLM_API_KEY or OPENAI_API_KEY, LLM_MODEL (default gpt-4o-mini).
 */
const axios = require("axios");

/**
 * @param {{ system: string, user: string, temperature?: number }} opts
 * @returns {Promise<Object>} Parsed JSON object
 */
async function callOpenAiJson(opts) {
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    const err = new Error("LLM_API_KEY or OPENAI_API_KEY is required for lesson asset generation");
    err.code = "LLM_NOT_CONFIGURED";
    throw err;
  }
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const temperature = typeof opts.temperature === "number" ? opts.temperature : 0.25;

  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_object" },
      temperature,
    },
    { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 120000 }
  );

  const content = res.data?.choices?.[0]?.message?.content;
  if (!content) {
    const err = new Error("Empty LLM response");
    err.code = "LLM_EMPTY";
    throw err;
  }
  try {
    return JSON.parse(content);
  } catch (e) {
    const err = new Error("Invalid JSON from LLM: " + e.message);
    err.code = "LLM_BAD_JSON";
    throw err;
  }
}

module.exports = { callOpenAiJson };
