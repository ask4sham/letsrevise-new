"use strict";

const { getLessonSynthesiserV1Config } = require("../../config/lessonSynthesiserV1");

function buildSynthesiserFetchError(code, message, details = {}) {
  return { ok: false, code, message, details };
}

/**
 * @param {object} synthesiseInput
 * @param {{ fetchImpl?: typeof fetch, env?: object, timeoutMs?: number }} [options]
 */
async function callLessonSynthesiser(synthesiseInput, options = {}) {
  const config = getLessonSynthesiserV1Config(options.env || process.env);
  const fetchImpl = options.fetchImpl || global.fetch;
  if (!fetchImpl) {
    return buildSynthesiserFetchError(
      "SYNTHESISER_CLIENT_NO_FETCH",
      "Fetch is not available to call Lesson Synthesiser."
    );
  }

  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(config.synthesiseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(synthesiseInput),
      signal: controller.signal,
    });
    clearTimeout(timer);

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      return buildSynthesiserFetchError(
        "SYNTHESISER_BAD_RESPONSE",
        "Lesson Synthesiser returned a non-JSON response.",
        { httpStatus: response.status }
      );
    }

    if (!response.ok) {
      return buildSynthesiserFetchError(
        payload?.code || "SYNTHESISER_HTTP_ERROR",
        payload?.message || `Lesson Synthesiser HTTP ${response.status}`,
        { httpStatus: response.status, payload }
      );
    }

    return { ok: true, payload };
  } catch (err) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      return buildSynthesiserFetchError(
        "SYNTHESISER_TIMEOUT",
        "Lesson Synthesiser request timed out."
      );
    }
    return buildSynthesiserFetchError(
      "SYNTHESISER_UNREACHABLE",
      err?.message || "Lesson Synthesiser service is unreachable."
    );
  }
}

function buildDraftEnvelopeFromPipelinePayload(pipelinePayload) {
  const draft = pipelinePayload?.export?.letsReviseDraft;
  if (!draft) return null;
  return {
    source: "letsrevise-lesson-synthesiser",
    generator: "lesson-synthesiser-v1",
    draft,
  };
}

module.exports = {
  callLessonSynthesiser,
  buildDraftEnvelopeFromPipelinePayload,
};
