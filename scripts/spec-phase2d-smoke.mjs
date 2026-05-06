/**
 * Phase 2d — Edexcel GCSE Science local rows.
 * Run: node scripts/spec-phase2d-smoke.mjs
 */
import { findSpecEntry, normaliseBoardKey } from "../lib/specDatabase/specLookup.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log("Phase 2d Edexcel spec lookup smoke tests…");

assert(normaliseBoardKey("Pearson Edexcel") === "Edexcel", "normalise Pearson Edexcel");
assert(normaliseBoardKey("Edexcel") === "Edexcel", "normalise Edexcel");

// A) Biology + Edexcel + Bacterial diseases → GCSE Biology row
{
  const r = findSpecEntry({
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "Edexcel",
    topic: "Bacterial diseases",
    tier: "Higher Tier",
    qualificationType: "single-science",
  });
  assert(r.entry?.board === "Edexcel", "A: Edexcel board");
  assert(r.entry?.topic === "Bacterial diseases", "A: Bacterial diseases");
  assert(r.entry?.qualification === "GCSE Biology", "A: GCSE Biology");
}

// B) Combined + Edexcel + Bacterial diseases → Combined biology route
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "Pearson Edexcel",
    topic: "Bacterial diseases",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(r.entry?.topic === "Bacterial diseases", "B: topic");
  assert(r.entry?.subject === "Combined Science", "B: Combined subject");
  assert(r.entry?.qualification === "GCSE Combined Science", "B: GCSE Combined Science");
  assert(r.entry?.route === "biology", "B: biology route");
}

// C) Chemistry + Chemistry of the atmosphere → Earth and atmosphere
{
  const r = findSpecEntry({
    subject: "Chemistry",
    keyStage: "KS4 - GCSE",
    examBoard: "Edexcel",
    topic: "Chemistry of the atmosphere",
    tier: "Foundation Tier",
    qualificationType: "single-science",
  });
  assert(r.entry?.topic === "Earth and atmosphere", "C: Earth and atmosphere");
  assert(r.entry?.qualification === "GCSE Chemistry", "C: GCSE Chemistry");
}

// D) Physics + Space physics
{
  const r = findSpecEntry({
    subject: "Physics",
    keyStage: "KS4 - GCSE",
    examBoard: "Edexcel",
    topic: "Space physics",
    tier: "Higher Tier",
    qualificationType: "single-science",
  });
  assert(r.entry?.topic === "Space physics", "D: Space physics");
  assert(r.entry?.contentFlags?.singleScienceOnly === true, "D: singleScienceOnly flag");
}

// E) Combined + Space physics → no Space physics combined row
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "Edexcel",
    topic: "Space physics",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(!r.entry || r.entry.topic !== "Space physics", "E: no Combined Space physics match");
}

// F) Combined + Particle model of matter → physics route Particle model
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "Edexcel",
    topic: "Particle model of matter",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(r.entry?.topic === "Particle model", "F: Particle model");
  assert(r.entry?.route === "physics", "F: physics route");
}

console.log("All Phase 2d smoke checks passed.");
