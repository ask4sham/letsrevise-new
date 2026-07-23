/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const fetchAvail = fetchFreshAvailability as jest.MockedFunction<typeof fetchFreshAvailability>;
const generate = generatePracticeSet as jest.MockedFunction<typeof generatePracticeSet>;

describe("TryFreshPracticeCta", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    clearSingleFlightForTests();
  });

  afterEach(() => {
    clearSingleFlightForTests();
  });

  test("shows Try another set when fresh items exist (lesson-scoped, no teacherId)", async () => {
    fetchAvail.mockResolvedValue({
      availableFreshCount: 3,
      requestedCount: 5,
      lessonPracticeAttemptedQuestionIds: [],
    } as any);

    render(
      <TryFreshPracticeCta
        specKey="spec"
        topicKey="topic"
        lessonId="lesson1"
        sessionExclusions={{
          contentKeys: ["quiz_mcq:507f1f77bcf86cd799439011"],
          stemTexts: ["How does sexual reproduction produce variation in offspring?"],
        }}
      />
    );

    expect(await screen.findByTestId("try-fresh-practice")).toHaveTextContent("Try another set");
    expect(fetchAvail).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonId: "lesson1",
        sessionExclusions: expect.objectContaining({
          contentKeys: ["quiz_mcq:507f1f77bcf86cd799439011"],
        }),
      })
    );
    expect(fetchAvail.mock.calls[0][0]).not.toHaveProperty("teacherId");
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

  test("does not request availability without lessonId", async () => {
    const { container } = render(
      <TryFreshPracticeCta specKey="spec" topicKey="topic" lessonId={undefined} />
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(fetchAvail).not.toHaveBeenCalled();
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
    expect(generate.mock.calls[0][0]).not.toHaveProperty("teacherId");
    expect(generate.mock.calls[0][0].lessonId).toBe("lesson1");

    await act(async () => {
      resolveGen({
        practiceSetId: "ps1",
        selectedCount: 5,
        items: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }],
      });
    });
  });
});
