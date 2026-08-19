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

export function buildRevisionTopicOptions(
  levelNode: CatalogueTreeNode | null,
  subjectLabel: string,
  specKey: string
): RevisionOption[] {
  const subjectNode = findSubjectNode(levelNode, subjectLabel);
  const courseNode = findCourseNode(subjectNode, specKey);
  if (!courseNode?.children?.length) return [];

  return courseNode.children
    .filter((node) => node.kind === "topic")
    .map((topic) => ({
      value: topic.label,
      label: formatComingSoonLabel(topic.label, topic.publicStatus),
      publicStatus: topic.publicStatus,
      topicKey: topic.topicKey,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
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
  const topicNode =
    courseNode?.children?.find(
      (node) =>
        node.kind === "topic" &&
        (node.label === revisionTopic ||
          node.topicSlug === revisionTopic ||
          node.topicKey === revisionTopic)
    ) || null;

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
    if (grant.topic && grant.topic !== revisionTopic) return false;
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

export function resolveProfileStageKey(
  catalogueProfileStage: string | undefined,
  userStageKey: string | undefined
): string {
  const fromCatalogue = safeNormalizeStage(catalogueProfileStage);
  if (fromCatalogue) return fromCatalogue;
  return safeNormalizeStage(userStageKey);
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
