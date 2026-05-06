/**
 * Phase 2c — AQA Combined Science: Trilogy local rows + lookup behaviour.
 * Run: node scripts/spec-phase2c-smoke.mjs
 */
import { findSpecEntry } from "../lib/specDatabase/specLookup.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log("Phase 2c Trilogy spec lookup smoke tests…");

// A) Combined + Bacterial diseases long topic → Trilogy Bacterial diseases
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: "Bacterial diseases – Infection and Response",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(r.entry?.topic === "Bacterial diseases", "A: Trilogy Bacterial diseases");
  assert(r.entry?.qualification === "GCSE Combined Science: Trilogy", "A: Trilogy qualification");
  assert(r.entry?.qualificationType === "combined-science", "A: combined-science type");
}

// B) Combined + Monoclonal → must not return Biology monoclonal entry
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: "Monoclonal antibodies",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(
    !r.entry || r.entry.topic !== "Monoclonal antibodies",
    "B: Combined must not use Monoclonal antibodies row"
  );
}

// C) Biology + Monoclonal → separate-science monoclonal
{
  const r = findSpecEntry({
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: "Monoclonal antibodies",
    tier: "Higher Tier",
    qualificationType: "single-science",
  });
  assert(r.entry?.topic === "Monoclonal antibodies", "C: Biology monoclonal");
}

// D) Combined + Energy (physics) + Foundation
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: "Energy stores and transfers",
    tier: "Foundation Tier",
    qualificationType: "combined-science",
  });
  assert(r.entry?.topic === "Energy stores and transfers", "D: Trilogy energy");
  assert(r.entry?.route === "physics", "D: physics route");
}

// E) Combined + Atomic structure + Higher → chemistry route Trilogy (not Biology)
{
  const r = findSpecEntry({
    subject: "Combined Science",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: "Atomic structure",
    tier: "Higher Tier",
    qualificationType: "combined-science",
  });
  assert(r.entry?.topic === "Atomic structure", "E: Trilogy atomic structure");
  assert(r.entry?.route === "chemistry", "E: chemistry route");
}

console.log("All Phase 2c smoke checks passed.");
