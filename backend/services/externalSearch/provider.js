/**
 * PR-021: External search provider (pluggable).
 * Interface: searchWeb({ query, domains, limit }) -> Array<{ url, title, snippet, fetchedAt }>
 * No scraping; only provider snippet + title + url.
 */
const {
  getExternalAllowedDomains,
  getExternalMaxResults,
  getExternalMaxSnippetChars,
} = require("../../config/externalSearch");

function getProvider() {
  const p = (process.env.EXTERNAL_SEARCH_PROVIDER || "mock").toLowerCase().trim();
  return p === "brave" ? "brave" : "mock";
}

/**
 * Mock provider: deterministic fake sources for dev.
 */
async function mockSearchWeb({ query, domains, limit = 5 }) {
  const doms = Array.isArray(domains) && domains.length > 0 ? domains : getExternalAllowedDomains();
  const maxRes = Math.min(limit || getExternalMaxResults(), 10);
  const now = new Date().toISOString();

  const results = [];
  const sampleDomains = doms.slice(0, 3).length ? doms.slice(0, 3) : ["aqa.org.uk", "ocr.org.uk"];
  for (let i = 0; i < maxRes; i++) {
    const d = sampleDomains[i % sampleDomains.length];
    results.push({
      url: `https://www.${d}/resource/${encodeURIComponent(query || "").slice(0, 30)}-${i}`,
      title: `External reference: ${query?.slice(0, 40) || "Topic"} (${d})`,
      snippet: `This is a mock snippet for development. Query: "${(query || "").slice(0, 80)}". Domain: ${d}. Index: ${i + 1}. Use real provider (brave) for production.`,
      fetchedAt: now,
    });
  }
  return results;
}

/**
 * Brave Search API provider.
 * Requires EXTERNAL_SEARCH_API_KEY or BRAVE_API_KEY.
 * Uses site: operator for domain filtering.
 */
async function braveSearchWeb({ query, domains, limit = 5 }) {
  const apiKey = process.env.EXTERNAL_SEARCH_API_KEY || process.env.BRAVE_API_KEY;
  if (!apiKey) {
    console.warn("[externalSearch] Brave provider: no API key set");
    return [];
  }

  const doms = Array.isArray(domains) && domains.length > 0 ? domains : getExternalAllowedDomains();
  const maxRes = Math.min(limit || getExternalMaxResults(), 10);

  // PR-035: Build query with site: filter (OR multiple domains)
  // site:aqa.org.uk OR site:ocr.org.uk OR site:pearson.com OR site:bbc.co.uk OR site:openstax.org
  let searchQuery = (query || "").trim();
  if (doms.length > 0) {
    const siteParts = doms.slice(0, 5).map((d) => `site:${d}`);
    searchQuery = siteParts.length === 1
      ? `${searchQuery} ${siteParts[0]}`
      : `${searchQuery} (${siteParts.join(" OR ")})`;
  }

  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("count", String(maxRes));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("[externalSearch] Brave API error:", res.status, text?.slice(0, 200));
      return [];
    }

    const data = await res.json();
    const web = data.web?.results || [];
    const now = new Date().toISOString();
    const maxSnippet = getExternalMaxSnippetChars();

    return web.slice(0, maxRes).map((r) => ({
      url: r.url || "",
      title: (r.title || "").slice(0, 300),
      snippet: (r.description || r.snippet || "").slice(0, maxSnippet),
      fetchedAt: now,
    })).filter((r) => r.url);
  } catch (err) {
    console.warn("[externalSearch] Brave request failed:", err?.message);
    return [];
  }
}

/**
 * Main entry: search web with configured provider.
 * @param {{ query: string, domains?: string[], limit?: number }}
 * @returns {Promise<Array<{ url: string, title: string, snippet: string, fetchedAt: string }>>}
 */
async function searchWeb({ query, domains, limit }) {
  const provider = getProvider();
  const doms = domains || getExternalAllowedDomains();
  const lim = limit ?? getExternalMaxResults();

  if (provider === "brave") {
    return braveSearchWeb({ query, domains: doms, limit: lim });
  }
  return mockSearchWeb({ query, domains: doms, limit: lim });
}

module.exports = {
  searchWeb,
  getProvider,
  mockSearchWeb,
  braveSearchWeb,
};
