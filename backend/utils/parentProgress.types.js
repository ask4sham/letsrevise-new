/**
 * Parent Progress (Parent-safe) response contract.
 * This is intentionally NOT raw metrics. It's interpreted signals only.
 */

/**
 * @typedef {"improving"|"stable"|"declining"} Trend
 */

/**
 * @typedef {Object} ParentSubjectProgress
 * @property {string} name
 * @property {"strength"|"needs_attention"|"neutral"} status
 * @property {Trend} trend
 */

/**
 * @typedef {Object} ParentChildProgressResponse
 * @property {string} childId
 * @property {{status:"strength"|"needs_attention"|"neutral", trend:Trend}} overall
 * @property {ParentSubjectProgress[]} subjects
 * @property {string} updatedAt
 */

module.exports = {};
