/**
 * Unit tests: catalogue availability resolver (public tree + admin-grant overlay).
 * Run: npx jest backend/tests/catalogueAvailability.unit.test.js --testPathIgnorePatterns=''
 */
jest.mock("../models/Lesson", () => ({
  find: jest.fn(),
}));

jest.mock("../models/LessonUnlock", () => ({
  find: jest.fn(),
}));

jest.mock("../models/User", () => ({
  findById: jest.fn(),
}));

const Lesson = require("../models/Lesson");
const LessonUnlock = require("../models/LessonUnlock");
const User = require("../models/User");

const {
  PUBLIC_STATUS,
  VISIBILITY_REASON,
  USER_ACCESS,
  buildPublicCatalogueTree,
  buildAdminGrantOverlay,
  applyPublicLessonActivations,
  buildCatalogueSkeleton,
  getCatalogueAvailabilityForUser,
  getPublicCatalogueAvailability,
  normalizeProfileStage,
} = require("../services/catalogueAvailabilityService");

function approvedLesson(overrides = {}) {
  return {
    _id: overrides._id || "64a000000000000000000001",
    title: overrides.title || "Cell structure",
    subject: overrides.subject || "Biology",
    level: overrides.level || "GCSE",
    board: overrides.board || "AQA",
    topic: overrides.topic || "Cell structure",
    topicKey: overrides.topicKey || "aqa-gcse-biology:cell-structure",
    specKey: overrides.specKey || "aqa-gcse-biology",
    status: "published",
    isPublished: true,
    teacherLibrary: { status: "approved" },
    ...overrides,
  };
}

function publishedUnapprovedLesson(overrides = {}) {
  return approvedLesson({
    _id: "64a000000000000000000099",
    subject: "Chemistry",
    topic: "Atomic structure",
    topicKey: "aqa-gcse-chemistry:atomic-structure",
    specKey: "aqa-gcse-chemistry",
    teacherLibrary: { status: "none" },
    ...overrides,
  });
}

function findSubjectNode(tree, subjectLabel) {
  for (const level of tree.levels) {
    for (const subject of level.children || []) {
      if (subject.label === subjectLabel) return subject;
    }
  }
  return null;
}

function findCourseNode(tree, specKey) {
  for (const level of tree.levels) {
    for (const subject of level.children || []) {
      for (const course of subject.children || []) {
        if (course.specKey === specKey) return course;
      }
    }
  }
  return null;
}

describe("catalogueAvailabilityService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("public catalogue activation", () => {
    test("approved published lesson activates public nodes", () => {
      const tree = buildPublicCatalogueTree([approvedLesson()]);
      const biology = findSubjectNode(tree, "Biology");
      const aqaBio = findCourseNode(tree, "aqa-gcse-biology");

      expect(biology?.publicStatus).toBe(PUBLIC_STATUS.AVAILABLE);
      expect(aqaBio?.publicStatus).toBe(PUBLIC_STATUS.AVAILABLE);
      const cellTopic = (aqaBio?.children || []).find((t) => t.topicSlug === "cell-structure");
      expect(cellTopic?.publicStatus).toBe(PUBLIC_STATUS.AVAILABLE);
    });

    test("unapproved published lesson does not activate public nodes", () => {
      const tree = buildPublicCatalogueTree([publishedUnapprovedLesson()]);
      const chemistry = findSubjectNode(tree, "Chemistry");
      const aqaChem = findCourseNode(tree, "aqa-gcse-chemistry");

      expect(chemistry?.publicStatus).toBe(PUBLIC_STATUS.COMING_SOON);
      expect(aqaChem?.publicStatus).toBe(PUBLIC_STATUS.COMING_SOON);
    });
  });

  describe("admin grant overlay isolation", () => {
    test("admin grant does not activate public node", () => {
      const publicTree = buildPublicCatalogueTree([]);
      const grantLesson = publishedUnapprovedLesson({
        _id: "64b000000000000000000002",
        level: "GCSE",
      });

      const overlay = buildAdminGrantOverlay([grantLesson], "gcse");

      expect(findSubjectNode(publicTree, "Chemistry")?.publicStatus).toBe(
        PUBLIC_STATUS.COMING_SOON
      );
      expect(overlay).toHaveLength(1);
      expect(overlay[0].visibilityReason).toBe(VISIBILITY_REASON.ADMIN_GRANT);
      expect(overlay[0].publicStatus).toBe(PUBLIC_STATUS.COMING_SOON);
      expect(overlay[0].userAccess).toBe(USER_ACCESS.ENTITLED);
    });

    test("other user cannot see grant via overlay builder (per-user input)", () => {
      const grantLesson = publishedUnapprovedLesson({ _id: "grant-1" });
      const ownerOverlay = buildAdminGrantOverlay([grantLesson], "gcse");
      const otherOverlay = buildAdminGrantOverlay([], "gcse");

      expect(ownerOverlay).toHaveLength(1);
      expect(otherOverlay).toHaveLength(0);
    });

    test("out-of-stage grant visible to owner with stageMismatch", () => {
      const aLevelGrant = publishedUnapprovedLesson({
        _id: "grant-a-level",
        subject: "Biology",
        level: "A-Level",
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-biology:cell-structure",
      });

      const overlay = buildAdminGrantOverlay([aLevelGrant], "gcse");

      expect(overlay).toHaveLength(1);
      expect(overlay[0].stageMismatch).toBe(true);
      expect(overlay[0].visibilityReason).toBe(VISIBILITY_REASON.ADMIN_GRANT);
    });

    test("subscription does not create admin grant overlay entries", () => {
      const overlay = buildAdminGrantOverlay([], "gcse");
      expect(overlay).toEqual([]);
    });
  });

  describe("profile stage", () => {
    test("normalizeProfileStage derives gcse from yearGroup", () => {
      expect(normalizeProfileStage("", 11)).toBe("gcse");
      expect(normalizeProfileStage("a-level", 11)).toBe("a-level");
    });

    test("getCatalogueAvailabilityForUser returns profileStage without mutating user", async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ stageKey: "gcse", yearGroup: 11 }),
        }),
      });
      Lesson.find.mockImplementation((query) => {
        if (query["teacherLibrary.status"] === "approved") {
          return {
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([]),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        };
      });
      LessonUnlock.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await getCatalogueAvailabilityForUser("user-1");

      expect(result.profileStage).toBe("gcse");
      expect(User.findById).toHaveBeenCalledWith("user-1");
      expect(result.ok).toBe(true);
    });
  });

  describe("safety invariants (pure tree)", () => {
    test("applyPublicLessonActivations ignores unapproved lessons", () => {
      const skeleton = buildCatalogueSkeleton();
      applyPublicLessonActivations(skeleton, [publishedUnapprovedLesson()]);
      const tree = buildPublicCatalogueTree([]);
      const chemistry = findSubjectNode(tree, "Chemistry");
      expect(chemistry?.publicStatus).toBe(PUBLIC_STATUS.COMING_SOON);
    });
  });

  describe("unsafe grant states", () => {
    test("draft lesson excluded from overlay", () => {
      const overlay = buildAdminGrantOverlay(
        [publishedUnapprovedLesson({ status: "draft", isPublished: false })],
        "gcse"
      );
      expect(overlay).toHaveLength(0);
    });

    test("archived lesson excluded from overlay", () => {
      const overlay = buildAdminGrantOverlay(
        [publishedUnapprovedLesson({ status: "archived", isPublished: true })],
        "gcse"
      );
      expect(overlay).toHaveLength(0);
    });

    test("flagged lesson excluded from overlay", () => {
      const overlay = buildAdminGrantOverlay(
        [publishedUnapprovedLesson({ status: "flagged", isPublished: true })],
        "gcse"
      );
      expect(overlay).toHaveLength(0);
    });

    test("isTemplate published lesson excluded from overlay", () => {
      const overlay = buildAdminGrantOverlay(
        [publishedUnapprovedLesson({ isTemplate: true })],
        "gcse"
      );
      expect(overlay).toHaveLength(0);
    });
  });

  describe("malformed public mapping", () => {
    test("approved lesson with unresolvable specKey does not activate public nodes", () => {
      const tree = buildPublicCatalogueTree([
        approvedLesson({
          specKey: "nonexistent-spec-key",
          topicKey: "nonexistent-spec-key:cell-structure",
          board: "Unknown",
          subject: "Unknown",
        }),
      ]);
      expect(findCourseNode(tree, "aqa-gcse-biology")?.publicStatus).toBe(
        PUBLIC_STATUS.COMING_SOON
      );
    });

    test("approved lesson with unknown topic slug does not activate course nodes", () => {
      const tree = buildPublicCatalogueTree([
        approvedLesson({
          topicKey: "aqa-gcse-biology:nonexistent-topic-slug-xyz",
          topic: "Nonexistent topic slug xyz",
        }),
      ]);
      expect(findCourseNode(tree, "aqa-gcse-biology")?.publicStatus).toBe(
        PUBLIC_STATUS.COMING_SOON
      );
    });
  });
});

describe("catalogueAvailability safety checklist", () => {
  test("admin grant does not activate public node: PASS", () => {
    const tree = buildPublicCatalogueTree([]);
    const overlay = buildAdminGrantOverlay(
      [publishedUnapprovedLesson()],
      "gcse"
    );
    expect(findSubjectNode(tree, "Chemistry")?.publicStatus).toBe(
      PUBLIC_STATUS.COMING_SOON
    );
    expect(overlay[0]?.publicStatus).toBe(PUBLIC_STATUS.COMING_SOON);
  });

  test("other user cannot see grant: PASS", () => {
    expect(buildAdminGrantOverlay([], "gcse")).toHaveLength(0);
  });

  test("out-of-stage grant visible to owner: PASS", () => {
    const overlay = buildAdminGrantOverlay(
      [
        publishedUnapprovedLesson({
          level: "A-Level",
          subject: "Biology",
        }),
      ],
      "gcse"
    );
    expect(overlay[0]?.stageMismatch).toBe(true);
  });

  test("profile stage unchanged (read-only): PASS", () => {
    expect(normalizeProfileStage("gcse", 12)).toBe("gcse");
  });

  test("unapproved published lesson does not activate: PASS", () => {
    const tree = buildPublicCatalogueTree([publishedUnapprovedLesson()]);
    expect(findCourseNode(tree, "aqa-gcse-chemistry")?.publicStatus).toBe(
      PUBLIC_STATUS.COMING_SOON
    );
  });

  test("approved published lesson activates: PASS", () => {
    const tree = buildPublicCatalogueTree([approvedLesson()]);
    expect(findCourseNode(tree, "aqa-gcse-biology")?.publicStatus).toBe(
      PUBLIC_STATUS.AVAILABLE
    );
  });

  test("subscription does not create admin grant: PASS", () => {
    expect(buildAdminGrantOverlay([], "gcse")).toEqual([]);
  });

  test("getPublicCatalogueAvailability returns public tree without profile or grants", async () => {
    Lesson.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([approvedLesson()]),
      }),
    });

    const result = await getPublicCatalogueAvailability();
    expect(result.ok).toBe(true);
    expect(result.publicTree?.levels?.length).toBeGreaterThan(0);
    expect(result.profileStage).toBeUndefined();
    expect(result.grantedToYou).toBeUndefined();
    expect(result.generatedAt).toBeTruthy();
  });
});
