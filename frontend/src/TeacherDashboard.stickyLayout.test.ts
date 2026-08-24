/**
 * Guards Teacher Dashboard sticky rail CSS against regressing to static sidebars on desktop.
 * Pairs with index.css stack breakpoint at max-width: 900px.
 */
import fs from "fs";
import path from "path";

const INDEX_CSS = path.join(__dirname, "index.css");

function teacherDashboardStickyOnBlock(css: string): string | null {
  const re =
    /@media\s*\(\s*min-width:\s*(\d+)px\s*\)\s*\{([\s\S]*?\.teacher-dashboard-left[\s\S]*?position:\s*sticky[\s\S]*?)\n\}/;
  const m = css.match(re);
  return m ? m[0] : null;
}

function teacherDashboardStickyOffBlock(css: string): string | null {
  const re =
    /@media\s*\(\s*max-width:\s*900px\s*\)\s*\{([\s\S]*?\.teacher-dashboard-left[\s\S]*?position:\s*static[\s\S]*?)\n\}/;
  const m = css.match(re);
  return m ? m[0] : null;
}

describe("TeacherDashboard sticky sidebar breakpoints (index.css)", () => {
  const css = fs.readFileSync(INDEX_CSS, "utf8");

  it("enables sticky on dashboard sidebars from min-width: 901px (pairs with 900px stack)", () => {
    const block = teacherDashboardStickyOnBlock(css);
    expect(block).toBeTruthy();
    expect(block!).toMatch(/@media\s*\(\s*min-width:\s*901px\s*\)/);
    expect(block!).toMatch(/\.teacher-dashboard-left/);
    expect(block!).toMatch(/\.teacher-dashboard-right/);
    expect(block!).toMatch(/position:\s*sticky/);
    expect(block!).toMatch(/var\(--lesson-view-rail-sticky-top\)/);
    expect(block!).toMatch(/max-height:\s*calc\(100vh - var\(--lesson-view-rail-sticky-top\)/);
  });

  it("forces static on dashboard sidebars at max-width: 900px", () => {
    const block = teacherDashboardStickyOffBlock(css);
    expect(block).toBeTruthy();
    expect(block!).toMatch(/\.teacher-dashboard-left/);
    expect(block!).toMatch(/\.teacher-dashboard-right/);
    expect(block!).toMatch(/position:\s*static/);
  });
});
