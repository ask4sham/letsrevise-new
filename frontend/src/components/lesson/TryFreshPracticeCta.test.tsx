/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getStudentDashboard } from "../../api/studentDashboard";
import { fetchFreshAvailability, generatePracticeSet } from "../../api/practiceSets";
import { clearSingleFlightForTests } from "../../utils/freshPracticeSingleFlight";
import { TryFreshPracticeCta } from "./TryFreshPracticeCta";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock("../../api/studentDashboard", () => ({
  getStudentDashboard: jest.fn(),
}));

jest.mock("../../api/practiceSets", () => ({
  fetchFreshAvailability: jest.fn(),
  generatePracticeSet: jest.fn(),
}));

const getDash = getStudentDashboard as jest.MockedFunction<typeof getStudentDashboard>;
const fetchAvail = fetchFreshAvailability as jest.MockedFunction<typeof fetchFreshAvailability>;
const generate = generatePracticeSet as jest.MockedFunction<typeof generatePracticeSet>;

describe("TryFreshPracticeCta", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    clearSingleFlightForTests();
    getDash.mockResolvedValue({
      linkedTeachers: [{ teacherId: "t1" }],
    } as any);
  });

  afterEach(() => {
    clearSingleFlightForTests();
  });

  test("shows Try N new questions when fresh items exist", async () => {
    fetchAvail.mockResolvedValue({
      availableFreshCount: 3,
      requestedCount: 5,
      lessonPracticeAttemptedQuestionIds: [],
    } as any);

    render(<TryFreshPracticeCta specKey="spec" topicKey="topic" lessonId="lesson1" />);

    expect(await screen.findByTestId("try-fresh-practice")).toHaveTextContent(
      "Try 3 new questions"
    );
    expect(screen.queryByText("Continue learning")).toBeNull();
    expect(screen.queryByText("Review your practice")).toBeNull();
    expect(screen.queryByText("Back to dashboard")).toBeNull();
  });

  test("renders nothing when zero fresh items", async () => {
    fetchAvail.mockResolvedValue({
      availableFreshCount: 0,
      requestedCount: 5,
      lessonPracticeAttemptedQuestionIds: [],
    } as any);

    const { container } = render(
      <TryFreshPracticeCta specKey="spec" topicKey="topic" lessonId="lesson1" />
    );

    await waitFor(() => expect(fetchAvail).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("try-fresh-practice")).toBeNull();
  });

  test("double click creates one generation request", async () => {
    fetchAvail.mockResolvedValue({
      availableFreshCount: 5,
      requestedCount: 5,
      lessonPracticeAttemptedQuestionIds: [],
    } as any);

    let resolveGen: (v: unknown) => void = () => {};
    generate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGen = resolve;
        }) as any
    );

    render(<TryFreshPracticeCta specKey="spec" topicKey="topic" lessonId="lesson1" />);
    const btn = await screen.findByTestId("try-fresh-practice");
    fireEvent.click(btn);
    fireEvent.click(btn);

    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));

    await act(async () => {
      resolveGen({
        practiceSetId: "ps1",
        selectedCount: 5,
        items: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }],
      });
    });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    expect(String(mockNavigate.mock.calls[0][0])).toContain("/practice/quiz/");
    expect(String(mockNavigate.mock.calls[0][0])).toContain("practiceSetId=ps1");
  });

  test("selectedCount overrides stale availability display for navigation", async () => {
    fetchAvail.mockResolvedValue({
      availableFreshCount: 5,
      requestedCount: 5,
      lessonPracticeAttemptedQuestionIds: [],
    } as any);
    generate.mockResolvedValue({
      practiceSetId: "ps2",
      selectedCount: 3,
      items: [{ id: "a" }, { id: "b" }, { id: "c" }],
    } as any);

    render(<TryFreshPracticeCta specKey="spec" topicKey="topic" lessonId="lesson1" />);
    fireEvent.click(await screen.findByTestId("try-fresh-practice"));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(String(mockNavigate.mock.calls[0][0])).toContain("limit=3");
  });

  test("zero selectedCount does not open an empty quiz", async () => {
    fetchAvail.mockResolvedValue({
      availableFreshCount: 2,
      requestedCount: 5,
      lessonPracticeAttemptedQuestionIds: [],
    } as any);
    generate.mockResolvedValue({
      practiceSetId: "ps3",
      selectedCount: 0,
      items: [],
    } as any);

    render(<TryFreshPracticeCta specKey="spec" topicKey="topic" lessonId="lesson1" />);
    fireEvent.click(await screen.findByTestId("try-fresh-practice"));

    await waitFor(() => expect(generate).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId("try-fresh-practice")).toBeNull());
  });
});
