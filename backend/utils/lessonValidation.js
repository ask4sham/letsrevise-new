/**
 * Whitelisted lesson flags for create/update. Coerces string "true"/"false" safely.
 */
function coerceBoolean(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return undefined;
}

function pickLessonFlags(body) {
  const isFreePreview = coerceBoolean(body?.isFreePreview);
  const out = {};
  if (typeof isFreePreview === "boolean") out.isFreePreview = isFreePreview;
  return out;
}

module.exports = { coerceBoolean, pickLessonFlags };
