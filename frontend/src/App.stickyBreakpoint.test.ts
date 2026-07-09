/**
 * Guards LessonViewPage sticky rail CSS against regressing to 900/899px.
 * Rails render from 768px (JS MOBILE_BREAKPOINT max-width 767px); sticky must match.
 */
import fs from "fs";
import path from "path";

const APP_CSS = path.join(__dirname, "App.css");

/** Extract the sticky ON media block scoped to lesson-view sidebars. */
function lessonViewStickyOnBlock(css: string): string | null {
  const re =
    /@media\s*\(\s*min-width:\s*(\d+)px\s*\)\s*\{([\s\S]*?\.lesson-view-three-col\s+\.lesson-left-sidebar[\s\S]*?position:\s*sticky[\s\S]*?)\n\}/;
  const m = css.match(re);
  return m ? m[0] : null;
}

/** Extract the sticky OFF (static) media block scoped to lesson-view sidebars. */
function lessonViewStickyOffBlock(css: string): string | null {
  const re =
    /@media\s*\(\s*max-width:\s*(\d+)px\s*\)\s*\{([\s\S]*?\.lesson-view-three-col\s+\.lesson-left-sidebar[\s\S]*?position:\s*static[\s\S]*?)\n\}/;
  const m = css.match(re);
  return m ? m[0] : null;
}

describe("LessonViewPage sticky sidebar breakpoints (App.css)", () => {
  const css = fs.readFileSync(APP_CSS, "utf8");

  it("enables sticky on lesson-view sidebars from min-width: 768px (not 900)", () => {
    const block = lessonViewStickyOnBlock(css);
    expect(block).toBeTruthy();
    expect(block!).toMatch(/@media\s*\(\s*min-width:\s*768px\s*\)/);
    expect(block!).toMatch(/\.lesson-view-three-col\s+\.lesson-left-sidebar/);
    expect(block!).toMatch(/\.lesson-view-three-col\s+\.lesson-right-sidebar/);
    expect(block!).toMatch(/position:\s*sticky/);
    // Must not reintroduce the old tablet gap (sticky only from 900px).
    expect(block!).not.toMatch(/@media\s*\(\s*min-width:\s*900px\s*\)/);
  });

  it("forces static on lesson-view sidebars at max-width: 767px (not 899)", () => {
    const block = lessonViewStickyOffBlock(css);
    expect(block).toBeTruthy();
    expect(block!).toMatch(/@media\s*\(\s*max-width:\s*767px\s*\)/);
    expect(block!).toMatch(/\.lesson-view-three-col\s+\.lesson-left-sidebar/);
    expect(block!).toMatch(/\.lesson-view-three-col\s+\.lesson-right-sidebar/);
    expect(block!).toMatch(/position:\s*static/);
    expect(block!).not.toMatch(/@media\s*\(\s*max-width:\s*899px\s*\)/);
  });
});
