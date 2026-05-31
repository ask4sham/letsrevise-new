import React from "react";
import { render, screen } from "@testing-library/react";
import { LessonDiagramBlockDisplay } from "../LessonDiagramBlockDisplay";
import { UploadedDiagramActivityShell } from "./UploadedDiagramActivityShell";
import { diagramPedagogyDisplayFromBlock } from "../../../utils/diagramPedagogyDisplay";
import { METABOLISM_GLUCOSE_JOURNEY_TASK_BLOCK } from "../../../utils/diagramPedagogyDisplay.fixtures";
import { UPLOADED_DIAGRAM_BLOCK_HEADING_TO_IMAGE_MAX_PX } from "../diagramPedagogySpacing";
import { headingToUploadedDiagramImageGapPx } from "./uploadedDiagramLayoutMetrics";
import {
  UPLOADED_DIAGRAM_ACTIVITY_SPACING,
} from "./uploadedDiagramActivitySpacing";
import "../diagramBlockPedagogy.css";
import "./lessonUploadedDiagramActivity.css";

jest.mock("../LessonMarkdown", () => ({
  LessonMarkdown: ({ children }: { children: string }) => (
    <div data-testid="lesson-markdown">{children}</div>
  ),
}));

const UPLOADED_ACTIVITY_TEST_CSS = `
  [data-lesson-presentation="v12"] .lesson-uploaded-diagram-activity-shell {
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
    margin: 0 !important;
    min-height: 0 !important;
  }
  [data-lesson-presentation="v12"] .lesson-uploaded-diagram-activity-shell > h2.lesson-student-block-heading {
    margin: 0 !important;
  }
  [data-lesson-presentation="v12"] .lesson-uploaded-diagram-activity-shell > .lesson-student-diagram-slot {
    margin: 0 !important;
    min-height: 0 !important;
    display: block !important;
  }
  [data-lesson-presentation="v12"] .lesson-student-page-body img.lesson-uploaded-diagram__img {
    margin: 0 !important;
  }
`;

function renderUploadedMetabolismActivity(): HTMLElement {
  const display = diagramPedagogyDisplayFromBlock(METABOLISM_GLUCOSE_JOURNEY_TASK_BLOCK);
  const { container } = render(
    <div data-lesson-presentation="v12" className="lesson-student-page-body">
      <div id="block-6">
        <UploadedDiagramActivityShell heading="6 — Metabolism in a nutshell">
          <div
            className="lesson-student-diagram-slot"
            data-visual-block="diagram"
            data-uploaded-diagram-activity="1"
          >
            <LessonDiagramBlockDisplay
              block={METABOLISM_GLUCOSE_JOURNEY_TASK_BLOCK}
              showPedagogyCaption={false}
              suppressPedagogyTitle
            >
              <div className="lesson-uploaded-diagram" data-uploaded-diagram="1">
                <img
                  className="lesson-uploaded-diagram__img"
                  alt="metabolism map"
                  src="/metabolism-map.png"
                />
              </div>
            </LessonDiagramBlockDisplay>
          </div>
        </UploadedDiagramActivityShell>
      </div>
    </div>
  );
  void display;
  return container;
}

describe("uploaded diagram activity layout", () => {
  beforeAll(() => {
    const style = document.createElement("style");
    style.setAttribute("data-testid", "uploaded-diagram-activity-test-css");
    style.textContent = UPLOADED_ACTIVITY_TEST_CSS;
    document.head.appendChild(style);
  });

  afterAll(() => {
    const el = document.querySelector('[data-testid="uploaded-diagram-activity-test-css"]');
    el?.remove();
  });

  it("matches compact uploaded activity spacing contract snapshot", () => {
    expect(UPLOADED_DIAGRAM_ACTIVITY_SPACING).toMatchSnapshot();
    expect(UPLOADED_DIAGRAM_BLOCK_HEADING_TO_IMAGE_MAX_PX).toBe(
      UPLOADED_DIAGRAM_ACTIVITY_SPACING.headingToImageMaxPx
    );
  });

  it("keeps block heading to image margin chain under 20px", () => {
    const container = renderUploadedMetabolismActivity();
    const shell = container.querySelector(".lesson-uploaded-diagram-activity-shell");
    const heading = container.querySelector("h2.lesson-student-block-heading");
    const image = screen.getByAltText("metabolism map");
    expect(shell).toBeTruthy();
    expect(heading).toBeTruthy();
    expect(shell?.getAttribute("data-uploaded-diagram-layout")).toBe("compact-v2");

    const gap = headingToUploadedDiagramImageGapPx(heading!, image);
    expect(gap).toBeLessThan(UPLOADED_DIAGRAM_BLOCK_HEADING_TO_IMAGE_MAX_PX);
    expect(gap).toMatchSnapshot();
  });

  it("marks uploaded diagram activities for scoped layout CSS", () => {
    const container = renderUploadedMetabolismActivity();
    const slot = container.querySelector(".lesson-student-diagram-slot[data-uploaded-diagram-activity='1']");
    const wrapper = container.querySelector('[data-uploaded-diagram="1"]');
    expect(slot).toBeTruthy();
    expect(wrapper).toBeTruthy();
    expect(container.querySelector(".lr-diagram-pedagogy__media")).toBeTruthy();
    expect(container.querySelector('[data-testid="diagram-task"]')).toBeTruthy();
  });
});
