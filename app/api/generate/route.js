import OpenAI from "openai";
import { buildPrompt } from "@/lib/buildPrompt";
import { deterministicAutoFixLesson } from "@/lib/deterministicAutoFixLesson";
import {
  openaiKeyMissingResponse,
  openaiErrorResponse,
} from "@/lib/openaiRouteErrors";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  const missingKey = openaiKeyMissingResponse();
  if (missingKey) return missingKey;

  try {
    const body = await req.json();

    const {
      subject = "Biology",
      keyStage = "KS4 - GCSE",
      examBoard = "",
      topic,
      extras = "",
      tier = "",
      qualification = "",
      qualificationType = "",
    } = body;

    if (!topic) {
      return new Response(JSON.stringify({ error: "Missing topic" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let tierNorm = tier || "";
    const topicRaw = String(topic || "");
    if (!tierNorm && /\(\s*higher\s+tier\s*\)/i.test(topicRaw)) {
      tierNorm = "Higher Tier";
    }
    if (!tierNorm && /\(\s*foundation\s+tier\s*\)/i.test(topicRaw)) {
      tierNorm = "Foundation Tier";
    }

    const prompt = buildPrompt({
      subject,
      keyStage,
      examBoard,
      topic: topicRaw,
      extras,
      tier: tierNorm,
      qualification,
      qualificationType,
    });

    const model = process.env.OPENAI_GENERATE_MODEL || "gpt-4.1";

    const response = await client.responses.create({
      model,
      input: prompt,
    });

    const text = response.output_text || "";

    const { text: fixedText, fixesApplied } = deterministicAutoFixLesson({
      text,
      subject,
      keyStage,
      examBoard,
      topic: topicRaw,
    });

    return new Response(
      JSON.stringify({ text: fixedText, fixesApplied }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return openaiErrorResponse(error, "generate");
  }
}
