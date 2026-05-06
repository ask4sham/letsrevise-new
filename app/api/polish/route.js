import OpenAI from "openai";
import {
  openaiKeyMissingResponse,
  openaiErrorResponse,
} from "@/lib/openaiRouteErrors";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildPolishPrompt(draft) {
  return `
You are improving a LetsRevise lesson draft.

Your job is to turn it into a premium teacher-led lesson that reads like a polished classroom resource.

IMPORTANT:
The lesson currently has the correct broad structure, but the writing needs improving.

You must improve:
- teacher voice
- clarity
- explanation quality
- sequencing
- exam-smart phrasing
- memory-friendly wording
- confidence and precision
- visual variety through purposeful emoji use

The final lesson should feel closer to a strong, previously written LetsRevise lesson and less like AI-generated notes.

RULES:
- Keep the existing numbered section structure
- Keep page labels exactly as they are
- Keep "Paste into:" lines intact
- Do NOT add the word "BLOCK"
- Do NOT add teacher guidance notes into lesson content
- Preserve hidden-answer HTML
- Preserve checkpoint structure
- Preserve model answer reveal HTML
- Keep lesson ready for direct copy/paste into LetsRevise

GCSE LEVEL CONTROL:
If the lesson sounds too advanced for GCSE, rewrite it more simply.
Keep it smart, but clearly teachable to GCSE students.
Do not let the lesson drift into textbook-A-level language unless the selected key stage requires it.

TEACHER VOICE CONTROL:
Rewrite weak or flat sections so they sound like a teacher speaking directly to a class.
The lesson should not sound monotone.
It should sound guided, confident, and purposeful.

EMOJI / VISUAL CONTROL:
Use varied emojis with clear purpose.
Do not overuse one emoji.
Use them to signal different functions, for example:
- 🎯 exam focus
- 🧠 prior knowledge / retrieval
- 📘 core teaching
- ⚡ checkpoints
- 🌍 why this matters
- 💡 key insight
- 🚀 challenge
- ✅ summary
- 📝 exam practice
- 📷 diagram / image / animation

QUALITY TARGET:
Rewrite weak or generic wording so that it becomes:
- more teacher-led
- more concise
- more authoritative
- more memorable
- more exam-relevant

STYLE IMPROVEMENTS TO APPLY:
- Use stronger explanation flow
- Use phrases like:
  - The key idea is...
  - This matters because...
  - Think like an examiner...
  - Remember...
- Improve weak openings
- Replace robotic phrasing with natural teacher language
- Tighten overlong sentences
- Improve recap and summary language
- Make examples more useful
- Strengthen cause → effect links where relevant

DO NOT:
- change the overall lesson topic
- remove numbered sections
- remove checkpoints
- remove diagrams/images/animations
- remove summary or keywords
- introduce fluff
- introduce repetition

Return only the improved lesson.

Lesson draft:
${draft}
  `.trim();
}

export async function POST(req) {
  const missingKey = openaiKeyMissingResponse();
  if (missingKey) return missingKey;

  try {
    const body = await req.json();
    const { draft } = body;

    if (!draft) {
      return new Response(JSON.stringify({ error: "Missing draft" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const model = process.env.OPENAI_POLISH_MODEL || "gpt-4.1";

    const response = await client.responses.create({
      model,
      input: buildPolishPrompt(draft),
    });

    const text = response.output_text || "";

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return openaiErrorResponse(error, "polish");
  }
}
