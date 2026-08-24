import type {
  CatalogueGrantedItem,
  CataloguePublicStatus,
  CatalogueTreeNode,
} from "../api/catalogueAvailability";

export type RevisionOption = {
  value: string;
  label: string;
  publicStatus: CataloguePublicStatus;
  specKey?: string;
  topicKey?: string;
};

export type GroupedRevisionOptions = {
  label: string;
  options: RevisionOption[];
};

function topicOptionFromNode(node: CatalogueTreeNode): RevisionOption {
  const topicKey = node.topicKey || "";
  return {
    value: topicKey || node.label,
    label: formatComingSoonLabel(node.label, node.publicStatus),
    publicStatus: node.publicStatus,
    topicKey: node.topicKey,
  };
}

function courseTopicNodes(courseNode: CatalogueTreeNode | null): CatalogueTreeNode[] {
  if (!courseNode?.children?.length) return [];
  return courseNode.children.filter((node) => node.kind === "topic");
}

export function formatComingSoonLabel(label: string, publicStatus: CataloguePublicStatus): string {
  if (publicStatus === "coming_soon") return `${label} — Coming soon`;
  return label;
}

export function findProfileLevelNode(
  levels: CatalogueTreeNode[] | undefined,
  profileStage: string
): CatalogueTreeNode | null {
  if (!levels?.length || !profileStage) return null;
  return levels.find((node) => node.kind === "level" && node.stageKey === profileStage) || null;
}

function findSubjectNode(levelNode: CatalogueTreeNode | null, subjectLabel: string): CatalogueTreeNode | null {
  if (!levelNode?.children?.length || !subjectLabel) return null;
  return (
    levelNode.children.find((node) => node.kind === "subject" && node.label === subjectLabel) || null
  );
}

function findCourseNode(subjectNode: CatalogueTreeNode | null, specKey: string): CatalogueTreeNode | null {
  if (!subjectNode?.children?.length || !specKey) return null;
  return subjectNode.children.find((node) => node.kind === "course" && node.specKey === specKey) || null;
}

export function buildRevisionSubjectOptions(levelNode: CatalogueTreeNode | null): RevisionOption[] {
  if (!levelNode?.children?.length) return [];
  return levelNode.children
    .filter((node) => node.kind === "subject")
    .map((subject) => ({
      value: subject.label,
      label: formatComingSoonLabel(subject.label, subject.publicStatus),
      publicStatus: subject.publicStatus,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildRevisionCourseOptions(
  levelNode: CatalogueTreeNode | null,
  subjectLabel: string
): RevisionOption[] {
  const subjectNode = findSubjectNode(levelNode, subjectLabel);
  if (!subjectNode?.children?.length) return [];

  return subjectNode.children
    .filter((node) => node.kind === "course" && node.specKey)
    .map((course) => ({
      value: course.specKey as string,
      label: formatComingSoonLabel(
        formatCatalogueCourseDisplayLabel(course.label, course.specKey),
        course.publicStatus
      ),
      publicStatus: course.publicStatus,
      specKey: course.specKey,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildGroupedRevisionTopicOptions(
  levelNode: CatalogueTreeNode | null,
  subjectLabel: string,
  specKey: string,
  options?: { groupLabelPrefix?: string }
): GroupedRevisionOptions[] {
  const subjectNode = findSubjectNode(levelNode, subjectLabel);
  const courseNode = findCourseNode(subjectNode, specKey);
  const prefix = options?.groupLabelPrefix ? `${options.groupLabelPrefix} · ` : "";
  const groups: GroupedRevisionOptions[] = [];
  const groupIndex = new Map<string, number>();

  for (const node of courseTopicNodes(courseNode)) {
    const groupLabel = `${prefix}${node.groupLabel || "Topics"}`;
    let idx = groupIndex.get(groupLabel);
    if (idx === undefined) {
      groups.push({ label: groupLabel, options: [] });
      idx = groups.length - 1;
      groupIndex.set(groupLabel, idx);
    }
    groups[idx].options.push(topicOptionFromNode(node));
  }

  return groups;
}

export function buildRevisionTopicOptions(
  levelNode: CatalogueTreeNode | null,
  subjectLabel: string,
  specKey: string
): RevisionOption[] {
  return buildGroupedRevisionTopicOptions(levelNode, subjectLabel, specKey).flatMap((g) => g.options);
}

export function findCatalogueTopicNode(
  levelNode: CatalogueTreeNode | null,
  subjectLabel: string,
  specKey: string,
  selectedTopicKey: string
): CatalogueTreeNode | null {
  const subjectNode = findSubjectNode(levelNode, subjectLabel);
  const courseNode = findCourseNode(subjectNode, specKey);
  if (!selectedTopicKey) return null;
  return (
    courseTopicNodes(courseNode).find(
      (node) =>
        node.topicKey === selectedTopicKey ||
        node.label === selectedTopicKey ||
        node.topicSlug === selectedTopicKey
    ) || null
  );
}

function extractTopicSlug(topicKeyRaw: string): string {
  const raw = String(topicKeyRaw || "").trim();
  if (!raw) return "";
  const colon = raw.indexOf(":");
  if (colon >= 0) return raw.slice(colon + 1).trim();
  return raw;
}

/** Mirrors resolveTopicLabelToKey / backend composite label stripping. */
function extractLegacyTopicLabelCandidates(raw: string | undefined): string[] {
  const out: string[] = [];
  const add = (value: string) => {
    const trimmed = String(value || "").trim();
    if (!trimmed || out.includes(trimmed)) return;
    out.push(trimmed);
  };

  const source = String(raw || "").trim();
  if (!source) return out;
  add(source);
  const noParens = source.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  add(noParens);
  for (const part of noParens.split(/[–—|:]/)) {
    add(part.trim());
  }
  return out;
}

function normalizeTopicLabel(value: string | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyTopicLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function loosenTopicSlug(slug: string): string {
  return slug.replace(/-and-/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function legacyTopicMatchesCanonicalLabel(
  lessonTopic: string | undefined,
  canonicalLabel: string
): boolean {
  if (!lessonTopic || !canonicalLabel) return false;
  const canonNorm = normalizeTopicLabel(canonicalLabel);
  for (const candidate of extractLegacyTopicLabelCandidates(lessonTopic)) {
    if (normalizeTopicLabel(candidate) === canonNorm) return true;
  }
  return false;
}

function legacyTopicMatchesSelectedSlug(lessonTopic: string | undefined, selectedTopicKey: string): boolean {
  const selectedSlug = extractTopicSlug(selectedTopicKey);
  if (!selectedSlug || !lessonTopic) return false;
  const target = loosenTopicSlug(selectedSlug);
  for (const candidate of extractLegacyTopicLabelCandidates(lessonTopic)) {
    if (loosenTopicSlug(slugifyTopicLabel(candidate)) === target) return true;
  }
  return false;
}

export function lessonMatchesCatalogueTopic(
  lesson: { topic?: string; topicKey?: string },
  selectedTopicKey: string,
  canonicalLabel?: string
): boolean {
  if (!selectedTopicKey) return true;
  const lessonKey = String(lesson.topicKey || "").trim();
  if (lessonKey && lessonKey === selectedTopicKey) return true;
  if (canonicalLabel && legacyTopicMatchesCanonicalLabel(lesson.topic, canonicalLabel)) {
    return true;
  }
  if (legacyTopicMatchesSelectedSlug(lesson.topic, selectedTopicKey)) {
    return true;
  }
  return normalizeTopicLabel(lesson.topic) === normalizeTopicLabel(selectedTopicKey);
}

export function getSelectedRevisionStatus(
  levelNode: CatalogueTreeNode | null,
  revisionSubject: string,
  revisionCourse: string,
  revisionTopic: string
): {
  subjectStatus: CataloguePublicStatus | null;
  courseStatus: CataloguePublicStatus | null;
  topicStatus: CataloguePublicStatus | null;
  isComingSoon: boolean;
  statusHeadline: string | null;
} {
  const subjectNode = findSubjectNode(levelNode, revisionSubject);
  const courseNode = findCourseNode(subjectNode, revisionCourse);
  const topicNode = findCatalogueTopicNode(levelNode, revisionSubject, revisionCourse, revisionTopic);

  const subjectStatus = subjectNode?.publicStatus ?? null;
  const courseStatus = courseNode?.publicStatus ?? null;
  const topicStatus = topicNode?.publicStatus ?? null;

  const isComingSoon =
    subjectStatus === "coming_soon" ||
    courseStatus === "coming_soon" ||
    topicStatus === "coming_soon";

  let statusHeadline: string | null = null;
  if (revisionSubject && isComingSoon) {
    statusHeadline = formatComingSoonLabel(revisionSubject, "coming_soon");
  }

  return { subjectStatus, courseStatus, topicStatus, isComingSoon, statusHeadline };
}

export function matchingAdminGrants(
  grants: CatalogueGrantedItem[] | undefined,
  revisionSubject: string,
  revisionCourse: string,
  revisionTopic: string
): CatalogueGrantedItem[] {
  if (!grants?.length || !revisionSubject || !revisionCourse || !revisionTopic) return [];

  return grants.filter((grant) => {
    if (grant.visibilityReason !== "admin_grant") return false;
    if (grant.subject && grant.subject !== revisionSubject) return false;
    if (grant.specKey && grant.specKey !== revisionCourse) return false;
    if (grant.topicKey && grant.topicKey !== revisionTopic) return false;
    if (!grant.topicKey && grant.topic && grant.topic !== revisionTopic) return false;
    return true;
  });
}

export function revisionCourseToSpecKey(
  revisionCourse: string,
  revisionSubject: string,
  legacyResolver: () => string | null
): string | null {
  if (!revisionCourse) return null;
  if (revisionCourse.includes("-") && !revisionCourse.includes("|")) return revisionCourse;
  return legacyResolver();
}

/** Public MY REVISION actions — never enabled by admin grants or coming_soon alone. */
export function computeRevisionPublicActionsEnabled(
  topicStatus: CataloguePublicStatus | null,
  myRevisionLessonCount: number
): boolean {
  return topicStatus === "available" && myRevisionLessonCount > 0;
}

/** Display-only: Edexcel IGCSE Biology (4BI1) course labels must not show Foundation/Higher. */
export function formatCatalogueCourseDisplayLabel(label: string, specKey?: string | null): string {
  if (specKey !== "edexcel-igcse-biology") return label;
  return label
    .replace(/\s·\s*(Foundation|Higher)\b/gi, "")
    .replace(/\s+(Foundation|Higher)\s*$/gi, "")
    .trim();
}

export function deriveStageKeyFromYearGroup(yearGroup: unknown): string {
  const n = Number(yearGroup);
  if (!Number.isFinite(n)) return "";
  if (n >= 7 && n <= 9) return "ks3";
  if (n >= 10 && n <= 11) return "gcse";
  if (n >= 12 && n <= 13) return "a-level";
  return "";
}

export function resolveProfileStageKey(
  catalogueProfileStage: string | undefined,
  userStageKey: string | undefined,
  userYearGroup?: unknown
): string {
  const fromCatalogue = safeNormalizeStage(catalogueProfileStage);
  if (fromCatalogue) return fromCatalogue;
  const fromUser = safeNormalizeStage(userStageKey);
  if (fromUser) return fromUser;
  return deriveStageKeyFromYearGroup(userYearGroup);
}

function safeNormalizeStage(value: string | undefined): string {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (!v) return "";
  if (v.includes("ks3")) return "ks3";
  if (v.includes("gcse") || v.includes("igcse")) return "gcse";
  if (v.includes("a-level") || v.includes("alevel") || v.includes("a level")) return "a-level";
  return v;
}

export function shouldShowGrantedSection(grants: CatalogueGrantedItem[] | undefined): boolean {
  return Array.isArray(grants) && grants.some((g) => g.visibilityReason === "admin_grant");
}

export function filterAdminGrants(grants: CatalogueGrantedItem[] | undefined): CatalogueGrantedItem[] {
  if (!grants?.length) return [];
  return grants.filter((g) => g.visibilityReason === "admin_grant");
}
