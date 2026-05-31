import {
  countTeacherBrainBriefsInPages,
  countTeacherBrainEligibleActivityBlocks,
  mergeTeacherBrainNotesIntoPages,
  pagesForTeacherBrainInjectionApi,
} from "./teacherBrainBriefPages";
import { TEACHER_BRAIN_DESIGN_BRIEF_MARKER } from "./teacherBrainDesignBrief";

const SAMPLE_NOTE = `${TEACHER_BRAIN_DESIGN_BRIEF_MARKER}\n\nDIAGRAM BRIEF`;

describe("teacherBrainBriefPages", () => {
  it("counts briefs and eligible activity blocks", () => {
    const pages = [
      {
        blocks: [
          { type: "dragDropMatch", note: SAMPLE_NOTE },
          { type: "text", content: "x" },
          { type: "interactiveSequence" },
        ],
      },
    ];
    expect(countTeacherBrainBriefsInPages(pages)).toBe(1);
    expect(countTeacherBrainEligibleActivityBlocks(pages)).toBe(2);
  });

  it("merges injected notes by block index", () => {
    const target = [{ blocks: [{ type: "dragDropMatch", pairs: [] }] }];
    const injected = [{ blocks: [{ type: "dragDropMatch", note: SAMPLE_NOTE }] }];
    const merged = mergeTeacherBrainNotesIntoPages(target, injected);
    expect(merged[0].blocks?.[0]).toMatchObject({ note: SAMPLE_NOTE });
  });

  it("merges note from payload.note on injected blocks", () => {
    const target = [{ blocks: [{ type: "interactiveDiagram", hotspots: [] }] }];
    const injected = [
      {
        blocks: [
          {
            type: "interactiveDiagram",
            payload: { note: SAMPLE_NOTE },
          },
        ],
      },
    ];
    const merged = mergeTeacherBrainNotesIntoPages(target, injected);
    expect(merged[0].blocks?.[0]).toMatchObject({ note: SAMPLE_NOTE });
  });

  it("pagesForTeacherBrainInjectionApi preserves drag-drop layout fields", () => {
    const pages = [
      {
        blocks: [
          {
            type: "dragDropMatch",
            matchMode: "textToImage",
            dragDropLayout: "textToImage",
            pairs: [{ id: "p1", prompt: "A", answer: "B" }],
          },
        ],
      },
    ];
    const api = pagesForTeacherBrainInjectionApi(pages);
    expect(api[0].blocks[0]).toMatchObject({
      type: "dragDropMatch",
      matchMode: "textToImage",
      dragDropLayout: "textToImage",
    });
  });

  it("merges using injection metadata coordinates", () => {
    const target = [
      {
        blocks: [
          { type: "text", content: "x" },
          { type: "interactiveSequence", sequenceSteps: [] },
        ],
      },
    ];
    const injected = [
      {
        blocks: [
          { type: "text" },
          { type: "interactiveSequence", note: SAMPLE_NOTE },
        ],
      },
    ];
    const merged = mergeTeacherBrainNotesIntoPages(target, injected, [
      { pageIndex: 0, blockIndex: 1, blockType: "interactiveSequence" },
    ]);
    expect((merged[0].blocks?.[1] as { note?: string })?.note).toBe(SAMPLE_NOTE);
  });
});
