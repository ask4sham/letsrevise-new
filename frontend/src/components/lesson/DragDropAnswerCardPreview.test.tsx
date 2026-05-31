import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AnswerCardPreviewShell } from "./DragDropAnswerCardPreview";

describe("AnswerCardPreviewShell", () => {
  it("renders children only when enablePreviewZoom is false", () => {
    render(
      <AnswerCardPreviewShell enablePreviewZoom={false} answerText="Hello">
        <span data-testid="child">Compact</span>
      </AnswerCardPreviewShell>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enlarge preview/i })).not.toBeInTheDocument();
  });

  it("opens modal on zoom button click and closes on backdrop", () => {
    render(
      <AnswerCardPreviewShell enablePreviewZoom answerText="Phagocyte" imageSrc="https://x/img.png">
        <span>Compact</span>
      </AnswerCardPreviewShell>
    );
    fireEvent.click(screen.getByRole("button", { name: /enlarge preview:\s*phagocyte/i }));
    const dialog = screen.getByTestId("ddm-answer-preview-dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.textContent).toMatch(/phagocyte/i);
    fireEvent.click(screen.getByTestId("ddm-answer-preview-backdrop"));
    expect(screen.queryByTestId("ddm-answer-preview-dialog")).not.toBeInTheDocument();
  });

  it("shows hover popover on fine-pointer devices after delay", () => {
    const matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes("hover: hover"),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    Object.defineProperty(window, "matchMedia", { writable: true, value: matchMedia });

    jest.useFakeTimers();
    const { container } = render(
      <AnswerCardPreviewShell enablePreviewZoom answerText="Zoom me">
        <span>Compact</span>
      </AnswerCardPreviewShell>
    );
    const wrap = container.querySelector(".ddm-answer-preview__wrap");
    expect(wrap).toBeTruthy();
    fireEvent.mouseEnter(wrap!);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.getByTestId("ddm-answer-preview-popover")).toBeInTheDocument();
    expect(screen.getByTestId("ddm-answer-preview-popover").textContent).toMatch(/zoom me/i);
    fireEvent.mouseLeave(wrap!);
    expect(screen.queryByTestId("ddm-answer-preview-popover")).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it("closes modal on Escape", () => {
    render(
      <AnswerCardPreviewShell enablePreviewZoom answerText="Label">
        <span>Compact</span>
      </AnswerCardPreviewShell>
    );
    fireEvent.click(screen.getByRole("button", { name: /enlarge preview:\s*label/i }));
    expect(screen.getByTestId("ddm-answer-preview-dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("ddm-answer-preview-dialog")).not.toBeInTheDocument();
  });
});
