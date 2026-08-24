/**
 * DEPRECATED — do not use as an access-control boundary.
 *
 * Historically this was a silent no-op (`next()`), which made routes appear
 * protected when they were not. AI-generation-job routes now use explicit
 * `auth` (user) and `auth` + `checkAdmin` (admin mount) instead.
 *
 * Compatibility: re-exports `auth` so any leftover import cannot silently
 * bypass authentication. Prefer importing `auth` directly in new code.
 */
module.exports = require("./auth");
