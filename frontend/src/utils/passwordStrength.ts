// Matches backend backend/utils/passwordStrength.js
export const PASSWORD_GUIDANCE = "At least 8 characters, with one uppercase letter, one lowercase letter, and one number";

export function validatePasswordStrength(password: string): { valid: boolean; msg?: string } {
  if (!password || typeof password !== "string") {
    return { valid: false, msg: "Password is required" };
  }
  const p = password;
  if (p.length < 8) {
    return { valid: false, msg: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(p)) {
    return { valid: false, msg: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(p)) {
    return { valid: false, msg: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(p)) {
    return { valid: false, msg: "Password must contain at least one number" };
  }
  return { valid: true };
}
