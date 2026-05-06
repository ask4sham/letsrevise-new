/**
 * Phase 2f — WJEC / Eduqas GCSE Science local rows.
 * Run: node scripts/spec-phase2f-smoke.mjs
 */
import { findSpecEntry, normaliseBoardKey } from "../lib/specDatabase/specLookup.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log("Phase 2f WJEC / Eduqas smoke tests…");

assert(normaliseBoardKey("WJEC / Eduqas") === "WJEC / Eduqas", "canonical");
assert(normaliseBoardKey("Eduqas") === "WJEC / Eduqas", "Eduqas");
assert(normaliseBoardKey("WJEC") === "WJEC / Eduqas", "WJEC");
assert(normaliseBoardKey("WJEC Eduqas") === "WJEC / Eduqas", "WJEC Eduqas");

// A) Biology + Bacterial diseases
{
  const r = findSpecEntry({
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "WJEC / Eduqas",
    topic: "Bacterial diseases",
    tier: "Higher Tier",
    qualificationType: "single-science",
  });
  assert(r.entry?.board === "WJEC / Eduqas", "A: board");
  assert(r.entry?.topic === "Bacterial diseases", "A: topic");
  assert(r.entry?.qualification === "GCSE Biology", "A: GCSE Biology");
}

// B) Combined + Eduqas label
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "Eduqas",
    topic: "Bacterial diseases",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(r.entry?.subject === "Combined Science", "B: Combined");
  assert(r.entry?.topic === "Bacterial diseases", "B: topic");
  assert(r.entry?.route === "biology", "B: biology route");
  assert(
    r.entry?.qualification === "GCSE Combined Science / Science Double Award",
    "B: Double Award qualification"
  );
}

// C) Chemistry + WJEC + Earth and atmosphere
{
  const r = findSpecEntry({
    subject: "Chemistry",
    keyStage: "KS4 - GCSE",
    examBoard: "WJEC",
    topic: "Earth and atmosphere",
    tier: "Foundation Tier",
    qualificationType: "single-science",
  });
  assert(r.entry?.topic === "Earth and atmosphere", "C: Earth and atmosphere");
  assert(r.entry?.qualification === "GCSE Chemistry", "C: GCSE Chemistry");
}

// D) Physics Space physics
{
  const r = findSpecEntry({
    subject: "Physics",
    keyStage: "KS4 - GCSE",
    examBoard: "WJEC / Eduqas",
    topic: "Space physics",
    tier: "Higher Tier",
    qualificationType: "single-science",
  });
  assert(r.entry?.topic === "Space physics", "D: Space physics");
  assert(r.entry?.contentFlags?.singleScienceOnly === true, "D: singleScienceOnly");
}

// E) Combined + Space physics → no match to Space row
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "Eduqas",
    topic: "Space physics",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(!r.entry || r.entry.topic !== "Space physics", "E: no Combined Space physics");
}

// F) Particle model of matter
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "WJEC",
    topic: "Particle model of matter",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(r.entry?.topic === "Particle model", "F: Particle model");
  assert(r.entry?.route === "physics", "F: physics");
}

// G) Radioactivity
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "Eduqas",
    topic: "Radioactivity",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(r.entry?.topic === "Radioactivity", "G: Radioactivity");
  assert(r.entry?.route === "physics", "G: physics");
}

console.log("All Phase 2f smoke checks passed.");
