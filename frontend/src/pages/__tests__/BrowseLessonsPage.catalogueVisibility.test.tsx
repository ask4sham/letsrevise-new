/**
 * 4F.34B.3 — catalogue must not hide whole lessons by legacy tier=advanced when Deeper Knowledge is off.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BrowseLessonsPage from "../BrowseLessonsPage";
import { getCatalogueAvailability } from "../../api/catalogueAvailability";
import axios from "axios";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
  },
}));

jest.mock("../../hooks/useCurrentUser", () => {
  const purchasedLessons: never[] = [];
  return {
    useCurrentUser: () => ({
      token: "test-token",
      user: {
        userType: "student",
        stageKey: "gcse",
        yearGroup: 11,
        purchasedLessons,
      },
      refresh: jest.fn(),
    }),
  };
});

jest.mock("../../api/catalogueAvailability");

const mockGetCatalogue = getCatalogueAvailability as jest.MockedFunction<typeof getCatalogueAvailability>;
const mockAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;

const gcseCatalogue = {
  ok: true,
  profileStage: "gcse",
  publicTree: {
    levels: [
      {
        id: "level:gcse",
        kind: "level" as const,
        label: "GCSE",
        stageKey: "gcse",
        publicStatus: "available" as const,
        children: [
          {
            id: "subject:biology",
            kind: "subject" as const,
            label: "Biology",
            publicStatus: "available" as const,
            children: [],
          },
        ],
      },
    ],
  },
  grantedToYou: [] as any[],
  generatedAt: new Date().toISOString(),
};

const catalogueLessons = [
  {
    _id: "lesson-higher",
    title: "Higher Tier Cells",
    subject: "Biology",
    level: "GCSE",
    tier: "higher",
    board: "AQA",
    topic: "Cell structure",
    teacherName: "Teacher",
    isPublished: true,
    hasAccess: true,
    locked: false,
  },
  {
    _id: "lesson-advanced-tier",
    title: "Legacy Advanced Photosynthesis",
    subject: "Biology",
    level: "GCSE",
    tier: "advanced",
    board: "AQA",
    topic: "Photosynthesis",
    teacherName: "Teacher",
    isPublished: true,
    hasAccess: true,
    locked: false,
  },
  {
    _id: "lesson-ks3",
    title: "KS3 Out Of Stage",
    subject: "Biology",
    level: "KS3",
    tier: "higher",
    board: "AQA",
    topic: "Intro cells",
    teacherName: "Teacher",
    isPublished: true,
    hasAccess: true,
    locked: false,
  },
];

function renderBrowseLessons() {
  return render(
    <MemoryRouter initialEntries={["/browse-lessons"]}>
      <BrowseLessonsPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("advancedMode", "false");
  mockGetCatalogue.mockResolvedValue(gcseCatalogue as any);
  mockAxiosGet.mockResolvedValue({ data: catalogueLessons });
});

describe("BrowseLessonsPage catalogue visibility (4F.34B.3)", () => {
  test("shows Higher Tier and legacy tier=advanced lessons when Deeper Knowledge is off", async () => {
    renderBrowseLessons();
    await waitFor(() => {
      expect(screen.getByText("2 lessons found")).toBeInTheDocument();
    });
    expect(screen.getByText("Higher Tier Cells")).toBeInTheDocument();
    expect(screen.getByText("Legacy Advanced Photosynthesis")).toBeInTheDocument();
    expect(screen.queryByText("KS3 Out Of Stage")).not.toBeInTheDocument();
  });

  test("advancedMode on does not change catalogue membership count", async () => {
    localStorage.setItem("advancedMode", "true");
    renderBrowseLessons();
    await waitFor(() => {
      expect(screen.getByText(/2 lessons found \(Advanced mode active\)/i)).toBeInTheDocument();
    });
    expect(screen.getByText("Higher Tier Cells")).toBeInTheDocument();
    expect(screen.getByText("Legacy Advanced Photosynthesis")).toBeInTheDocument();
  });
});
