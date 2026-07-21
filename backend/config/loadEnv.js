'use strict';

/**
 * Load env from backend/.env regardless of process.cwd().
 * Keeps OpenAI / LLM keys available when the server is started from the repo root
 * or another working directory (common cause of "LLM_API_KEY or OPENAI_API_KEY is required").
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function loadBackendEnv() {
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env'),
  ];

  let loadedFrom = null;
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    // override:true so backend/.env wins over a stale shell PORT (e.g. 5050 from synthesiser).
    const result = dotenv.config({ path: envPath, override: true });
    if (!result.error) {
      loadedFrom = envPath;
      break;
    }
  }

  // Alias so either name works for asset generation + tutor LLM.
  const openAi = String(process.env.OPENAI_API_KEY || '').trim();
  const llm = String(process.env.LLM_API_KEY || '').trim();
  if (openAi && !llm) process.env.LLM_API_KEY = openAi;
  if (llm && !openAi) process.env.OPENAI_API_KEY = llm;

  return {
    loadedFrom,
    hasOpenAiKey: Boolean(String(process.env.OPENAI_API_KEY || '').trim()),
  };
}

module.exports = { loadBackendEnv };
