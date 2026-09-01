import { fireEvent, render, screen } from "@testing-library/react";
import RevisionPracticeEditor, { buildEditorSlots } from "./RevisionPracticeEditor";
import { upsertRevisionPracticeOverride } from "../../utils/revisionPracticeOverrides";

const pages = [
  {
    pageId: "p1",
    blocks: [
      {
        id: "blk_test",
        type: "selfCheck",
        prompt: "What is a mutation in terms of genetic material?",
        options: ["A change in DNA sequence", "Cell division", "Protein fold", "Lipid layer"],
        correctAnswer: "A change in DNA sequence",
      },
    ],
  },
];

describe("RevisionPracticeEditor option layout", () => {
  test("renders full-width MCQ option text inputs", () => {
    render(
      <RevisionPracticeEditor
        pages={pages}
        quizQuestions={[]}
        onUpsertOverride={() => {}}
        onRemoveOverride={() => {}}
      />
    );

    const optionInputs = screen.getAllByLabelText(/Option \d text/i);
    expect(optionInputs).toHaveLength(4);
    for (const input of optionInputs) {
      expect(input).toHaveAttribute("type", "text");
      const style = (input as HTMLElement).style;
      expect(style.flex).toMatch(/^1 1 0(px)?$/);
      expect(style.minWidth).toMatch(/^0(px)?$/);
      expect(style.width).toBe("auto");
    }
  });
});

describe("RevisionPracticeEditor teacher-facing wording", () => {
  test("shows simplified generated-question label", () => {
    render(
      <RevisionPracticeEditor
        pages={pages}
        quizQuestions={[]}
        onUpsertOverride={() => {}}
        onRemoveOverride={() => {}}
      />
    );

    expect(screen.getByText("Question from lesson — edit to customise")).toBeInTheDocument();
    expect(
      screen.queryByText("Generated from checkpoint — edit to create a lesson override")
    ).not.toBeInTheDocument();
  });

  test("shows Undo Edit for matched edited question", () => {
    const override = upsertRevisionPracticeOverride([], {
      linkageKey: "blk_test",
      question: "Teacher edited mutation question?",
      options: ["A change in DNA sequence", "Cell division", "Protein fold", "Lipid layer"],
      correctAnswer: "A change in DNA sequence",
    });

    render(
      <RevisionPracticeEditor
        pages={pages}
        quizQuestions={override}
        onUpsertOverride={() => {}}
        onRemoveOverride={() => {}}
      />
    );

    expect(screen.getByText("Your edited question")).toBeInTheDocument();
    expect(
      screen.queryByText("Teacher override (persisted in this lesson)")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Question" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Restore lesson question" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Removes your edited version and restores the question from the lesson. Nothing else in the lesson is deleted."
      )
    ).not.toBeInTheDocument();
  });

  test("shows Remove Question for orphan edited question", () => {
    const makeBlock = (id: string, prompt: string, correctAnswer: string) => ({
      id,
      type: "selfCheck",
      prompt,
      options: ["Alpha", "Beta", "Gamma", "Delta"],
      correctAnswer,
    });

    const pagesWithoutDeletedSource = [
      {
        pageId: "p1",
        blocks: [
          makeBlock("blk_a", "Why can some mutations be inherited by offspring?", "Alpha"),
          makeBlock("blk_c", "What is a gene mutation?", "Gamma"),
          makeBlock("blk_d", "How can a mutation affect a protein?", "Delta"),
          makeBlock("blk_e", "Why might a mutation have no effect?", "Alpha"),
          makeBlock("blk_f", "Which change counts as a mutation?", "Beta"),
        ],
      },
    ];

    const override = upsertRevisionPracticeOverride([], {
      linkageKey: "blk_b",
      question: "Which statement best explains what a mutation is?",
      options: ["Alpha", "Beta", "Gamma", "Delta"],
      correctAnswer: "Beta",
    });

    render(
      <RevisionPracticeEditor
        pages={pagesWithoutDeletedSource}
        quizQuestions={override}
        onUpsertOverride={() => {}}
        onRemoveOverride={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Q5 ✎" }));

    expect(screen.getByText("Your edited question")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Question" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo Edit" })).not.toBeInTheDocument();
  });

  test("matched and orphan action buttons use the same remove callback", () => {
    const matchedOverride = upsertRevisionPracticeOverride([], {
      linkageKey: "blk_test",
      question: "Teacher edited mutation question?",
      options: ["A change in DNA sequence", "Cell division", "Protein fold", "Lipid layer"],
      correctAnswer: "A change in DNA sequence",
    });

    const onRemoveOverride = jest.fn();
    const { unmount } = render(
      <RevisionPracticeEditor
        pages={pages}
        quizQuestions={matchedOverride}
        onUpsertOverride={() => {}}
        onRemoveOverride={onRemoveOverride}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Undo Edit" }));
    expect(onRemoveOverride).toHaveBeenCalledWith({
      linkageKey: "blk_test",
      overrideId: matchedOverride[0].id,
    });

    unmount();
    onRemoveOverride.mockClear();

    const pagesWithoutDeletedSource = [
      {
        pageId: "p1",
        blocks: [
          {
            id: "blk_a",
            type: "selfCheck",
            prompt: "Why can some mutations be inherited by offspring?",
            options: ["Alpha", "Beta", "Gamma", "Delta"],
            correctAnswer: "Alpha",
          },
        ],
      },
    ];

    const orphanOverride = upsertRevisionPracticeOverride([], {
      linkageKey: "blk_b",
      question: "Which statement best explains what a mutation is?",
      options: ["Alpha", "Beta", "Gamma", "Delta"],
      correctAnswer: "Beta",
    });

    render(
      <RevisionPracticeEditor
        pages={pagesWithoutDeletedSource}
        quizQuestions={orphanOverride}
        onUpsertOverride={() => {}}
        onRemoveOverride={onRemoveOverride}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Q\d+ ✎/ }));

    fireEvent.click(screen.getByRole("button", { name: "Remove Question" }));
    expect(onRemoveOverride).toHaveBeenCalledWith({
      linkageKey: "blk_b",
      overrideId: orphanOverride[0].id,
    });
  });
});

describe("buildEditorSlots orphan priority", () => {
  test("keeps orphan teacher edit visible when five other sources remain", () => {
    const makeBlock = (id: string, prompt: string, correctAnswer: string) => ({
      id,
      type: "selfCheck",
      prompt,
      options: ["Alpha", "Beta", "Gamma", "Delta"],
      correctAnswer,
    });

    const pagesWithoutDeletedSource = [
      {
        pageId: "p1",
        blocks: [
          makeBlock("blk_a", "Why can some mutations be inherited by offspring?", "Alpha"),
          makeBlock("blk_c", "What is a gene mutation?", "Gamma"),
          makeBlock("blk_d", "How can a mutation affect a protein?", "Delta"),
          makeBlock("blk_e", "Why might a mutation have no effect?", "Alpha"),
          makeBlock("blk_f", "Which change counts as a mutation?", "Beta"),
        ],
      },
    ];

    const override = upsertRevisionPracticeOverride([], {
      linkageKey: "blk_b",
      question: "Which statement best explains what a mutation is?",
      options: ["Alpha", "Beta", "Gamma", "Delta"],
      correctAnswer: "Beta",
    });

    const slots = buildEditorSlots(pagesWithoutDeletedSource, override, 5);
    expect(slots.length).toBeLessThanOrEqual(5);
    expect(slots.length).toBeGreaterThanOrEqual(4);
    const orphanSlot = slots.find((s) => s.linkageKey === "blk_b");
    expect(orphanSlot).toBeTruthy();
    expect(orphanSlot!.isOverride).toBe(true);
    expect(orphanSlot!.isOrphan).toBe(true);
    expect(orphanSlot!.question).toBe("Which statement best explains what a mutation is?");
    expect(slots.filter((s) => s.isOverride && s.linkageKey === "blk_b")).toHaveLength(1);
  });
});
