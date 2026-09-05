/**
 * Block 28 Phase 2 — human review artefact builder (read-only).
 */

function buildHumanReviewArtefact(masters) {
  const byLesson = new Map();

  for (const master of masters) {
    for (const ref of master.publishedLessonRefs || []) {
      const key = ref.lessonId;
      if (!byLesson.has(key)) {
        byLesson.set(key, {
          lessonId: ref.lessonId,
          lessonTitle: ref.lessonTitle,
          positions: [],
        });
      }
      byLesson.get(key).positions.push({
        position: ref.position,
        master: {
          questionId: master.questionId,
          classification: master.repairClassification,
          confidence: master.classificationEvidence?.confidence ?? null,
          reviewFlags: master.classificationEvidence?.reviewFlags ?? [],
          sharedLessonCount: master.lessonReferenceCount,
          approvalStatus: master.approvalStatus || "pending",
          gateStatus: master.proposal?.proposalStatus || master.qualityGates?.passed
            ? "passed"
            : master.proposal
              ? "failed"
              : "no_proposal",
          before: {
            marks: master.marks,
            markScheme: master.markSchemeNormalized,
            mismatchPattern: master.mismatchPattern,
          },
          proposed:
            master.proposal?.proposal?.proposedMarkScheme
              ? {
                  marks: master.marks,
                  markScheme: master.proposal.proposal.proposedMarkScheme,
                }
              : null,
        },
      });
    }
  }

  const lessons = [...byLesson.values()].map((lesson) => ({
    ...lesson,
    positions: lesson.positions.sort((a, b) => a.position - b.position),
  }));

  lessons.sort((a, b) => String(a.lessonTitle || "").localeCompare(String(b.lessonTitle || "")));

  return {
    generatedAt: new Date().toISOString(),
    format: "lesson_position_master",
    lessons,
    markdown: buildHumanReviewMarkdown(lessons),
  };
}

function buildHumanReviewMarkdown(lessons) {
  const lines = ["# Block 28 Phase 2 — Human Review Artefact", ""];
  lines.push("**NO DATABASE WRITES PERFORMED.**", "");

  for (const lesson of lessons) {
    lines.push(`## ${lesson.lessonTitle || lesson.lessonId}`);
    lines.push("");
    for (const { position, master } of lesson.positions) {
      lines.push(`### Position ${position} — \`${master.questionId}\``);
      lines.push(`- Classification: **${master.classification}** (confidence ${master.confidence})`);
      lines.push(`- Shared across lessons: ${master.sharedLessonCount}`);
      lines.push(`- Gate status: ${master.gateStatus}`);
      lines.push(`- Approval: ${master.approvalStatus}`);
      if (master.reviewFlags.length) lines.push(`- Flags: ${master.reviewFlags.join(", ")}`);
      lines.push("");
      lines.push("**BEFORE**");
      lines.push(`- Marks: ${master.before.marks}`);
      lines.push(`- Scheme (${master.before.markScheme.length} pts):`);
      for (const pt of master.before.markScheme) lines.push(`  - ${pt}`);
      lines.push("");
      if (master.proposed) {
        lines.push("**PROPOSED**");
        lines.push(`- Marks: ${master.proposed.marks} (unchanged)`);
        lines.push(`- Scheme (${master.proposed.markScheme.length} pts):`);
        for (const pt of master.proposed.markScheme) lines.push(`  - ${pt}`);
      } else {
        lines.push("**PROPOSED**: _none — requires manual review or regeneration_");
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

module.exports = { buildHumanReviewArtefact, buildHumanReviewMarkdown };
