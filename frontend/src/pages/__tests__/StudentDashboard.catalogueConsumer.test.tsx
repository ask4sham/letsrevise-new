/**
 * MY REVISION catalogue consumer — component-level conformance tests.
 */
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StudentDashboard from "../StudentDashboard";
import { getCatalogueAvailability, getPublicCatalogue } from "../../api/catalogueAvailability";
import { getStudentDashboard } from "../../api/studentDashboard";
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

jest.mock("../../lib/supabaseClient", () => ({
  supabase: { from: jest.fn() },
}));

jest.mock("../../hooks/useCurrentUser", () => {
  const purchasedLessons: never[] = [];
  return {
    useCurrentUser: () => ({
      token: "test-token",
      user: {
        firstName: "Zuri",
        lastName: "Student",
        userType: "student",
        stageKey: "gcse",
        yearGroup: 11,
        purchasedLessons,
      },
    }),
  };
});

jest.mock("../../api/catalogueAvailability");
jest.mock("../../api/studentDashboard");
jest.mock("../../components/StudentMyClassesSection", () => () => <div data-testid="my-classes" />);

const mockGetCatalogue = getCatalogueAvailability as jest.MockedFunction<typeof getCatalogueAvailability>;
const mockGetPublicCatalogue = getPublicCatalogue as jest.MockedFunction<typeof getPublicCatalogue>;
const mockGetDashboard = getStudentDashboard as jest.MockedFunction<typeof getStudentDashboard>;
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
            id: "subject:chemistry",
            kind: "subject" as const,
            label: "Chemistry",
            publicStatus: "coming_soon" as const,
            children: [
              {
                id: "course:chem",
                kind: "course" as const,
                label: "AQA GCSE Chemistry (8462)",
                specKey: "aqa-gcse-chemistry",
                publicStatus: "coming_soon" as const,
                children: [
                  {
                    id: "topic:atomic",
                    kind: "topic" as const,
                    label: "Atomic structure",
                    topicSlug: "atomic-structure",
                    topicKey: "aqa-gcse-chemistry:atomic-structure",
                    groupLabel: "Atomic structure and the periodic table",
                    publicStatus: "coming_soon" as const,
                  },
                ],
              },
            ],
          },
          {
            id: "subject:biology",
            kind: "subject" as const,
            label: "Biology",
            publicStatus: "available" as const,
            children: [
              {
                id: "course:bio",
                kind: "course" as const,
                label: "AQA GCSE Biology (8461)",
                specKey: "aqa-gcse-biology",
                publicStatus: "available" as const,
                children: [
                  {
                    id: "topic:cell",
                    kind: "topic" as const,
                    label: "Cell structure",
                    topicSlug: "cell-structure",
                    topicKey: "aqa-gcse-biology:cell-structure",
                    groupLabel: "Cell biology",
                    publicStatus: "available" as const,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  grantedToYou: [] as any[],
  generatedAt: new Date().toISOString(),
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <StudentDashboard />
    </MemoryRouter>
  );
}

function revisionCombos() {
  const revision = document.querySelector(".student-dashboard-revision") as HTMLElement;
  return within(revision).getAllByRole("combobox");
}

async function selectChemistryPath() {
  const [subject, course, topic] = revisionCombos();
  fireEvent.change(subject, { target: { value: "Chemistry" } });
  fireEvent.change(course, { target: { value: "aqa-gcse-chemistry" } });
  fireEvent.change(topic, { target: { value: "aqa-gcse-chemistry:atomic-structure" } });
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("selectedStage", "a-level");
  mockGetDashboard.mockResolvedValue({
    ok: true,
    summary: { revisionFocus: "Focus" },
    weakTopics: [],
    recentActivity: [],
    studyPlan: { specKey: "aqa-gcse-biology", generatedAt: "", plan: [] },
    recommendations: { topics: [], lessons: [], days: 14 },
  });
  mockAxiosGet.mockResolvedValue({ data: [] });
});

describe("StudentDashboard catalogue consumer", () => {
  test("profile stage beats localStorage in greeting", async () => {
    mockGetCatalogue.mockResolvedValue(gcseCatalogue);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Hi Zuri · GCSE/i)).toBeInTheDocument();
    });
  });

  test("public catalogue fallback restores MY REVISION subjects when availability fails", async () => {
    mockGetCatalogue.mockRejectedValue(new Error("availability unavailable"));
    mockGetPublicCatalogue.mockResolvedValue({
      ok: true,
      publicTree: gcseCatalogue.publicTree,
      generatedAt: new Date().toISOString(),
    });
    renderDashboard();
    await waitFor(() => expect(mockGetPublicCatalogue).toHaveBeenCalled());
    const revision = document.querySelector(".student-dashboard-revision") as HTMLElement;
    expect(within(revision).getByRole("option", { name: /^Biology$/i })).toBeInTheDocument();
    expect(within(revision).getByRole("option", { name: /Chemistry — Coming soon/i })).toBeInTheDocument();
  });

  test("does not show Change stage link in dashboard header", async () => {
    mockGetCatalogue.mockResolvedValue(gcseCatalogue);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Hi Zuri · GCSE/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: /Change stage/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Saved browse stage/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Wrong stage/i)).not.toBeInTheDocument();
  });

  test("Chemistry is visible, selectable, and shows Coming soon banner with disabled public actions", async () => {
    mockGetCatalogue.mockResolvedValue(gcseCatalogue);
    renderDashboard();
    await waitFor(() => expect(mockGetCatalogue).toHaveBeenCalled());

    const revision = document.querySelector(".student-dashboard-revision") as HTMLElement;
    const [subject, course, topic] = within(revision).getAllByRole("combobox");
    expect(within(subject).getByRole("option", { name: /Chemistry — Coming soon/i })).toBeInTheDocument();
    fireEvent.change(subject, { target: { value: "Chemistry" } });
    expect(within(course).getAllByRole("option").length).toBeGreaterThan(1);
    fireEvent.change(course, { target: { value: "aqa-gcse-chemistry" } });
    fireEvent.change(topic, { target: { value: "aqa-gcse-chemistry:atomic-structure" } });

    expect(within(revision).getAllByText("Chemistry — Coming soon").length).toBeGreaterThan(0);
    expect(within(revision).getByRole("button", { name: /Learn topic/i })).toBeDisabled();
    expect(within(revision).getByRole("button", { name: /Quick quiz/i })).toBeDisabled();
  });

  test("admin grant does not enable public MY REVISION actions on coming soon Chemistry", async () => {
    mockGetCatalogue.mockResolvedValue({
      ...gcseCatalogue,
      grantedToYou: [
        {
          lessonId: "grant-chem-1",
          title: "Private Chemistry",
          subject: "Chemistry",
          level: "GCSE",
          board: "AQA",
          topic: "Atomic structure",
          specKey: "aqa-gcse-chemistry",
          topicKey: "aqa-gcse-chemistry:atomic-structure",
          publicStatus: "coming_soon",
          userAccess: "entitled",
          visibilityReason: "admin_grant",
        },
      ],
    });
    renderDashboard();
    await waitFor(() => expect(mockGetCatalogue).toHaveBeenCalled());
    await selectChemistryPath();

    const revision = document.querySelector(".student-dashboard-revision") as HTMLElement;
    expect(within(revision).getByRole("button", { name: /Learn topic/i })).toBeDisabled();
    expect(within(revision).getByText("Granted to you")).toBeInTheDocument();
    expect(within(revision).getByRole("link", { name: /^Learn$/i })).toHaveAttribute(
      "href",
      "/lesson/grant-chem-1"
    );
  });

  test("granted section hidden when empty", async () => {
    mockGetCatalogue.mockResolvedValue(gcseCatalogue);
    renderDashboard();
    await waitFor(() => expect(mockGetCatalogue).toHaveBeenCalled());
    expect(screen.queryByText("Granted to you")).not.toBeInTheDocument();
  });

  test("out-of-stage grant visible without changing profile greeting", async () => {
    mockGetCatalogue.mockResolvedValue({
      ...gcseCatalogue,
      grantedToYou: [
        {
          lessonId: "grant-a-level",
          title: "A-Level Biology grant",
          subject: "Biology",
          level: "A-Level",
          board: "AQA",
          topic: "Cells",
          specKey: "aqa-gcse-biology",
          topicKey: "aqa-gcse-biology:cells",
          publicStatus: "coming_soon",
          userAccess: "entitled",
          visibilityReason: "admin_grant",
          stageMismatch: true,
        },
      ],
    });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Hi Zuri · GCSE/i)).toBeInTheDocument();
      expect(screen.getByText(/Granted to you · different stage/i)).toBeInTheDocument();
    });
  });

  test("shows contained catalogue API error and dashboard still renders", async () => {
    mockGetCatalogue.mockRejectedValue(new Error("network"));
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load your curriculum catalogue/i);
      expect(screen.getByText("Continue learning")).toBeInTheDocument();
      expect(screen.getByText("MY REVISION")).toBeInTheDocument();
    });
  });

  test("Revision Focus preserved for available biology course selection", async () => {
    mockGetCatalogue.mockResolvedValue(gcseCatalogue);
    renderDashboard();
    await waitFor(() => expect(mockGetCatalogue).toHaveBeenCalled());

    const revision = document.querySelector(".student-dashboard-revision") as HTMLElement;
    const [subject, course, topic] = within(revision).getAllByRole("combobox");
    fireEvent.change(subject, { target: { value: "Biology" } });
    fireEvent.change(course, { target: { value: "aqa-gcse-biology" } });
    fireEvent.change(topic, { target: { value: "aqa-gcse-biology:cell-structure" } });

    await waitFor(() => {
      expect(mockGetDashboard).toHaveBeenCalledWith(
        expect.objectContaining({ specKey: "aqa-gcse-biology" })
      );
    });
  });

  test("coming-soon chemistry does not trigger revision focus spec fetch", async () => {
    mockGetCatalogue.mockResolvedValue(gcseCatalogue);
    renderDashboard();
    await waitFor(() => expect(mockGetCatalogue).toHaveBeenCalled());
    const callsBefore = mockGetDashboard.mock.calls.length;
    await selectChemistryPath();

    await waitFor(() => {
      const specCalls = mockGetDashboard.mock.calls
        .slice(callsBefore)
        .filter((call) => call[0]?.specKey === "aqa-gcse-chemistry");
      expect(specCalls).toHaveLength(0);
    });
  });

  test("Higher Tier and legacy tier=advanced catalogue lessons stay visible when Deeper Knowledge is off", async () => {
    localStorage.setItem("advancedMode", "false");
    mockGetCatalogue.mockResolvedValue(gcseCatalogue);
    mockAxiosGet.mockResolvedValue({
      data: [
        {
          _id: "lesson-higher",
          title: "Higher Tier Cells",
          subject: "Biology",
          level: "GCSE",
          tier: "higher",
          topic: "Cell structure",
          teacherName: "Teacher",
          isPublished: true,
        },
        {
          _id: "lesson-advanced-tier",
          title: "Legacy Advanced Photosynthesis",
          subject: "Biology",
          level: "GCSE",
          tier: "advanced",
          topic: "Photosynthesis",
          teacherName: "Teacher",
          isPublished: true,
        },
        {
          _id: "lesson-ks3",
          title: "KS3 Out Of Stage",
          subject: "Biology",
          level: "KS3",
          tier: "higher",
          topic: "Intro cells",
          teacherName: "Teacher",
          isPublished: true,
        },
      ],
    });
    renderDashboard();
    await waitFor(() => expect(mockGetCatalogue).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Browse all lessons/i }));
    await waitFor(() => {
      expect(screen.getByText("2 lessons")).toBeInTheDocument();
    });
    expect(screen.getByText("Higher Tier Cells")).toBeInTheDocument();
    expect(screen.getByText("Legacy Advanced Photosynthesis")).toBeInTheDocument();
    expect(screen.queryByText("KS3 Out Of Stage")).not.toBeInTheDocument();
  });

  test("advancedMode on does not change Continue learning catalogue count", async () => {
    localStorage.setItem("advancedMode", "true");
    mockGetCatalogue.mockResolvedValue(gcseCatalogue);
    mockAxiosGet.mockResolvedValue({
      data: [
        {
          _id: "lesson-higher",
          title: "Higher Tier Cells",
          subject: "Biology",
          level: "GCSE",
          tier: "higher",
          topic: "Cell structure",
          teacherName: "Teacher",
          isPublished: true,
        },
        {
          _id: "lesson-advanced-tier",
          title: "Legacy Advanced Photosynthesis",
          subject: "Biology",
          level: "GCSE",
          tier: "advanced",
          topic: "Photosynthesis",
          teacherName: "Teacher",
          isPublished: true,
        },
      ],
    });
    renderDashboard();
    await waitFor(() => expect(mockGetCatalogue).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Browse all lessons/i }));
    await waitFor(() => {
      expect(screen.getByText(/2 lessons \(Advanced mode active\)/i)).toBeInTheDocument();
    });
  });
});
