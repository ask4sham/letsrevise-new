/**
 * Teacher voice engine — taught lesson vs generic AI tone.
 */

const { flattenPagesToBlocks, blockHaystackNormalized, wordCount } = require("./blockText");

const TEACHER_VOICE = [
  /right, let/,
  /let's think/,
  /students often/,
  /examiners? catch/,
  /this links directly/,
  /keep hold of/,
  /where students lose marks/,
  /in the exam, say/,
  /the key idea is/,
  /this is where/,
  /picture this/,
  /before we go on/,
];

const GENERIC_AI = [
  /it is important to note/,
  /in today's lesson/,
  /delve into/,
  /multifaceted/,
  /plays a crucial role/,
  /landscape of/,
  /utilize/,
  /furthermore,/,
  /moreover,/,
  /in conclusion,/,
];

/**
 * @param {object[]} pages
 */
function analyzeTeacherVoice(pages) {
  const blocks = flattenPagesToBlocks(pages);
  let teacherHits = 0;
  let genericHits = 0;
  let teachBlocks = 0;
  const flags = [];

  blocks.forEach((block, index) => {
    const hay = blockHaystackNormalized(block);
    const wc = wordCount(hay);
    if (wc < 15) return;
    teachBlocks++;

    for (const re of TEACHER_VOICE) {
      if (re.test(hay)) teacherHits++;
    }
    for (const re of GENERIC_AI) {
      if (re.test(hay)) {
        genericHits++;
        flags.push({ blockIndex: index, kind: "generic_ai_tone" });
      }
    }
  });

  const ratio = teachBlocks ? teacherHits / teachBlocks : 0;
  const teacherVoiceScore = Math.min(
    100,
    Math.round(ratio * 60 + (teacherHits >= 4 ? 30 : teacherHits * 5) - genericHits * 12)
  );

  return {
    teacherPhraseCount: teacherHits,
    genericPhraseCount: genericHits,
    teacherVoiceScore: Math.max(0, teacherVoiceScore),
    flags,
    feelsTaught: teacherVoiceScore >= 65 && genericHits <= 2,
  };
}

/**
 * Prompt appendix for generation.
 */
function buildTeacherVoiceDirectives() {
  return [
    "TEACHER VOICE (V4): Sound like an outstanding GCSE teacher leading the class.",
    'Use phrases such as: "Right, let\'s think about this…", "Students often get confused here…",',
    '"This is where examiners catch people out…", "This links directly to…", "Keep hold of that idea because…"',
    "Avoid generic AI filler, textbook walls, and motivational fluff.",
  ].join("\n");
}

module.exports = {
  analyzeTeacherVoice,
  buildTeacherVoiceDirectives,
};
