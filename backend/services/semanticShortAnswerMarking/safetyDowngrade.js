const { isGenericStudentCreditFragment } = require("../../../lib/block28RubricFragment");

/**
 * Downgrade-only post-LLM guard: SATISFIED → NOT_EVIDENCED when cited evidence is a generic fragment.
 * Never upgrades judgements or adds marks.
 *
 * @param {object[]} points - validated LLM points
 * @returns {object[]}
 */
function applySafetyDowngrades(points) {
  if (!Array.isArray(points)) return points;
  return points.map((pt) => {
    if (pt.judgement !== "SATISFIED") return pt;
    const evidence = String(pt.studentEvidence ?? "").trim();
    if (!isGenericStudentCreditFragment(evidence)) return pt;
    return {
      ...pt,
      judgement: "NOT_EVIDENCED",
      reason: `${pt.reason || ""} [safety: evidence is a generic credit fragment, not a substantive proposition]`.trim(),
    };
  });
}

module.exports = {
  applySafetyDowngrades,
  isGenericStudentCreditFragment,
};
