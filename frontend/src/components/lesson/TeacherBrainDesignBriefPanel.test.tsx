import React from "react";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { TeacherBrainDesignBriefPanel } from "./TeacherBrainDesignBriefPanel";
import { TEACHER_BRAIN_DESIGN_BRIEF_MARKER } from "../../utils/teacherBrainDesignBrief";

jest.mock("./LessonAutoTextarea", () => ({
  LessonAutoTextarea: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      data-testid="mock-note-textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const BRIEF_NOTE = `${TEACHER_BRAIN_DESIGN_BRIEF_MARKER}

DIAGRAM BRIEF

Title:
Glucose to ATP`;

describe("TeacherBrainDesignBriefPanel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows regenerate button when brief already exists", () => {
    render(
      <TeacherBrainDesignBriefPanel
        blockType="dragDropMatch"
        note={BRIEF_NOTE}
        onNoteChange={jest.fn()}
        onRequestInject={jest.fn()}
        refreshKey={1}
      />
    );
    expect(screen.getByRole("button", { name: /regenerate brief/i })).toBeInTheDocument();
  });

  it("renders brief once in purple panel only (no duplicate note field)", () => {
    render(
      <TeacherBrainDesignBriefPanel
        blockType="interactiveDiagram"
        note={BRIEF_NOTE}
        onNoteChange={jest.fn()}
      />
    );
    const panel = screen.getByTestId("teacher-brain-design-brief-panel");
    expect(panel).toBeInTheDocument();
    expect(screen.getByTestId("teacher-brain-brief-kind")).toHaveTextContent("DIAGRAM BRIEF");
    expect(within(panel).getByText(/Glucose to ATP/)).toBeInTheDocument();
    expect(screen.queryByTestId("teacher-brain-brief-note-field")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-note-textarea")).not.toBeInTheDocument();
  });

  it("shows missing brief hint for eligible blocks without Teacher Brain marker", () => {
    render(
      <TeacherBrainDesignBriefPanel
        blockType="interactiveDiagram"
        note=""
        onNoteChange={jest.fn()}
      />
    );
    expect(screen.queryByTestId("teacher-brain-design-brief-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("teacher-brain-design-brief-missing")).toBeInTheDocument();
    expect(screen.queryByTestId("teacher-brain-brief-note-field")).not.toBeInTheDocument();
  });

  it("shows normal teacher note in note field when marker absent", () => {
    const onNoteChange = jest.fn();
    render(
      <TeacherBrainDesignBriefPanel
        blockType="interactiveDiagram"
        note="Remember to add mitochondria image"
        onNoteChange={onNoteChange}
      />
    );
    expect(screen.queryByTestId("teacher-brain-design-brief-panel")).not.toBeInTheDocument();
    const ta = screen.getByTestId("mock-note-textarea");
    expect(ta).toHaveValue("Remember to add mitochondria image");
    fireEvent.change(ta, { target: { value: "Updated teacher note" } });
    expect(onNoteChange).toHaveBeenCalledWith("Updated teacher note");
  });

  it("copy brief writes full note to clipboard and collapses panel after 500ms", async () => {
    render(
      <TeacherBrainDesignBriefPanel
        blockType="dragDropMatch"
        note={BRIEF_NOTE}
        onNoteChange={jest.fn()}
      />
    );
    const panel = screen.getByTestId("teacher-brain-design-brief-panel");
    expect(panel).toHaveAttribute("data-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: /copy design brief/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(BRIEF_NOTE);
      expect(screen.getByRole("button", { name: /copy design brief/i })).toHaveTextContent("Copied");
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(panel).toHaveAttribute("data-expanded", "false");
    expect(panel.querySelector(".lr-teacher-brain-brief__pre")).not.toBeInTheDocument();
    expect(screen.getByTestId("teacher-brain-brief-kind")).toHaveTextContent("DIAGRAM BRIEF");
    expect(within(panel).getByText("Teacher Brain Design Brief")).toBeInTheDocument();
    expect(within(panel).getByText("Teacher only")).toBeInTheDocument();
  });

  it("expand toggle reopens collapsed brief panel", async () => {
    render(
      <TeacherBrainDesignBriefPanel
        blockType="interactiveSequence"
        note={BRIEF_NOTE}
        onNoteChange={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /copy design brief/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copy design brief/i })).toHaveTextContent("Copied");
    });
    act(() => {
      jest.advanceTimersByTime(500);
    });

    const panel = screen.getByTestId("teacher-brain-design-brief-panel");
    expect(panel).toHaveAttribute("data-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: /expand design brief/i }));
    expect(panel).toHaveAttribute("data-expanded", "true");
    expect(within(panel).getByText(/Glucose to ATP/)).toBeInTheDocument();
  });

  it("returns null for ineligible block types", () => {
    const { container } = render(
      <TeacherBrainDesignBriefPanel
        blockType="text"
        note={BRIEF_NOTE}
        onNoteChange={jest.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
