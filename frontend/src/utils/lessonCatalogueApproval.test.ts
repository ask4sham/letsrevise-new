import {
  formatCatalogueApprovalDate,
  getCatalogueApprovalUi,
  normalizeCatalogueApprovalStatus,
} from "./lessonCatalogueApproval";

describe("lessonCatalogueApproval", () => {
  test("published lesson with no status shows submit action", () => {
    const ui = getCatalogueApprovalUi({ isPublished: true, teacherLibraryStatus: "none" });
    expect(ui.showSubmit).toBe(true);
    expect(ui.showResubmit).toBe(false);
    expect(ui.showDraftHelper).toBe(false);
    expect(ui.headline).toBe("Ready for review");
    expect(ui.submitButtonLabel).toBe("Submit to LetsRevise");
  });

  test("draft lesson shows helper and no submit button", () => {
    const ui = getCatalogueApprovalUi({ isPublished: false, teacherLibraryStatus: "none" });
    expect(ui.showSubmit).toBe(false);
    expect(ui.showDraftHelper).toBe(true);
    expect(ui.description).toMatch(/Publish this lesson/);
  });

  test("pending lesson shows pending copy without submit", () => {
    const ui = getCatalogueApprovalUi({ isPublished: true, teacherLibraryStatus: "pending_review" });
    expect(ui.status).toBe("pending_review");
    expect(ui.headline).toBe("Pending review");
    expect(ui.description).toMatch(/Waiting for LetsRevise quality review/);
    expect(ui.showSubmit).toBe(false);
    expect(ui.showResubmit).toBe(false);
  });

  test("approved lesson exposes version, date, and certification copy", () => {
    const ui = getCatalogueApprovalUi({
      isPublished: true,
      teacherLibraryStatus: "approved",
      catalogueVersion: 2,
      approvedAt: "2026-07-01T12:00:00.000Z",
    });
    expect(ui.status).toBe("approved");
    expect(ui.showCertifiedBadge).toBe(true);
    expect(ui.version).toBe(2);
    expect(ui.approvedDateLabel).toBeTruthy();
    expect(ui.description).toMatch(/LetsRevise Approved Library/);
    expect(ui.showSubmit).toBe(false);
  });

  test("rejected published lesson allows resubmit", () => {
    const ui = getCatalogueApprovalUi({
      isPublished: true,
      teacherLibraryStatus: "rejected",
      rejectionNotes: "Add diagrams",
    });
    expect(ui.showResubmit).toBe(true);
    expect(ui.submitButtonLabel).toBe("Resubmit to LetsRevise");
    expect(ui.rejectionNotes).toBe("Add diagrams");
    expect(ui.headline).toBe("Changes requested");
  });

  test("normalizeCatalogueApprovalStatus defaults unknown to none", () => {
    expect(normalizeCatalogueApprovalStatus(undefined)).toBe("none");
    expect(normalizeCatalogueApprovalStatus("approved")).toBe("approved");
  });

  test("formatCatalogueApprovalDate returns long date label", () => {
    const label = formatCatalogueApprovalDate("2026-07-01T12:00:00.000Z");
    expect(label).toMatch(/2026/);
    expect(label).toMatch(/July|Jul/);
  });
});
