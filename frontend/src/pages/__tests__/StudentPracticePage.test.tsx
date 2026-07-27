/**
 * Practice setup redesign — class membership, no Teacher ID.
 */
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StudentPracticePage from "../StudentPracticePage";
import * as studentClassesApi from "../../api/studentClasses";
import * as practiceSetsApi from "../../api/practiceSets";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: () => {} },
        response: { use: () => {} },
      },
    })),
  },
  AxiosError: class AxiosError extends Error {},
  AxiosHeaders: function AxiosHeaders() {},
}));

jest.mock("../../hooks/useTaxonomy", () => ({
  useTaxonomy: () => ({
    data: {
      units: [
        {
          title: "Unit",
          topics: [
            { key: "cell-structure", topic: "Cell structure" },
            { key: "enzymes", topic: "Enzymes" },
          ],
        },
      ],
    },
    loading: false,
    error: null,
  }),
}));

jest.mock("../../components/SpecSelector", () => {
  const React = require("react");
  return {
    SpecSelector: ({ value, onChange, label = "Subject", id = "spec-selector", className }) =>
      React.createElement(
        "div",
        { className },
        React.createElement("label", { htmlFor: id }, label),
        React.createElement(
          "select",
          {
            id,
            "aria-label": label,
            value,
            onChange: (e) => onChange(e.target.value),
          },
          React.createElement("option", { value: "aqa-gcse-biology" }, "AQA GCSE Biology"),
          React.createElement(
            "option",
            { value: "edexcel-igcse-biology" },
            "Edexcel IGCSE Biology"
          )
        )
      ),
  };
});

jest.mock("../../api/studentClasses", () => {
  const actual = jest.requireActual("../../api/studentClasses");
  return {
    ...actual,
    getMyClassMemberships: jest.fn(),
  };
});

jest.mock("../../api/practiceSets", () => {
  const actual = jest.requireActual("../../api/practiceSets");
  return {
    ...actual,
    generatePracticeSet: jest.fn(),
  };
});

const mockGetMemberships = studentClassesApi.getMyClassMemberships as jest.MockedFunction<
  typeof studentClassesApi.getMyClassMemberships
>;
const mockGenerate = practiceSetsApi.generatePracticeSet as jest.MockedFunction<
  typeof practiceSetsApi.generatePracticeSet
>;

const singleMembership = {
  membershipPublicId: "mem-abc",
  class: {
    publicId: "class-1",
    name: "Year 11 Biology",
    subject: "Biology",
    board: "Edexcel",
    specKey: "edexcel-igcse-biology",
  },
  teacher: { displayName: "Sham Sharma" },
};

function renderPage(path = "/student/practice") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/student/practice" element={<StudentPracticePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

test("renders Practice title, progress strip, and three bordered step cards without stage rails", async () => {
  mockGetMemberships.mockResolvedValue([]);
  renderPage();

  expect(await screen.findByRole("heading", { level: 1, name: "Practice" })).toBeInTheDocument();
  expect(
    screen.getByText(/Choose a class, course and topic to create a focused practice session/i)
  ).toBeInTheDocument();

  const panel = screen.getByTestId("practice-setup-panel");
  expect(panel).toBeInTheDocument();
  expect(within(panel).queryByRole("heading", { name: /^Practice setup$/i })).not.toBeInTheDocument();
  expect(
    within(panel).getByRole("list", { name: /Practice setup progress/i })
  ).toBeInTheDocument();

  const classCard = within(panel).getByTestId("practice-row-class");
  const courseCard = within(panel).getByTestId("practice-row-course");
  const topicCard = within(panel).getByTestId("practice-topic-card");
  expect(classCard).toHaveClass("practice-setup__row--class");
  expect(courseCard).toHaveClass("practice-setup__row--course");
  expect(topicCard).toHaveClass("practice-setup__row--topic");
  expect(screen.getAllByTestId(/practice-row-|practice-topic-card/)).toHaveLength(3);

  // Stage rails removed — step cards expose headings only (progress strip owns step numbers).
  expect(within(classCard).getByRole("heading", { name: /Practice with class/i })).toBeInTheDocument();
  expect(within(courseCard).getByRole("heading", { name: /^Course$/i })).toBeInTheDocument();
  expect(within(topicCard).getByRole("heading", { name: /^Topic$/i })).toBeInTheDocument();
  expect(within(classCard).queryByLabelText(/stage rail/i)).not.toBeInTheDocument();

  expect(within(topicCard).getByTestId("practice-action-footer")).toBeInTheDocument();
  expect(
    within(topicCard).getByRole("button", { name: /Start practice/i })
  ).toBeInTheDocument();
});

test("Start practice lives inside the Topic card; no duplicate Practice with class label", async () => {
  mockGetMemberships.mockResolvedValue([singleMembership] as any);
  renderPage();
  expect(await screen.findByRole("combobox", { name: /^Class$/i })).toBeInTheDocument();
  const topicCard = screen.getByTestId("practice-topic-card");
  expect(
    within(topicCard).getByRole("button", { name: /Start practice/i })
  ).toBeInTheDocument();
  expect(screen.getAllByText(/Practice with class/i)).toHaveLength(1);
});

test("shows empty class state and no Teacher ID field", async () => {
  mockGetMemberships.mockResolvedValue([]);
  renderPage();

  expect(await screen.findByText(/You have not joined a class yet/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /View my classes/i })).toHaveAttribute(
    "href",
    "/student/classes"
  );
  expect(screen.queryByLabelText(/Teacher ID/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Student ID/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/507f1f77bcf86cd799439011/i)).not.toBeInTheDocument();
});

test("shows membership loading state", async () => {
  mockGetMemberships.mockImplementation(() => new Promise(() => {}));
  renderPage();
  expect(await screen.findByText(/Loading your classes/i)).toBeInTheDocument();
});

test("membership error shows Retry and recovers", async () => {
  mockGetMemberships.mockRejectedValue({
    response: { status: 500, data: { error: "Server error" } },
  });
  renderPage();
  expect(await screen.findByRole("button", { name: /Try again/i })).toBeInTheDocument();
  mockGetMemberships.mockResolvedValue([singleMembership] as any);
  fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
  expect(await screen.findByRole("combobox", { name: /^Class$/i })).toBeInTheDocument();
});

test("auto-selects single class and submits membershipPublicId only", async () => {
  mockGetMemberships.mockResolvedValue([singleMembership] as any);
  mockGenerate.mockResolvedValue({
    practiceSetId: "set-1",
    items: [
      {
        contentType: "quiz_mcq",
        contentId: "q1",
        topicKey: "edexcel-igcse-biology:cell-structure",
        prompt: "What is a cell?",
        choices: ["A", "B"],
      },
    ],
  });

  renderPage();
  expect(await screen.findByRole("combobox", { name: /^Class$/i })).toHaveValue("mem-abc");
  expect(screen.getByText(/Selected:/i)).toHaveTextContent(/Year 11 Biology/);
  expect(screen.getByText(/Selected:/i)).toHaveTextContent(/Sham Sharma/);

  // Class prefills course from specKey
  await waitFor(() => {
    expect(screen.getByRole("combobox", { name: /^Course$/i })).toHaveValue(
      "edexcel-igcse-biology"
    );
  });

  fireEvent.change(screen.getByRole("combobox", { name: /^Topic$/i }), {
    target: { value: "cell-structure" },
  });
  const start = screen.getByRole("button", { name: /Start practice/i });
  expect(start).toHaveAttribute("aria-describedby", "practice-start-hint");
  await waitFor(() => {
    expect(start).not.toBeDisabled();
  });
  fireEvent.click(start);

  await waitFor(() => {
    expect(mockGenerate).toHaveBeenCalled();
  });
  const payload = mockGenerate.mock.calls[0][0] as Record<string, unknown>;
  expect(payload.membershipPublicId).toBe("mem-abc");
  expect(payload).not.toHaveProperty("teacherId");
  expect(payload.specKey).toBe("edexcel-igcse-biology");
  expect(payload.topicKeys).toEqual(["edexcel-igcse-biology:cell-structure"]);
  expect(payload.limit).toBe(10);
  expect(await screen.findByText(/What is a cell/i)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /Questions/i })).toBeInTheDocument();
});

test("multiple memberships allow selection; Start disabled without topic", async () => {
  mockGetMemberships.mockResolvedValue([
    singleMembership,
    {
      membershipPublicId: "mem-2",
      class: { publicId: "c2", name: "Year 10 Sci", subject: "Science" },
      teacher: { displayName: "Tina Teacher" },
    },
  ] as any);

  renderPage();
  const classSelect = await screen.findByRole("combobox", { name: /^Class$/i });
  expect(classSelect).toHaveValue("");
  expect(screen.getByRole("button", { name: /Start practice/i })).toBeDisabled();
  expect(screen.getByText(/Select a class to continue/i)).toBeInTheDocument();

  fireEvent.change(classSelect, { target: { value: "mem-2" } });
  expect(screen.getByText(/Selected:/i)).toHaveTextContent(/Tina Teacher/);
  expect(screen.getByRole("button", { name: /Start practice/i })).toBeDisabled();
  expect(screen.getByText(/Select a topic to continue/i)).toBeInTheDocument();
});

test("course remains changeable and filters topics; Course label not Subject", async () => {
  mockGetMemberships.mockResolvedValue([singleMembership] as any);
  renderPage();
  await screen.findByRole("combobox", { name: /^Class$/i });

  expect(screen.getByRole("combobox", { name: /^Course$/i })).toBeInTheDocument();
  expect(screen.queryByLabelText(/^Subject$/i)).not.toBeInTheDocument();

  // Prefill then change course
  await waitFor(() => {
    expect(screen.getByRole("combobox", { name: /^Course$/i })).toHaveValue(
      "edexcel-igcse-biology"
    );
  });
  fireEvent.change(screen.getByRole("combobox", { name: /^Topic$/i }), { target: { value: "cell-structure" } });
  fireEvent.change(screen.getByRole("combobox", { name: /^Course$/i }), {
    target: { value: "aqa-gcse-biology" },
  });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Start practice/i })).toBeDisabled();
  });
});

test("preserves specKey from query params for class-linked Practice", async () => {
  mockGetMemberships.mockResolvedValue([
    {
      membershipPublicId: "mem-2",
      class: { publicId: "c2", name: "Bio" },
      teacher: { displayName: "Tina" },
    },
  ] as any);

  renderPage("/student/practice?specKey=edexcel-igcse-biology&topic=cell-structure");
  expect(await screen.findByRole("combobox", { name: /^Course$/i })).toHaveValue(
    "edexcel-igcse-biology"
  );
  expect(await screen.findByText("edexcel-igcse-biology:cell-structure")).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Start practice/i })).not.toBeDisabled();
  });
});

test("optional topic filters add and remove keys", async () => {
  mockGetMemberships.mockResolvedValue([singleMembership] as any);
  renderPage();
  await screen.findByRole("combobox", { name: /^Class$/i });
  await waitFor(() => {
    expect(screen.getByRole("combobox", { name: /^Course$/i })).toHaveValue(
      "edexcel-igcse-biology"
    );
  });

  fireEvent.click(screen.getByText(/Optional topic filters/i));
  fireEvent.change(screen.getByLabelText(/Add topic by code/i), {
    target: { value: "edexcel-igcse-biology:enzymes" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Add topic$/i }));
  expect(await screen.findByText("edexcel-igcse-biology:enzymes")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Remove edexcel-igcse-biology:enzymes/i }));
  await waitFor(() => {
    expect(screen.queryByText("edexcel-igcse-biology:enzymes")).not.toBeInTheDocument();
  });
});

test("stepper marks class current until selected, then progresses", async () => {
  mockGetMemberships.mockResolvedValue([
    singleMembership,
    {
      membershipPublicId: "mem-2",
      class: { publicId: "c2", name: "Other", subject: "Bio" },
      teacher: { displayName: "Other Teacher" },
    },
  ] as any);
  renderPage();
  const classSelect = await screen.findByRole("combobox", { name: /^Class$/i });
  expect(screen.getByTestId("practice-stepper-class")).toHaveAttribute("data-state", "current");

  fireEvent.change(classSelect, { target: { value: "mem-abc" } });
  await waitFor(() => {
    expect(screen.getByTestId("practice-stepper-class")).toHaveAttribute("data-state", "complete");
  });
  expect(screen.getByTestId("practice-stepper-topic")).toHaveAttribute("data-state", "current");
});

test("generating disables Start and Start another set clears questions", async () => {
  mockGetMemberships.mockResolvedValue([singleMembership] as any);
  let resolveGen: (v: unknown) => void = () => {};
  mockGenerate.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveGen = resolve;
      }) as Promise<any>
  );

  renderPage();
  await screen.findByRole("combobox", { name: /^Class$/i });
  await waitFor(() => {
    expect(screen.getByRole("combobox", { name: /^Course$/i })).toHaveValue(
      "edexcel-igcse-biology"
    );
  });
  fireEvent.change(screen.getByRole("combobox", { name: /^Topic$/i }), { target: { value: "cell-structure" } });
  const start = screen.getByRole("button", { name: /Start practice/i });
  fireEvent.click(start);
  await waitFor(() => expect(start).toBeDisabled());
  expect(start).toHaveAttribute("aria-busy", "true");
  fireEvent.click(start);
  expect(mockGenerate).toHaveBeenCalledTimes(1);

  resolveGen({
    practiceSetId: "set-9",
    items: [
      {
        contentType: "quiz_mcq",
        contentId: "q9",
        topicKey: "edexcel-igcse-biology:cell-structure",
        prompt: "Question nine?",
        choices: ["A", "B"],
      },
    ],
  });
  expect(await screen.findByText(/Question nine/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Start another set/i }));
  await waitFor(() => {
    expect(screen.queryByText(/Question nine/i)).not.toBeInTheDocument();
  });
  expect(screen.getByRole("combobox", { name: /^Class$/i })).toHaveValue("mem-abc");
});

test("membership errors reload memberships", async () => {
  mockGetMemberships.mockResolvedValue([singleMembership] as any);
  mockGenerate.mockRejectedValue({
    data: { code: "MEMBERSHIP_REMOVED", error: "gone" },
  });
  renderPage();
  await screen.findByRole("combobox", { name: /^Class$/i });
  await waitFor(() => {
    expect(screen.getByRole("combobox", { name: /^Course$/i })).toHaveValue(
      "edexcel-igcse-biology"
    );
  });
  fireEvent.change(screen.getByRole("combobox", { name: /^Topic$/i }), { target: { value: "cell-structure" } });
  mockGetMemberships.mockClear();
  mockGetMemberships.mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: /Start practice/i }));
  await waitFor(() => {
    expect(mockGetMemberships).toHaveBeenCalled();
  });
  expect(await screen.findByText(/no longer active|class link/i)).toBeInTheDocument();
});
