/** Keep in sync with frontend `LESSON_DESCRIPTION_MAX_LENGTH` (short lesson summary). */
const LESSON_DESCRIPTION_MAX_LENGTH = 1000;

function normalizeLessonDescription(raw) {
  const s = raw == null ? "" : String(raw).trim();
  return s.slice(0, LESSON_DESCRIPTION_MAX_LENGTH);
}

module.exports = {
  LESSON_DESCRIPTION_MAX_LENGTH,
  normalizeLessonDescription,
};
