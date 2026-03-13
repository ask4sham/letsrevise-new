/**
 * PR-COMP-AQA-1: Detect official source (e.g. AQA) from URL hostname.
 * Used for compliance: aqa.org.uk URLs are official, never download/proxy.
 */

/**
 * @param {string} url
 * @returns {{ officialSource: boolean, officialHost?: string }}
 */
function getOfficialSourceFromUrl(url) {
  if (!url || typeof url !== "string") return { officialSource: false };
  const trimmed = url.trim();
  if (!trimmed) return { officialSource: false };
  try {
    const u = new URL(trimmed);
    const hostname = (u.hostname || "").toLowerCase();
    if (hostname === "aqa.org.uk" || hostname.endsWith(".aqa.org.uk")) {
      return { officialSource: true, officialHost: "aqa.org.uk" };
    }
  } catch (_) {
    // Invalid URL
  }
  return { officialSource: false };
}

module.exports = { getOfficialSourceFromUrl };
