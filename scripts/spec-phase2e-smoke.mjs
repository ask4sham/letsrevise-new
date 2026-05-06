/**
 * Phase 2e — OCR GCSE Science local rows.
 * Run: node scripts/spec-phase2e-smoke.mjs
 */
import { findSpecEntry, normaliseBoardKey } from "../lib/specDatabase/specLookup.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log("Phase 2e OCR spec lookup smoke tests…");

assert(normaliseBoardKey("OCR") === "OCR", "OCR plain");
assert(normaliseBoardKey("OCR Gateway") === "OCR", "OCR Gateway");
assert(normaliseBoardKey("OCR Twenty First Century Science") === "OCR", "OCR 21st C label");

// A) Biology OCR Bacterial diseases
{
  const r = findSpecEntry({
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "OCR",
    topic: "Bacterial diseases",
    tier: "Higher Tier",
    qualificationType: "single-science",
  });
  assert(r.entry?.board === "OCR", "A: OCR");
  assert(r.entry?.topic === "Bacterial diseases", "A: topic");
  assert(r.entry?.qualification === "GCSE Biology", "A: GCSE Biology");
}

// B) Combined OCR Bacterial diseases (biology route)
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "OCR Gateway",
    topic: "Bacterial diseases",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(r.entry?.subject === "Combined Science", "B: Combined");
  assert(r.entry?.topic === "Bacterial diseases", "B: topic");
  assert(r.entry?.route === "biology", "B: biology route");
}

// B2) Long AQA-style topic string
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "OCR",
    topic: "Bacterial diseases – Infection and Response",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(r.entry?.topic === "Bacterial diseases", "B2: bacterial diseases match");
}

// C) Chemistry Earth and atmosphere (from “Chemistry of the atmosphere”)
{
  const r = findSpecEntry({
    subject: "Chemistry",
    keyStage: "KS4 - GCSE",
    examBoard: "OCR",
    topic: "Chemistry of the atmosphere",
    tier: "Foundation Tier",
    qualificationType: "single-science",
  });
  assert(r.entry?.topic === "Earth and atmosphere", "C: Earth and atmosphere");
}

// D) Physics Space physics (single-science only)
{
  const r = findSpecEntry({
    subject: "Physics",
    keyStage: "KS4 - GCSE",
    examBoard: "OCR",
    topic: "Space physics",
    tier: "Higher Tier",
    qualificationType: "single-science",
  });
  assert(r.entry?.topic === "Space physics", "D: Space physics");
  assert(r.entry?.contentFlags?.singleScienceOnly === true, "D: flag");
}

// E) Combined + Space physics → no Space row
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "OCR",
    topic: "Space physics",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(!r.entry || r.entry.topic !== "Space physics", "E: no Combined Space physics");
}

// F) Particle model of matter → Combined Particle model
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "OCR",
    topic: "Particle model of matter",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(r.entry?.topic === "Particle model", "F: Particle model");
  assert(r.entry?.route === "physics", "F: physics");
}

// G) Radioactivity → Combined Radioactivity row
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "OCR",
    topic: "Radioactivity",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(r.entry?.topic === "Radioactivity", "G: Radioactivity");
  assert(r.entry?.route === "physics", "G: physics");
}

// H) “Atomic structure and radiation” on OCR Combined still finds Radioactivity row
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "OCR",
    topic: "Atomic structure and radiation",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(r.entry?.topic === "Radioactivity", "H: alias to Radioactivity");
}

console.log("All Phase 2e smoke checks passed.");
