import { TEACHER_BRAIN_DESIGN_BRIEF_MARKER } from "./teacherBrainDesignBrief";
import { blockNoteForPersist, withPersistedBlockNote } from "./lessonBlockPersist";
import { buildDragDropMatchBlockForPersist } from "./dragDropMatchDiagram";

const BRIEF_NOTE = `${TEACHER_BRAIN_DESIGN_BRIEF_MARKER}\n\nDIAGRAM BRIEF\n\nTitle:\nTest`;

describe("activity block note persist", () => {
  it("blockNoteForPersist keeps Teacher Brain marker text", () => {
    expect(blockNoteForPersist(BRIEF_NOTE)).toBe(BRIEF_NOTE);
    expect(blockNoteForPersist("  ")).toBeUndefined();
  });

  it("withPersistedBlockNote attaches note to save payload", () => {
    const out = withPersistedBlockNote({ type: "interactiveDiagram", title: "T" }, { note: BRIEF_NOTE });
    expect(out.note).toBe(BRIEF_NOTE);
  });

  it("buildDragDropMatchBlockForPersist preserves note", () => {
    const out = buildDragDropMatchBlockForPersist(
      {
        type: "dragDropMatch",
        title: "Match",
        pairs: [{ id: "p1", prompt: "A", answer: "B" }],
        note: BRIEF_NOTE,
      },
      { newId: () => "p2" }
    );
    expect(out?.note).toBe(BRIEF_NOTE);
  });
});
