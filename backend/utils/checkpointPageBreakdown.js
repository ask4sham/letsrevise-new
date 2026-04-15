/**
 * Group lesson-scoped checkpoint attempts by pageId + checkpointRevision for teacher reports.
 * Legacy attempts without pageId roll into pageId: null (display key __legacy__ internally).
 *
 * @param {Array<{ source?: string, pageId?: string, checkpointRevision?: unknown, isCorrect?: boolean }>} attempts
 * @param {Map<string, string>} [pageTitleById] pageId -> title from lesson.pages
 * @returns {Array<{ pageId: string|null, checkpointRevision: string|number|null, attempts: number, correct: number, accuracy: number, pageTitle: string|null }>}
 */
function buildCheckpointPageBreakdown(attempts, pageTitleById = new Map()) {
  const checkpointPageMap = new Map();
  (attempts || []).forEach((a) => {
    if (a.source !== "checkpoint") return;
    const pid = a.pageId && String(a.pageId).trim() ? String(a.pageId).trim() : null;
    const rev = a.checkpointRevision != null && a.checkpointRevision !== "" ? a.checkpointRevision : null;
    const key = `${pid ?? "__legacy__"}::${rev != null ? String(rev) : "_"}`;
    if (!checkpointPageMap.has(key)) {
      checkpointPageMap.set(key, {
        pageId: pid,
        checkpointRevision: rev,
        attempts: 0,
        correct: 0,
      });
    }
    const row = checkpointPageMap.get(key);
    row.attempts += 1;
    if (a.isCorrect) row.correct += 1;
  });
  return Array.from(checkpointPageMap.values())
    .map((row) => ({
      ...row,
      pageTitle: row.pageId ? pageTitleById.get(row.pageId) ?? null : null,
      accuracy: row.attempts > 0 ? Math.round((row.correct / row.attempts) * 1000) / 1000 : 0,
    }))
    .sort((a, b) => b.attempts - a.attempts);
}

module.exports = { buildCheckpointPageBreakdown };
