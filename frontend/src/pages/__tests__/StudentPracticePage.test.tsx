/**
 * Phase 3C: Practice page uses class membership, not Teacher ID.
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
          topics: [{ key: "cell-structure", topic: "Cell structure" }],
        },
      ],
    },
    loading: false,
    error: null,
  }),
}));

jest.mock("../../components/SpecSelector", () => ({
  SpecSelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <label>
      Course
      <select
        aria-label="Course"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="aqa-gcse-biology">AQA GCSE Biology</option>
        <option value="edexcel-igcse-biology">Edexcel IGCSE Biology</option>
      </select>
    </label>
  ),
}));

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

test("shows empty class state and no Teacher ID field", async () => {
  mockGetMemberships.mockResolvedValue([]);
  renderPage();

  expect(await screen.findByText(/You have not joined a class yet/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /View my classes/i })).toHaveAttribute(
    "href",
    "/student/classes"
  );
  expect(screen.queryByLabelText(/Teacher ID/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Advanced options \(teacher ID/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Student ID/i)).not.toBeInTheDocument();
});

test("auto-selects single class and submits membershipPublicId only", async () => {
  mockGetMemberships.mockResolvedValue([
    {
      membershipPublicId: "mem-abc",
      class: {
        publicId: "class-1",
        name: "Year 11 Biology",
        subject: "Biology",
        specKey: "aqa-gcse-biology",
      },
      teacher: { displayName: "Sham Sharma" },
    },
  ] as any);
  mockGenerate.mockResolvedValue({
    practiceSetId: "set-1",
    items: [
      {
        contentType: "quiz_mcq",
        contentId: "q1",
        topicKey: "aqa-gcse-biology:cell-structure",
        prompt: "What is a cell?",
        choices: ["A", "B"],
      },
    ],
  });

  renderPage();
  expect(await screen.findByRole("combobox", { name: /Practice with class/i })).toHaveValue(
    "mem-abc"
  );

  fireEvent.change(screen.getByLabelText(/^Topic$/i), {
    target: { value: "cell-structure" },
  });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Start practice/i })).not.toBeDisabled();
  });
  fireEvent.click(screen.getByRole("button", { name: /Start practice/i }));

  await waitFor(() => {
    expect(mockGenerate).toHaveBeenCalled();
  });
  const payload = mockGenerate.mock.calls[0][0] as Record<string, unknown>;
  expect(payload.membershipPublicId).toBe("mem-abc");
  expect(payload).not.toHaveProperty("teacherId");
  expect(payload.specKey).toBe("aqa-gcse-biology");
  expect(payload.topicKeys).toEqual(["aqa-gcse-biology:cell-structure"]);
  expect(await screen.findByText(/What is a cell/i)).toBeInTheDocument();
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
