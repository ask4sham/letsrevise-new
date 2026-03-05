/**
 * PR-022: External source policy service — denylist/allowlist filtering.
 */
const ExternalSourcePolicy = require("../../models/ExternalSourcePolicy");

function normalizeDomain(urlOrDomain) {
  if (!urlOrDomain || typeof urlOrDomain !== "string") return "";
  const s = urlOrDomain.trim().toLowerCase();
  try {
    if (s.startsWith("http://") || s.startsWith("https://")) {
      const u = new URL(s);
      return u.hostname.replace(/^www\./, "");
    }
    return s.replace(/^www\./, "");
  } catch {
    return s.replace(/^www\./, "");
  }
}

function normalizeUrl(url) {
  if (!url || typeof url !== "string") return "";
  const s = url.trim().toLowerCase();
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return s;
  }
}

/**
 * Get policy status for a list of URLs.
 * @param {string[]} urls
 * @returns {Promise<Map<string, { status: string, kind: string, value: string }>>}
 */
async function getPolicyForUrls(urls) {
  const map = new Map();
  if (!urls || urls.length === 0) return map;

  const domains = [...new Set(urls.map(normalizeDomain).filter(Boolean))];
  const normalizedUrls = urls.map(normalizeUrl).filter(Boolean);

  const policies = await ExternalSourcePolicy.find({
    $or: [
      { kind: "domain", value: { $in: domains } },
      { kind: "url", value: { $in: normalizedUrls } },
    ],
  }).lean();

  for (const p of policies) {
    if (p.kind === "domain") {
      for (const u of urls) {
        const d = normalizeDomain(u);
        if (d === p.value) {
          const key = normalizeUrl(u);
          if (!map.has(key) || p.status === "denied") {
            map.set(key, { status: p.status, kind: p.kind, value: p.value });
          }
        }
      }
    } else {
      const key = p.value;
      if (!map.has(key) || p.status === "denied") {
        map.set(key, { status: p.status, kind: p.kind, value: p.value });
      }
    }
  }
  return map;
}

/**
 * Check if url or its domain is denied.
 */
async function isDenied({ url, domain }) {
  const domains = [];
  const urls = [];
  if (domain) domains.push(normalizeDomain(domain));
  if (url) {
    urls.push(normalizeUrl(url));
    domains.push(normalizeDomain(url));
  }
  const allDomains = [...new Set(domains)].filter(Boolean);
  const allUrls = [...new Set(urls)].filter(Boolean);

  const denied = await ExternalSourcePolicy.findOne({
    status: "denied",
    $or: [
      { kind: "domain", value: { $in: allDomains } },
      { kind: "url", value: { $in: allUrls } },
    ],
  }).lean();

  return !!denied;
}

/**
 * Filter out denied results from external search.
 * @param {Array<{ url: string, title?: string, snippet?: string, domain?: string }>} results
 * @returns {Promise<Array>}
 */
async function filterDenied(results) {
  if (!results || results.length === 0) return [];

  const deniedPolicies = await ExternalSourcePolicy.find({ status: "denied" }).lean();
  const deniedDomains = new Set(deniedPolicies.filter((p) => p.kind === "domain").map((p) => p.value));
  const deniedUrls = new Set(deniedPolicies.filter((p) => p.kind === "url").map((p) => p.value));

  return results.filter((r) => {
    const url = r.url || (r.domain ? `https://${r.domain}` : "");
    const domain = (r.domain || normalizeDomain(url)).toLowerCase().replace(/^www\./, "");
    const normUrl = normalizeUrl(url);
    if (deniedUrls.has(normUrl)) return false;
    if (domain && deniedDomains.has(domain)) return false;
    return true;
  });
}

/**
 * Upsert a policy.
 */
async function upsertPolicy({ kind, value, status, reason, userId }) {
  const v = (kind === "domain" ? normalizeDomain(value) : normalizeUrl(value)).trim().toLowerCase();
  if (!v) return null;

  const existing = await ExternalSourcePolicy.findOne({ kind, value: v }).lean();
  const payload = { kind, value: v, status, reason: reason || null, updatedBy: userId };

  if (existing) {
    await ExternalSourcePolicy.updateOne({ _id: existing._id }, { $set: payload });
    return { ...existing, ...payload, _id: existing._id };
  }
  return ExternalSourcePolicy.create({
    ...payload,
    createdBy: userId,
  });
}

module.exports = {
  getPolicyForUrls,
  isDenied,
  filterDenied,
  upsertPolicy,
  normalizeDomain,
  normalizeUrl,
};
