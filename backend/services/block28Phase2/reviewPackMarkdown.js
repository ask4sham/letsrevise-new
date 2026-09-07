/**
 * Block 28 Phase 2 — human review pack Markdown formatter.
 */

function formatLessonSection(pack) {
  const lines = [];
  lines.push(`## ${pack.lessonTitle}`);
  lines.push("");
  lines.push(`**Lesson ID:** \`${pack.lessonId}\``);
  lines.push(`**Topic key:** \`${pack.topicKey || "—"}\``);
  lines.push(`**Pack status:** **${pack.packStatus}**`);
  if (pack.selectionNote) lines.push(`**Selection note:** ${pack.selectionNote}`);
  lines.push("");
  if (pack.qualitySummary) {
    lines.push("### Quality summary");
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`| --- | ---: |`);
    lines.push(`| Pre-selection HIGH overlaps | ${pack.qualitySummary.preSelectionHighPairs ?? "—"} |`);
    lines.push(`| Final-set HIGH overlaps | ${pack.qualitySummary.finalSetHighPairs ?? "—"} |`);
    lines.push(`| Unresolved HIGH overlaps | ${pack.qualitySummary.unresolvedHighPairs ?? pack.qualitySummary.highOverlapCount ?? "—"} |`);
    lines.push(`| HIGH conceptual overlaps (blocks pack) | ${pack.qualitySummary.unresolvedHighPairs ?? pack.qualitySummary.highOverlapCount ?? 0} |`);
    lines.push(`| BORDERLINE mark-demand | ${pack.qualitySummary.borderlineCount} |`);
    lines.push(`| Generic filler points | ${pack.qualitySummary.genericFillerCount} |`);
    lines.push(`| Unresolved schemes | ${pack.qualitySummary.unresolvedSchemeCount} |`);
    lines.push(`| Semantic PASS | ${pack.proposedFinalSet.filter((q) => q.semanticReadiness === "PASS").length} |`);
    lines.push(`| Semantic REVIEW_REQUIRED | ${pack.qualitySummary.semanticReviewRequiredCount} |`);
    lines.push("");
  }
  lines.push("### Lesson content boundary");
  lines.push("");
  if (pack.lessonContentBoundary.coreConcepts?.length) {
    lines.push("**Core concepts / objectives:**");
    for (const c of pack.lessonContentBoundary.coreConcepts) lines.push(`- ${c}`);
    lines.push("");
  }
  if (pack.lessonContentBoundary.requiredDefinitions?.length) {
    lines.push("**Definitions detected:**");
    for (const d of pack.lessonContentBoundary.requiredDefinitions.slice(0, 6)) lines.push(`- ${d}`);
    lines.push("");
  }
  lines.push(`**Demand:** ${pack.lessonContentBoundary.demandLevel}`);
  lines.push("");
  lines.push("### Current state");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | ---: |`);
  lines.push(`| Raw attachments | ${pack.audit.rawAttachmentCount} |`);
  lines.push(`| Supported shorts | ${pack.audit.supportedCount} |`);
  lines.push(`| Unsupported | ${pack.audit.unsupportedCount} |`);
  lines.push(`| Currently served (/practice?limit=10) | ${pack.audit.servedCount} |`);
  lines.push(`| Served invariant FAIL | ${pack.audit.servedInvalidCount} |`);
  lines.push("");

  lines.push("### Proposed final set");
  lines.push("");

  for (const q of pack.proposedFinalSet) {
    lines.push(`#### Student Q${q.proposedStudentPosition}`);
    lines.push("");
    lines.push(`- **Question ID:** \`${q.questionId}\`${q.action === "NEW_MASTER_REQUIRED" ? " — NEW MASTER REQUIRED" : ""}`);
    lines.push(`- **Repair action:** ${q.action}`);
    lines.push(`- **Mark-demand verdict:** ${q.markDemand.verdict}${q.markDemand.note ? ` — ${q.markDemand.note}` : ""}`);
    lines.push(`- **Semantic readiness:** ${q.semanticReadiness}`);
    if (q.schemeStatus) lines.push(`- **Scheme status:** ${q.schemeStatus}`);
    if (q.overlapRisk && q.overlapRisk !== "LOW") lines.push(`- **Overlap risk:** ${q.overlapRisk}`);
    lines.push(`- **Confidence:** ${q.confidence}`);
    lines.push("");
    lines.push("**Original question:**");
    lines.push(`> ${q.originalQuestion}`);
    lines.push("");
    lines.push("**Proposed question:**");
    lines.push(`> ${q.proposedQuestion}`);
    lines.push("");
    lines.push(`**Marks:** ${q.proposedMarks}`);
    lines.push("");
    lines.push("**Current scheme:**");
    for (const pt of q.currentScheme) lines.push(`1. ${pt}`);
    lines.push("");
    lines.push("**Proposed exact scheme:**");
    for (const pt of q.proposedScheme) lines.push(`1. ${pt}`);
    lines.push("");
    lines.push(`**Why retained:** ${q.repairNote}`);
    lines.push("");
  }

  lines.push("### Proposed detachments");
  lines.push("");
  if (!pack.proposedDetachments.length) {
    lines.push("_None_");
  } else {
    for (const d of pack.proposedDetachments) {
      lines.push(`- \`${d.questionId}\` — **${d.selection}** — ${d.selectionNote}`);
    }
  }
  lines.push("");

  lines.push("### Coverage map");
  lines.push("");
  for (const c of pack.coverage.conceptMap.slice(0, 8)) {
    lines.push(`- [${c.status}] ${c.concept}`);
  }
  lines.push("");

  if (pack.coverage.gapProposals.length) {
    lines.push("### Content gaps");
    lines.push("");
    for (const g of pack.coverage.gapProposals) {
      lines.push(`- **${g.gap}** → ${g.recommendation.type}: ${g.recommendation.note}`);
    }
    lines.push("");
  }

  if (pack.sharedMasterRisks.length) {
    lines.push("### Shared-master risks");
    lines.push("");
    for (const s of pack.sharedMasterRisks) {
      lines.push(`- \`${s.questionId}\` used on ${s.usageCount || "?"} lessons`);
    }
    lines.push("");
  }

  lines.push("### Proposed future write plan");
  lines.push("");
  lines.push(`- Existing master updates: ${pack.futureWritePlan.existingMasterUpdates}`);
  lines.push(`- New master inserts: ${pack.futureWritePlan.newMasterInserts}`);
  lines.push(`- Detach from lesson: ${pack.futureWritePlan.detachCount}`);
  lines.push(`- Final attachments: ${pack.futureWritePlan.finalAttachmentCount}`);
  lines.push("");

  return lines.join("\n");
}

function buildBatchReviewMarkdown(batchMeta, packs) {
  const lines = [
    "# Block 28 Phase 2 — Edexcel IGCSE Biology Batch Review Pack",
    "",
    `**Generated:** ${batchMeta.generatedAt}`,
    `**Mode:** READ ONLY — NO DATABASE WRITES`,
    `**Spec:** edexcel-igcse-biology`,
    `**Batch:** ${batchMeta.batchIndex} of ${batchMeta.totalBatches}`,
    `**Lessons in batch:** ${packs.length}`,
    "",
    "---",
    "",
  ];

  for (const pack of packs) {
    lines.push(formatLessonSection(pack));
    lines.push("---");
    lines.push("");
  }

  lines.push("## Batch summary");
  lines.push("");
  lines.push(`| Lesson | Served invalid | Proposed retain | Detach | Pack status |`);
  lines.push(`| --- | ---: | ---: | ---: | --- |`);
  for (const p of packs) {
    lines.push(
      `| ${p.lessonTitle} | ${p.audit.servedInvalidCount} | ${p.proposedFinalSet.length} | ${p.proposedDetachments.length} | ${p.packStatus} |`
    );
  }

  return lines.join("\n");
}

module.exports = {
  buildBatchReviewMarkdown,
  formatLessonSection,
};
