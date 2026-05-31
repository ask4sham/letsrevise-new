import {
  TEACHER_BRAIN_DESIGN_BRIEF_MARKER,
  hasTeacherBrainDesignBrief,
  isTeacherBrainBriefEditorBlock,
  shouldHideNoteFromGenericEditorField,
  shouldShowTeacherBrainDesignBriefPanel,
  teacherBrainDesignBriefPanelText,
  teacherBrainDesignBriefKindLine,
} from "./teacherBrainDesignBrief";

const SAMPLE_NOTE = `${TEACHER_BRAIN_DESIGN_BRIEF_MARKER}

DIAGRAM BRIEF

Title:
Metabolism: The Cell's Economy`;

describe("teacherBrainDesignBrief utils", () => {
  it("detects Teacher Brain marker", () => {
    expect(hasTeacherBrainDesignBrief(SAMPLE_NOTE)).toBe(true);
    expect(hasTeacherBrainDesignBrief("Teacher planning note only")).toBe(false);
  });

  it("extracts panel body without marker or kind heading", () => {
    expect(teacherBrainDesignBriefPanelText(SAMPLE_NOTE)).toMatch(/^Title:/);
    expect(teacherBrainDesignBriefPanelText(SAMPLE_NOTE)).not.toContain(TEACHER_BRAIN_DESIGN_BRIEF_MARKER);
    expect(teacherBrainDesignBriefPanelText(SAMPLE_NOTE)).not.toMatch(/^DIAGRAM BRIEF/);
  });

  it("extracts brief kind line for panel subtitle", () => {
    expect(teacherBrainDesignBriefKindLine(SAMPLE_NOTE)).toBe("DIAGRAM BRIEF");
    const textImage = `${TEACHER_BRAIN_DESIGN_BRIEF_MARKER}\n\nTEXT → IMAGE DESIGN BRIEF\n\nImage Title:\nCompare`;
    expect(teacherBrainDesignBriefKindLine(textImage)).toBe("TEXT → IMAGE DESIGN BRIEF");
  });

  it("eligible block types include diagram activities", () => {
    expect(isTeacherBrainBriefEditorBlock({ type: "interactiveDiagram" })).toBe(true);
    expect(isTeacherBrainBriefEditorBlock({ type: "dragDropMatch" })).toBe(true);
    expect(isTeacherBrainBriefEditorBlock({ type: "interactiveSequence" })).toBe(true);
    expect(isTeacherBrainBriefEditorBlock({ type: "text" })).toBe(false);
  });

  it("shows panel only for eligible blocks with brief", () => {
    expect(
      shouldShowTeacherBrainDesignBriefPanel({ type: "interactiveDiagram", note: SAMPLE_NOTE })
    ).toBe(true);
    expect(
      shouldShowTeacherBrainDesignBriefPanel({ type: "interactiveDiagram", note: "plain note" })
    ).toBe(false);
    expect(shouldShowTeacherBrainDesignBriefPanel({ type: "text", note: SAMPLE_NOTE })).toBe(false);
  });

  it("hides Teacher Brain note from generic editor fields", () => {
    expect(shouldHideNoteFromGenericEditorField(SAMPLE_NOTE)).toBe(true);
    expect(shouldHideNoteFromGenericEditorField("Plain teacher note")).toBe(false);
  });
});
