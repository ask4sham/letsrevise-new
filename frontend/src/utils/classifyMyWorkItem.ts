import type { MyWorkItem } from "../api/studentMyWork";

export type MyWorkSectionId = "attention" | "in_progress" | "waiting" | "completed";

export type MyWorkStatusBadge =
  | "Overdue"
  | "Due soon"
  | "In progress"
  | "Waiting for results"
  | "Released";

export type ClassifiedMyWorkItem = MyWorkItem & {
  section: MyWorkSectionId;
  badge: MyWorkStatusBadge;
  workType: "worksheet" | "quiz" | "assessment";
};

const MS_48H = 48 * 60 * 60 * 1000;

export function isReleasedResult(item: Pick<MyWorkItem, "released">): boolean {
  return item.released === true;
}

export function isSubmittedUnreleased(
  item: Pick<MyWorkItem, "released" | "rawStatus" | "status">
): boolean {
  if (isReleasedResult(item)) return false;
  const raw = String(item.rawStatus || "");
  const status = String(item.status || "");
  return (
    raw === "SUBMITTED" ||
    raw === "submitted" ||
    raw === "MARKED" ||
    raw === "Marked" ||
    status === "Awaiting release" ||
    /awaiting/i.test(status)
  );
}

export function isActionableAttempt(
  item: Pick<MyWorkItem, "released" | "rawStatus" | "status">
): boolean {
  if (isReleasedResult(item) || isSubmittedUnreleased(item)) return false;
  const raw = String(item.rawStatus || "");
  const status = String(item.status || "");
  return (
    raw === "IN_PROGRESS" ||
    raw === "in_progress" ||
    raw === "In progress" ||
    status === "In progress" ||
    /in progress/i.test(status)
  );
}

/**
 * Mutually exclusive section classification.
 * Precedence: released → waiting → overdue → due soon → in progress.
 */
export function classifyMyWorkItem(
  item: MyWorkItem,
  now: Date = new Date()
): { section: MyWorkSectionId; badge: MyWorkStatusBadge } {
  if (isReleasedResult(item)) {
    return { section: "completed", badge: "Released" };
  }

  if (isSubmittedUnreleased(item)) {
    return { section: "waiting", badge: "Waiting for results" };
  }

  const dueMs = item.dueAt ? new Date(item.dueAt).getTime() : NaN;
  const hasDue = Number.isFinite(dueMs);
  const actionable = isActionableAttempt(item);

  if (actionable && hasDue && dueMs < now.getTime()) {
    return { section: "attention", badge: "Overdue" };
  }

  if (actionable && hasDue && dueMs >= now.getTime() && dueMs - now.getTime() <= MS_48H) {
    return { section: "attention", badge: "Due soon" };
  }

  return { section: "in_progress", badge: "In progress" };
}

export const MY_WORK_SECTION_ORDER: MyWorkSectionId[] = [
  "attention",
  "in_progress",
  "waiting",
  "completed",
];

export function groupMyWorkItems(
  items: ClassifiedMyWorkItem[]
): Record<MyWorkSectionId, ClassifiedMyWorkItem[]> {
  const groups: Record<MyWorkSectionId, ClassifiedMyWorkItem[]> = {
    attention: [],
    in_progress: [],
    waiting: [],
    completed: [],
  };
  for (const item of items) {
    groups[item.section].push(item);
  }
  return groups;
}

export function firstNonEmptySection(
  groups: Record<MyWorkSectionId, ClassifiedMyWorkItem[]>
): MyWorkSectionId | null {
  for (const id of MY_WORK_SECTION_ORDER) {
    if (groups[id].length > 0) return id;
  }
  return null;
}

export function normalizeMyWorkItems(data: {
  worksheets: MyWorkItem[];
  quizzes: MyWorkItem[];
  assessments: MyWorkItem[];
}, now: Date = new Date()): ClassifiedMyWorkItem[] {
  const tagged: Array<MyWorkItem & { workType: ClassifiedMyWorkItem["workType"] }> = [
    ...data.worksheets.map((i) => ({ ...i, workType: "worksheet" as const, type: "worksheet" as const })),
    ...data.quizzes.map((i) => ({ ...i, workType: "quiz" as const, type: "quiz" as const })),
    ...data.assessments.map((i) => ({ ...i, workType: "assessment" as const, type: "assessment" as const })),
  ];

  return tagged.map((item) => {
    const { section, badge } = classifyMyWorkItem(item, now);
    return { ...item, section, badge };
  });
}

export function resolvePrimaryAction(item: MyWorkItem): {
  label: string;
  to: string;
  secondary?: { label: string; to: string };
} {
  const { section } = classifyMyWorkItem(item);
  const inProgressLike = section === "attention" || section === "in_progress";
  const primaryTo = inProgressLike ? item.linkTo : item.viewLink ?? item.linkTo;

  let label = "View";
  if (inProgressLike) label = "Continue";
  else if (section === "completed") label = "View result";
  else if (section === "waiting") label = "View submission";

  const secondaryTo =
    item.linkTo && item.linkTo !== primaryTo ? item.linkTo : undefined;

  return {
    label,
    to: primaryTo,
    secondary: secondaryTo ? { label: "Open", to: secondaryTo } : undefined,
  };
}
