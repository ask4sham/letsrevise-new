/**
 * Narrow Resend send wrapper: converts resolved `{ error }` into a controlled throw
 * so callers share the same failure path as SDK/network rejections.
 */

class ResendDeliveryError extends Error {
  /**
   * @param {string} message
   * @param {{ statusCode?: number, providerErrorName?: string }} [meta]
   */
  constructor(message, meta = {}) {
    super(message);
    this.name = "ResendDeliveryError";
    if (meta.statusCode != null && Number.isFinite(Number(meta.statusCode))) {
      this.statusCode = Number(meta.statusCode);
    }
    if (meta.providerErrorName != null && String(meta.providerErrorName).trim()) {
      this.providerErrorName = String(meta.providerErrorName).trim();
    }
  }
}

/**
 * @param {{ apiKey: string, payload: object }} args
 * @returns {Promise<object|null|undefined>} provider `data` on success
 */
async function sendResendEmail({ apiKey, payload }) {
  const { Resend } = require("resend");
  const client = new Resend(apiKey);
  const result = await client.emails.send(payload);

  if (result && result.error) {
    const err = result.error;
    const message =
      (err && typeof err.message === "string" && err.message.trim()) ||
      "Resend email delivery failed";
    throw new ResendDeliveryError(message, {
      statusCode: err && err.statusCode,
      providerErrorName: err && err.name,
    });
  }

  return result ? result.data : result;
}

module.exports = {
  sendResendEmail,
  ResendDeliveryError,
};
