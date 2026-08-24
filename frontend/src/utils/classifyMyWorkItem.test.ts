import {
  classifyMyWorkItem,
  firstNonEmptySection,
  groupMyWorkItems,
  normalizeMyWorkItems,
  resolvePrimaryAction,
} from "./classifyMyWorkItem";
import type { MyWorkItem } from "../api/studentMyWork";

const NOW = new Date("2026-07-27T12:00:00.000Z");

function base(overrides: Partial<MyWorkItem> = {}): MyWorkItem {
  return {
    id: "a1",
    type: "worksheet",
    title: "Sample",
    status: "In progress",
    rawStatus: "IN_PROGRESS",
    dueAt: null,
    released: false,
    score: null,
    maxScore: null,
    submittedAt: null,
    linkTo: "/w/share1",
    ...overrides,
  };
}

describe("classifyMyWorkItem precedence", () => {
  test("released → Completed & results", () => {
    expect(
      classifyMyWorkItem(
        base({
          released: true,
          rawStatus: "MARKED",
          status: "Released",
          score: 8,
          maxScore: 10,
          dueAt: "2026-07-01T00:00:00.000Z",
        }),
        NOW
      )
    ).toEqual({ section: "completed", badge: "Released" });
  });

  test("submitted but unreleased → Waiting for results", () => {
    expect(
      classifyMyWorkItem(
        base({
          released: false,
          rawStatus: "SUBMITTED",
          status: "Awaiting release",
          dueAt: "2026-07-01T00:00:00.000Z",
        }),
        NOW
      )
    ).toEqual({ section: "waiting", badge: "Waiting for results" });
  });

  test("submitted past-due is not overdue", () => {
    const result = classifyMyWorkItem(
      base({
        released: false,
        rawStatus: "SUBMITTED",
        status: "Awaiting release",
        dueAt: "2026-07-01T00:00:00.000Z",
      }),
      NOW
    );
    expect(result.section).toBe("waiting");
    expect(result.badge).not.toBe("Overdue");
  });

  test("active past due → Overdue in Needs your attention", () => {
    expect(
      classifyMyWorkItem(
        base({ dueAt: "2026-07-20T00:00:00.000Z" }),
        NOW
      )
    ).toEqual({ section: "attention", badge: "Overdue" });
  });

  test("active due within 48 hours → Due soon", () => {
    expect(
      classifyMyWorkItem(
        base({ dueAt: "2026-07-28T10:00:00.000Z" }),
        NOW
      )
    ).toEqual({ section: "attention", badge: "Due soon" });
  });

  test("active later / no due → In progress", () => {
    expect(classifyMyWorkItem(base({ dueAt: null }), NOW)).toEqual({
      section: "in_progress",
      badge: "In progress",
    });
    expect(
      classifyMyWorkItem(base({ dueAt: "2026-08-10T00:00:00.000Z" }), NOW)
    ).toEqual({ section: "in_progress", badge: "In progress" });
  });

  test("MARKED but not released → waiting (not completed)", () => {
    expect(
      classifyMyWorkItem(
        base({
          released: false,
          rawStatus: "MARKED",
          status: "Released",
        }),
        NOW
      )
    ).toEqual({ section: "waiting", badge: "Waiting for results" });
  });
});

describe("groupMyWorkItems exclusivity", () => {
  test("every item appears once across sections", () => {
    const items = normalizeMyWorkItems(
      {
        worksheets: [
          base({ id: "w1", released: true, rawStatus: "MARKED", status: "Released" }),
          base({ id: "w2", rawStatus: "SUBMITTED", status: "Awaiting release" }),
          base({ id: "w3", dueAt: "2026-07-20T00:00:00.000Z" }),
          base({ id: "w4", dueAt: null }),
        ],
        quizzes: [
          base({
            id: "q1",
            type: "quiz",
            linkTo: "/q/qz1",
            dueAt: "2026-07-28T00:00:00.000Z",
          }),
        ],
        assessments: [],
      },
      NOW
    );

    const groups = groupMyWorkItems(items);
    const all = [
      ...groups.attention,
      ...groups.in_progress,
      ...groups.waiting,
      ...groups.completed,
    ];
    expect(all).toHaveLength(items.length);
    expect(new Set(all.map((i) => i.id)).size).toBe(items.length);
    expect(firstNonEmptySection(groups)).toBe("attention");
  });
});

describe("resolvePrimaryAction", () => {
  test("active uses Continue + linkTo without duplicate Open", () => {
    const action = resolvePrimaryAction(
      base({ linkTo: "/w/abc", viewLink: "/student/worksheet-attempts/1" })
    );
    expect(action.label).toBe("Continue");
    expect(action.to).toBe("/w/abc");
    expect(action.secondary).toBeUndefined();
  });

  test("released uses View result and prefers viewLink", () => {
    const action = resolvePrimaryAction(
      base({
        released: true,
        rawStatus: "MARKED",
        status: "Released",
        linkTo: "/w/abc",
        viewLink: "/student/worksheet-attempts/1",
      })
    );
    expect(action.label).toBe("View result");
    expect(action.to).toBe("/student/worksheet-attempts/1");
    expect(action.secondary?.to).toBe("/w/abc");
  });
});

describe("normalizeMyWorkItems", () => {
  test("tags workType from source arrays", () => {
    const items = normalizeMyWorkItems(
      {
        worksheets: [base({ id: "w1" })],
        quizzes: [base({ id: "q1", type: "quiz", linkTo: "/q/1" })],
        assessments: [base({ id: "a1", type: "assessment", linkTo: "/q/2" })],
      },
      NOW
    );
    expect(items.map((i) => i.workType)).toEqual(["worksheet", "quiz", "assessment"]);
  });
});
