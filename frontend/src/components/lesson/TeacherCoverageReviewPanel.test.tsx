import { render, screen, waitFor } from "@testing-library/react";
import { TeacherCoverageReviewPanel } from "./TeacherCoverageReviewPanel";
import * as lessonCoverageReviewApi from "../../api/lessonCoverageReview";

jest.mock("../../api/lessonCoverageReview");

describe("TeacherCoverageReviewPanel", () => {
  it("renders over-tested warning from API", async () => {
    jest.spyOn(lessonCoverageReviewApi, "fetchLessonCoverageReview").mockResolvedValue({
      centralConceptId: "reflex_arc_pathway",
      centralConceptName: "Reflex arc pathway",
      cognitiveSkillBalance: {},
      conceptsTaught: [],
      conceptsTested: [],
      overTested: [
        {
          id: "reflex_arc_pathway",
          name: "Reflex arc pathway",
          count: 4,
          appearances: [
            { label: "Drag & Drop" },
            { label: "Step-by-Step" },
            { label: "Checkpoint" },
            { label: "Quiz" },
          ],
          suggestedReplacement: ['Use "Synapse"', 'Use "Why reflexes are fast"'],
        },
      ],
      underTested: [{ id: "synapse", name: "Synapse", count: 0, appearances: [] }],
      hiddenSources: {
        flashcards: 1,
        quizDrafts: 2,
        practiceExamDrafts: 0,
        bankFlashcards: 1,
        bankQuizQuestions: 1,
        bankExamQuestions: 0,
      },
      dominanceWarnings: [],
      generatedAt: new Date().toISOString(),
    });

    render(<TeacherCoverageReviewPanel lessonId="abc123" />);

    await waitFor(() => {
      expect(screen.getByText(/Coverage review/i)).toBeInTheDocument();
      expect(screen.getByText(/Reflex arc pathway — tested 4 times/i)).toBeInTheDocument();
      expect(screen.getByText(/Synapse/i)).toBeInTheDocument();
    });
  });
});
