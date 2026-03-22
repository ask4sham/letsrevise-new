// backend/utils/passwordStrength.js
// Shared password strength validation for registration, reset, and change password.

const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  needsUppercase: true,
  needsLowercase: true,
  needsNumber: true,
};

/**
 * Validate password strength. Returns { valid: boolean, msg?: string }.
 */
function validatePasswordStrength(password) {
  if (!password || typeof password !== "string") {
    return { valid: false, msg: "Password is required" };
  }
  const p = password;
  if (p.length < PASSWORD_REQUIREMENTS.minLength) {
    return { valid: false, msg: `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters` };
  }
  if (PASSWORD_REQUIREMENTS.needsUppercase && !/[A-Z]/.test(p)) {
    return { valid: false, msg: "Password must contain at least one uppercase letter" };
  }
  if (PASSWORD_REQUIREMENTS.needsLowercase && !/[a-z]/.test(p)) {
    return { valid: false, msg: "Password must contain at least one lowercase letter" };
  }
  if (PASSWORD_REQUIREMENTS.needsNumber && !/[0-9]/.test(p)) {
    return { valid: false, msg: "Password must contain at least one number" };
  }
  return { valid: true };
}

/** Human-readable guidance for UI */
const PASSWORD_GUIDANCE = `At least 8 characters, with one uppercase letter, one lowercase letter, and one number`;

module.exports = { validatePasswordStrength, PASSWORD_GUIDANCE, PASSWORD_REQUIREMENTS };
