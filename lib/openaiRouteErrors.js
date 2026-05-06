import { NextResponse } from "next/server";

export const QUOTA_USER_MESSAGE =
  "OpenAI quota/billing limit reached. Check your API project billing, credits, usage limits, or use a different API key.";

export const MISSING_OPENAI_KEY_MESSAGE =
  "OpenAI API key is not configured. Add OPENAI_API_KEY to your environment and restart the dev server.";

export const RATE_LIMIT_USER_MESSAGE =
  "OpenAI rate limit reached. Wait a moment and try again (no automatic retries).";

export const INVALID_KEY_USER_MESSAGE =
  "OpenAI rejected the API key. Check OPENAI_API_KEY.";

export const GENERIC_OPENAI_FAILURE_MESSAGE =
  "The AI service failed to complete this request. Try again later.";

export function extractOpenAIRequestId(error) {
  if (!error || typeof error !== "object") return undefined;
  if (typeof error.request_id === "string") return error.request_id;
  const nested = error.error;
  if (nested && typeof nested === "object" && typeof nested.request_id === "string") {
    return nested.request_id;
  }
  const res = error.response;
  if (res?.headers?.get) {
    return res.headers.get("x-request-id") || res.headers.get("X-Request-Id") || undefined;
  }
  return undefined;
}

function isInsufficientQuota(error, messageLower) {
  const code = error?.code || error?.error?.code;
  const type = error?.type || error?.error?.type;
  if (code === "insufficient_quota" || type === "insufficient_quota") return true;
  return (
    messageLower.includes("insufficient_quota") ||
    messageLower.includes("exceeded your current quota") ||
    messageLower.includes("billing hard limit")
  );
}

function isInvalidApiKey(error, messageLower) {
  const code = error?.code || error?.error?.code;
  if (code === "invalid_api_key") return true;
  return messageLower.includes("incorrect api key") || messageLower.includes("invalid api key");
}

function isRateLimited(error, messageLower) {
  const code = error?.code || error?.error?.code;
  if (code === "rate_limit_exceeded") return true;
  return messageLower.includes("rate limit");
}

export function mapOpenAIErrorToClient(error, routeLabel) {
  const status = typeof error?.status === "number" ? error.status : undefined;
  const rawMessage = String(error?.message || error?.error?.message || "");
  const messageLower = rawMessage.toLowerCase();
  const requestId = extractOpenAIRequestId(error);

  console.error("[openai]", {
    route: routeLabel,
    requestId: requestId || null,
    httpStatus: status ?? null,
    code: error?.code || error?.error?.code || null,
    message: rawMessage.slice(0, 500),
  });

  if (isInsufficientQuota(error, messageLower)) {
    return { status: 429, message: QUOTA_USER_MESSAGE };
  }
  if (isInvalidApiKey(error, messageLower)) {
    return { status: 401, message: INVALID_KEY_USER_MESSAGE };
  }
  if (isRateLimited(error, messageLower)) {
    return { status: 429, message: RATE_LIMIT_USER_MESSAGE };
  }
  if (status === 401) {
    return { status: 401, message: INVALID_KEY_USER_MESSAGE };
  }
  if (status === 429) {
    return { status: 429, message: RATE_LIMIT_USER_MESSAGE };
  }

  return { status: 500, message: GENERIC_OPENAI_FAILURE_MESSAGE };
}

export function openaiKeyMissingResponse() {
  if (process.env.OPENAI_API_KEY && String(process.env.OPENAI_API_KEY).trim()) {
    return null;
  }
  return new Response(JSON.stringify({ error: MISSING_OPENAI_KEY_MESSAGE }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

export function openaiErrorResponse(error, routeLabel) {
  const { status, message } = mapOpenAIErrorToClient(error, routeLabel);
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function openaiKeyMissingNextResponse() {
  if (process.env.OPENAI_API_KEY && String(process.env.OPENAI_API_KEY).trim()) {
    return null;
  }
  return NextResponse.json({ error: MISSING_OPENAI_KEY_MESSAGE }, { status: 503 });
}

export function openaiErrorNextResponse(error, routeLabel) {
  const { status, message } = mapOpenAIErrorToClient(error, routeLabel);
  return NextResponse.json({ error: message }, { status });
}
