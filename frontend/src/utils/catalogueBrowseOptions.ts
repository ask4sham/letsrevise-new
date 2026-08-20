import type { CataloguePublicStatus, CatalogueTreeNode } from "../api/catalogueAvailability";
import {
  buildGroupedRevisionTopicOptions,
  buildRevisionCourseOptions,
  buildRevisionSubjectOptions,
  buildRevisionTopicOptions,
  findProfileLevelNode,
  formatCatalogueCourseDisplayLabel,
  formatComingSoonLabel,
  resolveProfileStageKey,
  type GroupedRevisionOptions,
} from "./catalogueRevisionOptions";

export type { GroupedRevisionOptions };

export const BROWSE_STAGE_URL_PARAM = "browseStage";

export type BrowseStageKey = "ks3" | "gcse" | "a-level" | "";

export type BrowseLessonFilterSource = {
  subject?: string;
  level?: string;
  board?: string;
  examBoard?: string;
  tier?: string;
  specKey?: string;
};

function safeNormalizeStage(value: string | undefined | null): BrowseStageKey {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (!v) return "";
  if (v.includes("ks3")) return "ks3";
  if (v.includes("gcse") || v.includes("igcse")) return "gcse";
  if (v.includes("a-level") || v.includes("alevel") || v.includes("a level")) return "a-level";
  return v as BrowseStageKey;
}

export function stageKeyToLessonLevel(stageKey: BrowseStageKey): string {
  if (stageKey === "ks3") return "KS3";
  if (stageKey === "gcse") return "GCSE";
  if (stageKey === "a-level") return "A-Level";
  return "";
}

export function stageLabel(stageKey: BrowseStageKey): string {
  return stageKeyToLessonLevel(stageKey);
}

export function parseBrowseStageParam(value: string | null | undefined): BrowseStageKey {
  return safeNormalizeStage(value);
}

/** URL browseStage when set; otherwise profile stage (or gcse default). */
export function resolveEffectiveBrowseStageKey(
  profileStageKey: BrowseStageKey,
  urlBrowseStage: BrowseStageKey
): BrowseStageKey {
  if (urlBrowseStage) return urlBrowseStage;
  if (profileStageKey) return profileStageKey;
  return "gcse";
}

export function isTemporaryBrowseStage(
  profileStageKey: BrowseStageKey,
  effectiveBrowseStageKey: BrowseStageKey
): boolean {
  return Boolean(
    profileStageKey && effectiveBrowseStageKey && profileStageKey !== effectiveBrowseStageKey
  );
}

export function backToMyStageLessonsLabel(profileStageKey: BrowseStageKey): string {
  const label = stageLabel(profileStageKey);
  return label ? `Back to my ${label} lessons` : "Back to my lessons";
}

export function buildBrowsePath(
  profileStageKey: BrowseStageKey,
  browseStageKey: BrowseStageKey,
  extra?: { subject?: string; topic?: string }
): string {
  const params = new URLSearchParams();
  if (browseStageKey && profileStageKey && browseStageKey !== profileStageKey) {
    params.set(BROWSE_STAGE_URL_PARAM, browseStageKey);
  } else if (browseStageKey && !profileStageKey && browseStageKey !== "gcse") {
    params.set(BROWSE_STAGE_URL_PARAM, browseStageKey);
  }
  if (extra?.subject) params.set("subject", extra.subject);
  if (extra?.topic) params.set("topic", extra.topic);
  const qs = params.toString();
  return qs ? `/browse-lessons?${qs}` : "/browse-lessons";
}

export function buildExplorePath(profileStageKey: BrowseStageKey, browseStageKey: BrowseStageKey): string {
  const params = new URLSearchParams();
  if (browseStageKey && profileStageKey && browseStageKey !== profileStageKey) {
    params.set(BROWSE_STAGE_URL_PARAM, browseStageKey);
  } else if (browseStageKey && !profileStageKey && browseStageKey !== "gcse") {
    params.set(BROWSE_STAGE_URL_PARAM, browseStageKey);
  }
  const qs = params.toString();
  return qs ? `/explore?${qs}` : "/explore";
}

export function findBrowseLevelNode(
  levels: CatalogueTreeNode[] | undefined,
  browseStageKey: BrowseStageKey
): CatalogueTreeNode | null {
  return findProfileLevelNode(levels, browseStageKey);
}

export function isBrowseLevelComingSoon(levelNode: CatalogueTreeNode | null): boolean {
  return !levelNode || levelNode.publicStatus === "coming_soon";
}

export function findBrowseSubjectNode(
  levelNode: CatalogueTreeNode | null,
  subjectLabel: string
): CatalogueTreeNode | null {
  if (!levelNode?.children?.length || !subjectLabel) return null;
  return (
    levelNode.children.find((node) => node.kind === "subject" && node.label === subjectLabel) || null
  );
}

export function isBrowseSubjectComingSoon(
  levelNode: CatalogueTreeNode | null,
  subjectLabel: string
): boolean {
  if (!subjectLabel) return false;
  const subjectNode = findBrowseSubjectNode(levelNode, subjectLabel);
  return !subjectNode || subjectNode.publicStatus === "coming_soon";
}

export function shouldHideBrowseFilters(
  levelNode: CatalogueTreeNode | null,
  selectedSubject: string
): boolean {
  if (isBrowseLevelComingSoon(levelNode)) return true;
  if (selectedSubject && isBrowseSubjectComingSoon(levelNode, selectedSubject)) return true;
  return false;
}

export function buildBrowseSubjectOptions(levelNode: CatalogueTreeNode | null) {
  return buildRevisionSubjectOptions(levelNode);
}

export function buildBrowseCourseOptions(levelNode: CatalogueTreeNode | null, subjectLabel: string) {
  return buildRevisionCourseOptions(levelNode, subjectLabel);
}

export function buildBrowseTopicOptions(
  levelNode: CatalogueTreeNode | null,
  subjectLabel: string,
  specKey: string
) {
  return buildRevisionTopicOptions(levelNode, subjectLabel, specKey);
}

function findCourseNodesForBrowse(
  subjectNode: CatalogueTreeNode | null,
  board?: string
): CatalogueTreeNode[] {
  if (!subjectNode?.children?.length) return [];
  const courses = subjectNode.children.filter((node) => node.kind === "course");
  const boardNorm = String(board || "")
    .trim()
    .toLowerCase();
  if (!boardNorm || boardNorm === "not set") return courses;
  return courses.filter(
    (course) =>
      course.label.toLowerCase().includes(boardNorm) ||
      String(course.specKey || "")
        .toLowerCase()
        .includes(boardNorm)
  );
}

/** Grouped topic options for Browse — canonical catalogue nodes only (no lesson.topic). */
export function buildBrowseGroupedTopicOptions(
  levelNode: CatalogueTreeNode | null,
  subjectLabel: string,
  board?: string
): GroupedRevisionOptions[] {
  const subjectNode = findBrowseSubjectNode(levelNode, subjectLabel);
  if (!subjectNode) return [];

  const courses = findCourseNodesForBrowse(subjectNode, board);
  const multiCourse = courses.length > 1;
  const merged: GroupedRevisionOptions[] = [];
  const groupIndex = new Map<string, number>();

  for (const course of courses) {
    if (!course.specKey) continue;
    const groups = buildGroupedRevisionTopicOptions(levelNode, subjectLabel, course.specKey, {
      groupLabelPrefix: multiCourse ? course.label : undefined,
    });
    for (const group of groups) {
      const existingIdx = groupIndex.get(group.label);
      if (existingIdx === undefined) {
        merged.push({ label: group.label, options: [...group.options] });
        groupIndex.set(group.label, merged.length - 1);
      } else {
        merged[existingIdx].options.push(...group.options);
      }
    }
  }

  return merged;
}

export function normalizeTierValue(tier: string): string {
  if (!tier) return "";
  const t = tier.toLowerCase();
  if (t.includes("foundation")) return "foundation";
  if (t.includes("higher")) return "higher";
  if (t.includes("advanced")) return "advanced";
  return t;
}

export function normalizeLevelLabel(level: string): string {
  if (!level) return "Not set";
  const l = level.toLowerCase();
  if (l.includes("ks3")) return "KS3";
  if (l.includes("gcse")) return "GCSE";
  if (l.includes("a-level") || l.includes("alevel") || l.includes("a level")) return "A-Level";
  return level;
}

export function lessonMatchesBrowseStage(level: string, browseStageKey: BrowseStageKey): boolean {
  const lessonLevel = normalizeLevelLabel(level).toLowerCase();
  if (browseStageKey === "gcse") return lessonLevel.includes("gcse") || lessonLevel.includes("igcse");
  if (browseStageKey === "ks3") return lessonLevel.includes("ks3");
  if (browseStageKey === "a-level") {
    return lessonLevel.includes("a-level") || lessonLevel.includes("alevel") || lessonLevel.includes("a level");
  }
  return true;
}

/** Board filter options from approved lessons only — no hard-coded seeds. */
export function buildBrowseBoardOptions(lessons: BrowseLessonFilterSource[]): string[] {
  const boards = new Set<string>();
  for (const lesson of lessons) {
    const board = String(lesson.examBoard ?? lesson.board ?? "").trim();
    boards.add(board || "Not set");
  }
  return Array.from(boards).sort((a, b) => {
    if (a === "Not set") return 1;
    if (b === "Not set") return -1;
    return a.localeCompare(b);
  });
}

/** Tier filter options from approved lessons; suppress tier for Edexcel IGCSE Biology (4BI1). */
export function buildBrowseTierOptions(lessons: BrowseLessonFilterSource[]): string[] {
  const tiers = new Set<string>();
  for (const lesson of lessons) {
    const specKey = String(lesson.specKey || "").toLowerCase();
    if (specKey === "edexcel-igcse-biology") continue;
    const tier = normalizeTierValue(String(lesson.tier || ""));
    if (tier) tiers.add(tier);
  }
  return Array.from(tiers).sort();
}

export function courseHasTierStep(specKey: string | undefined | null): boolean {
  if (!specKey) return false;
  const key = specKey.toLowerCase();
  if (key === "edexcel-igcse-biology") return false;
  return key.includes("maths-foundation") || key.includes("maths-higher") || key.includes("-foundation") || key.includes("-higher");
}

export function courseTierLabel(specKey: string | undefined | null): string {
  if (!specKey) return "";
  const key = specKey.toLowerCase();
  if (key.includes("foundation")) return "foundation";
  if (key.includes("higher")) return "higher";
  return "";
}

export {
  formatComingSoonLabel,
  formatCatalogueCourseDisplayLabel,
  resolveProfileStageKey,
};

export function browseComingSoonHeadline(
  browseStageKey: BrowseStageKey,
  subjectLabel: string,
  levelNode: CatalogueTreeNode | null
): string | null {
  if (isBrowseLevelComingSoon(levelNode)) {
    return formatComingSoonLabel(stageLabel(browseStageKey) || browseStageKey, "coming_soon");
  }
  if (subjectLabel && isBrowseSubjectComingSoon(levelNode, subjectLabel)) {
    return formatComingSoonLabel(subjectLabel, "coming_soon");
  }
  return null;
}

export function isCatalogueNodeComingSoon(status: CataloguePublicStatus | undefined): boolean {
  return status === "coming_soon";
}
