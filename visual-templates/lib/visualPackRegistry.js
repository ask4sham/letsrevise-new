/**
 * Cross-subject visual pack registry (taxonomy specKey + topicSlug).
 * Used by backend resolver, generator export (synced copy), and validation.
 */

const path = require("path");
const fs = require("fs");

const REGISTRY_DIR = path.join(__dirname, "..", "registry");

let _packRegistry = null;
let _eligibilityProfiles = null;

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function normalizeHay(raw = "") {
  return safeStr(raw)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9\s:.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compilePatterns(patterns = []) {
  return (patterns || [])
    .map((p) => {
      try {
        return new RegExp(p, "i");
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function loadJson(name) {
  const filePath = path.join(REGISTRY_DIR, name);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getPackRegistry() {
  if (!_packRegistry) _packRegistry = loadJson("pack-registry.json");
  return _packRegistry;
}

function getEligibilityProfiles() {
  if (!_eligibilityProfiles) _eligibilityProfiles = loadJson("eligibility-profiles.json");
  return _eligibilityProfiles;
}

function listPacks() {
  return getPackRegistry().packs || [];
}

function getPackById(packId) {
  const id = safeStr(packId);
  return listPacks().find((p) => p.packId === id) || null;
}

function getPackByLegacyKey(legacyKey, specKey = "") {
  const k = safeStr(legacyKey);
  const spec = safeStr(specKey).toLowerCase();
  const matches = listPacks().filter((p) => p.legacyVisualPackKey === k);
  if (!matches.length) return null;
  if (spec) {
    return matches.find((p) => (p.specKeys || []).map((s) => s.toLowerCase()).includes(spec)) || matches[0];
  }
  return matches[0];
}

function getProfile(profileId) {
  const profiles = getEligibilityProfiles().profiles || {};
  return profiles[safeStr(profileId)] || null;
}

/** @returns {import('../registry/pack-registry').Pack | null} */
function resolvePackFromTaxonomy(specKey, topicSlug) {
  const spec = safeStr(specKey).toLowerCase();
  const slug = safeStr(topicSlug).toLowerCase();
  if (!spec || !slug) return null;

  return (
    listPacks().find(
      (p) =>
        (p.specKeys || []).map((s) => s.toLowerCase()).includes(spec) &&
        (p.topicSlugs || []).map((s) => s.toLowerCase()).includes(slug)
    ) || null
  );
}

function packMatchesHaystack(pack, hay) {
  const t = normalizeHay(hay);
  if (!t) return false;

  const slugHits = (pack.topicSlugs || []).some((slug) => {
    const s = normalizeHay(slug);
    return t === s || t.includes(s) || s.includes(t);
  });
  if (slugHits) return true;

  return (pack.topicAliases || []).some((alias) => {
    const a = normalizeHay(alias);
    return a && (t === a || t.includes(a) || a.includes(t));
  });
}

function profileAllowsLesson(pack, profile, hay) {
  const t = normalizeHay(hay);
  if (!t) return false;

  const exclude = compilePatterns(profile.excludePatterns);
  if (exclude.some((re) => re.test(t))) return false;

  if (profile.matchTaxonomySlugOnly) {
    return packMatchesHaystack(pack, hay);
  }

  const include = compilePatterns(profile.includePatterns);
  if (include.some((re) => re.test(t))) return true;

  const fallback = compilePatterns(profile.topicFallbackPatterns);
  if (fallback.some((re) => re.test(t))) {
    const blockIf = compilePatterns(profile.topicFallbackExcludeIf);
    if (blockIf.some((re) => re.test(t))) return false;
    return true;
  }

  return packMatchesHaystack(pack, hay);
}

/**
 * Resolve active visual pack for lesson meta (export / attach).
 * @param {object} meta
 * @returns {{ pack: object|null, packId: string|null, legacyVisualPackKey: string|null, matchedFrom: string|null }}
 */
function resolveVisualPackFromLessonMeta(meta = {}) {
  const specKey =
    safeStr(meta.specKey) ||
    safeStr(meta.spec) ||
    parseSpecFromTopicKey(meta.topicKey) ||
    parseSpecFromTopicKey(meta.canonicalTopicKey);
  const topicSlug =
    safeStr(meta.topicSlug) ||
    parseSlugFromTopicKey(meta.topicKey) ||
    parseSlugFromTopicKey(meta.canonicalTopicKey);

  if (specKey && topicSlug) {
    const pack = resolvePackFromTaxonomy(specKey, topicSlug);
    if (pack && pack.status === "active" && packIsInjectable(pack)) {
      const profile = getProfile(pack.eligibilityProfile);
      const hay = [meta.topic, meta.title, meta.lessonText?.slice(0, 2000)]
        .filter(Boolean)
        .join(" ");
      if (!profile || profileAllowsLesson(pack, profile, hay)) {
        return {
          pack,
          packId: pack.packId,
          legacyVisualPackKey: pack.legacyVisualPackKey || null,
          matchedFrom: `${specKey}:${topicSlug}`,
        };
      }
    }
  }

  const textCandidates = [
    { source: "topic", value: safeStr(meta.topic) },
    { source: "title", value: safeStr(meta.title) },
    {
      source: "subject+topic",
      value: [safeStr(meta.subject), safeStr(meta.topic)].filter(Boolean).join(" "),
    },
    { source: "lessonText-head", value: safeStr(meta.lessonText).slice(0, 2000) },
  ].filter((c) => c.value);

  for (const { source, value } of textCandidates) {
    for (const pack of listPacks()) {
      if (!packIsInjectable(pack)) continue;
      const profile = getProfile(pack.eligibilityProfile);
      if (!profile || !profileAllowsLesson(pack, profile, value)) continue;
      if (packMatchesHaystack(pack, value)) {
        return {
          pack,
          packId: pack.packId,
          legacyVisualPackKey: pack.legacyVisualPackKey || null,
          matchedFrom: source,
        };
      }
    }
  }

  return { pack: null, packId: null, legacyVisualPackKey: null, matchedFrom: null };
}

function parseSpecFromTopicKey(raw) {
  const t = safeStr(raw);
  const idx = t.indexOf(":");
  if (idx <= 0) return "";
  return t.slice(0, idx).toLowerCase();
}

function parseSlugFromTopicKey(raw) {
  const t = safeStr(raw);
  const idx = t.indexOf(":");
  if (idx < 0) return t.toLowerCase();
  const rest = t.slice(idx + 1);
  const parts = rest.split(":");
  return (parts[parts.length - 1] || "").toLowerCase();
}

function blockTextHay(block = {}, kind = "") {
  const parts = [
    block.process,
    block.examLink,
    block.instruction,
    block.caption,
    block.content,
    block.html,
    block.text,
    block.title,
  ];
  if (Array.isArray(block.steps)) parts.push(...block.steps);
  if (Array.isArray(block.labels)) parts.push(...block.labels);
  if (Array.isArray(block.hotspots)) parts.push(...block.hotspots);
  if (kind === "step-by-step-diagram" && Array.isArray(block.steps)) {
    parts.push(block.steps.join(" "));
  }
  return parts.map(safeStr).filter(Boolean).join("\n");
}

function sequenceStepsAlignWithProfile(sequenceSteps, profile) {
  const steps = Array.isArray(sequenceSteps) ? sequenceSteps : [];
  if (!profile?.stepTitles?.length || steps.length === 0) return false;

  const packTitles = profile.stepTitles.map((s) => s.toLowerCase());
  const alignPatterns = compilePatterns(profile.contentAlignPatterns);
  let aligned = 0;

  for (let i = 0; i < steps.length; i++) {
    const desc = safeStr(steps[i]?.description || steps[i]?.title).toLowerCase();
    if (!desc) continue;
    const packTitle = packTitles[i];
    if (packTitle && (desc.includes(packTitle.split(" ")[0]) || packTitle.includes(desc.slice(0, 12)))) {
      aligned++;
      continue;
    }
    if (alignPatterns.some((re) => re.test(desc))) aligned++;
  }

  const need = profile.minStepAlignCount ?? Math.min(2, steps.length);
  return aligned >= need;
}

function contentConflictsWithProfile(hay, profile) {
  const t = safeStr(hay);
  if (!t) return false;
  const conflict = compilePatterns(profile.contentConflictPatterns);
  const align = compilePatterns(profile.contentAlignPatterns);
  if (conflict.some((re) => re.test(t)) && !align.some((re) => re.test(t))) return true;
  return false;
}

function packIsInjectable(pack) {
  if (!pack || pack.status !== "active") return false;
  if (pack.packKind && pack.packKind !== "process-linear") return false;
  if (!pack.templateId) return false;
  const profile = getProfile(pack.eligibilityProfile);
  if (profile?.neverInject) return false;
  return true;
}

/**
 * @param {{ packId?: string, visualPackTopicKey?: string, block?: object, kind?: string }} ctx
 */
function shouldInjectVisualPack(ctx = {}) {
  const pack =
    getPackById(ctx.packId) ||
    getPackByLegacyKey(ctx.visualPackTopicKey || ctx.legacyVisualPackKey);
  if (!packIsInjectable(pack)) return false;

  const profile = getProfile(pack.eligibilityProfile);
  const kind = safeStr(ctx.kind);
  const block = ctx.block && typeof ctx.block === "object" ? ctx.block : {};
  const hay = blockTextHay(block, kind);

  if (profile && contentConflictsWithProfile(hay, profile)) return false;

  if (kind === "step-by-step-diagram" && profile?.requireStepAlignmentForSequence) {
    const stepsRaw = Array.isArray(block.steps) ? block.steps : [];
    const pseudoSteps = stepsRaw.map((raw, idx) => ({
      description: safeStr(raw).replace(/^Step\s+\d+:\s*/i, ""),
      title: `Step ${idx + 1}`,
    }));
    if (!sequenceStepsAlignWithProfile(pseudoSteps, profile)) return false;
  }

  return true;
}

function isTemplateImageUrlForPack(url, pack) {
  if (!pack?.urlFragment) return false;
  return safeStr(url).includes(pack.urlFragment);
}

function isAnyRegistryTemplateImageUrl(url) {
  const u = safeStr(url);
  if (!u) return false;
  return listPacks().some((p) => p.urlFragment && u.includes(p.urlFragment));
}

function getPackForTemplateUrl(url) {
  const u = safeStr(url);
  return listPacks().find((p) => p.urlFragment && u.includes(p.urlFragment)) || null;
}

function stepTextConflictsWithPack(stepText, pack) {
  const profile = getProfile(pack?.eligibilityProfile);
  if (!profile) return false;
  return contentConflictsWithProfile(stepText, profile);
}

/** Back-compat: photosynthesis legacy key */
function resolveVisualPackTopicKeyFromLessonMeta(meta) {
  const r = resolveVisualPackFromLessonMeta(meta);
  return {
    visualPackTopicKey: r.legacyVisualPackKey || r.packId,
    visualPackId: r.packId,
    pack: r.pack,
    matchedFrom: r.matchedFrom,
  };
}

function shouldInjectPhotosynthesisVisuals(ctx) {
  return shouldInjectVisualPack({
    ...ctx,
    visualPackTopicKey: ctx.visualPackTopicKey || "photosynthesis",
  });
}

module.exports = {
  getPackRegistry,
  getEligibilityProfiles,
  listPacks,
  getPackById,
  getPackByLegacyKey,
  resolvePackFromTaxonomy,
  resolveVisualPackFromLessonMeta,
  resolveVisualPackTopicKeyFromLessonMeta,
  packIsInjectable,
  shouldInjectVisualPack,
  shouldInjectPhotosynthesisVisuals,
  isTemplateImageUrlForPack,
  isAnyRegistryTemplateImageUrl,
  getPackForTemplateUrl,
  stepTextConflictsWithPack,
  normalizeHay,
  packMatchesHaystack,
};
