/**
 * Phase 2b smoke checks for spec qualification + tier filtering.
 * Run: node scripts/spec-phase2b-smoke.mjs
 */
import { findSpecEntry } from "../lib/specDatabase/specLookup.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log("Phase 2b spec lookup smoke tests…");

// A) Biology Higher + Monoclonal → AQA Biology monoclonal entry
{
  const r = findSpecEntry({
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: "Monoclonal antibodies",
    tier: "Higher Tier",
    qualificationType: "single-science",
  });
  assert(r.entry?.topic === "Monoclonal antibodies", "A: expected Monoclonal antibodies entry");
  assert(!r.matchInfo.combinedScienceRejected, "A: should not be Combined-rejected");
}

// B) Biology Foundation + Monoclonal → no higher-only row (null or no monoclonal match)
{
  const r = findSpecEntry({
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: "Monoclonal antibodies",
    tier: "Foundation Tier",
    qualificationType: "single-science",
  });
  assert(!r.entry, "B: Foundation should not match higher-tier-only topic row");
  assert(r.matchInfo.partial === true, "B: expect partial / no-match info");
}

// C) Combined Science + Monoclonal → reject biology-only / no safe combined row
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
    "C: Combined Science must not resolve to Biology-only Monoclonal antibodies row"
  );
}

// D) Biology Higher + Bacterial diseases topic string → Bacterial diseases entry
{
  const r = findSpecEntry({
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: "Bacterial diseases – Infection and Response",
    tier: "Higher Tier",
    qualificationType: "single-science",
  });
  assert(r.entry?.topic === "Bacterial diseases", "D: expected Bacterial diseases");
}

// E) Biology Foundation + same topic → same row, may filter higher-only bullets
{
  const r = findSpecEntry({
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: "Bacterial diseases – Infection and Response",
    tier: "Foundation Tier",
    qualificationType: "single-science",
  });
  assert(r.entry?.topic === "Bacterial diseases", "E: expected Bacterial diseases entry");
  if (r.matchInfo.excludedItemsCount > 0) {
    assert(r.matchInfo.partial === true, "E: partial when items excluded");
  }
}

console.log("All Phase 2b smoke checks passed.");
