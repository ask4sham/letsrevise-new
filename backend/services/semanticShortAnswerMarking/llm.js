const axios = require("axios");
const { getSemanticMarkingModel, getSemanticMarkingTimeoutMs } = require("../../config/block28SemanticMarking");

/**
 * @param {{ system: string, user: string, model?: string, timeoutMs?: number }} params
 * @returns {Promise<object>}
 */
async function callSemanticMarkingLlm(params) {
  const apiKey = String(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || "").trim();
  if (!apiKey) {
    const err = new Error("LLM not configured");
    err.code = "LLM_NOT_CONFIGURED";
    throw err;
  }

  const model = params.model || getSemanticMarkingModel();
  const timeoutMs = params.timeoutMs || getSemanticMarkingTimeoutMs();

  const resp = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 800,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      timeout: timeoutMs,
    }
  );

  const content = (resp.data?.choices?.[0]?.message?.content || "").trim();
  if (!content) {
    const err = new Error("Empty LLM response");
    err.code = "LLM_EMPTY";
    throw err;
  }

  try {
    return JSON.parse(content);
  } catch (e) {
    const err = new Error("Invalid JSON from LLM");
    err.code = "LLM_INVALID_JSON";
    throw err;
  }
}

module.exports = {
  callSemanticMarkingLlm,
};
