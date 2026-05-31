/**
 * Lesson duration budgets — allocates teaching / retrieval / interaction / exam / summary slots.
 */

/** @typedef {'quick'|'standard'|'deep'|'exam'} LessonDurationTier */

/** @type {Record<LessonDurationTier, { label: string, minutes: [number, number], slots: object }>} */
const BUDGETS = {
  quick: {
    label: "Quick (15–20 min)",
    minutes: [15, 20],
    slots: {
      foundation: 1,
      teach: 3,
      check: 3,
      activity: 1,
      examPractice: 1,
      summary: 1,
      finalMastery: 1,
      maxWordsPerTeachChunk: 250,
      maxConsecutiveTeach: 2,
    },
  },
  standard: {
    label: "Standard (30–40 min)",
    minutes: [30, 40],
    slots: {
      foundation: 2,
      teach: 6,
      check: 6,
      activity: 2,
      examPractice: 2,
      summary: 1,
      finalMastery: 1,
      maxWordsPerTeachChunk: 320,
      maxConsecutiveTeach: 2,
    },
  },
  deep: {
    label: "Deep (45–60 min)",
    minutes: [45, 60],
    slots: {
      foundation: 2,
      teach: 8,
      check: 8,
      activity: 3,
      examPractice: 3,
      summary: 1,
      finalMastery: 2,
      maxWordsPerTeachChunk: 350,
      maxConsecutiveTeach: 2,
    },
  },
  exam: {
    label: "Exam focus (60+ min)",
    minutes: [60, 75],
    slots: {
      foundation: 2,
      teach: 7,
      check: 7,
      activity: 2,
      examPractice: 5,
      summary: 1,
      finalMastery: 2,
      maxWordsPerTeachChunk: 300,
      maxConsecutiveTeach: 2,
    },
  },
};

/**
 * @param {string} [tier]
 * @returns {typeof BUDGETS.standard}
 */
function getLessonLengthBudget(tier = "standard") {
  const key = BUDGETS[tier] ? tier : "standard";
  return { tier: key, ...BUDGETS[key] };
}

/**
 * @param {typeof BUDGETS.standard} budget
 * @returns {number}
 */
function estimateLessonMinutes(budget) {
  const s = budget.slots;
  const blockMinutes = 3.5;
  const totalSlots =
    s.foundation +
    s.teach +
    s.check +
    s.activity +
    s.examPractice +
    s.summary +
    s.finalMastery;
  return Math.round(totalSlots * blockMinutes);
}

module.exports = {
  BUDGETS,
  getLessonLengthBudget,
  estimateLessonMinutes,
};
