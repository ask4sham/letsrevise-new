/**
 * Page-level `hero` images are legacy: they render above blocks and cannot be reordered.
 * Promote curated/static hero images into a normal `diagram` block (role: visual) so teachers
 * get move up/down, delete, and consistent student ordering.
 */

const EMPTY_HERO = { type: "none", src: "", caption: "" };

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function pageAlreadyHasHeroDiagram(blocks, heroSrc) {
  const src = safeStr(heroSrc);
  if (!src) return false;
  return blocks.some((b) => {
    if (!b || b.type !== "diagram") return false;
    const imageUrl = safeStr(b.imageUrl);
    if (imageUrl && imageUrl === src) return true;
    return false;
  });
}

/**
 * @param {object} page
 * @returns {object} page (new object if mutated)
 */
function promotePageHeroToBlock(page) {
  if (!page || typeof page !== "object") return page;

  const hero = page.hero;
  const heroType = safeStr(hero?.type).toLowerCase();
  const heroSrc = safeStr(hero?.src);

  if (!hero || heroType === "none" || !heroSrc) return page;

  // Videos/animations stay on legacy hero (diagram blocks are image-first).
  if (heroType !== "image") return page;

  const blocks = Array.isArray(page.blocks) ? [...page.blocks] : [];

  if (pageAlreadyHasHeroDiagram(blocks, heroSrc)) {
    return { ...page, hero: EMPTY_HERO };
  }

  const caption = safeStr(hero.caption);
  const diagramBlock = {
    type: "diagram",
    role: "visual",
    content: "",
    imageUrl: heroSrc,
    caption,
    diagramVariant: "featured",
    mode: "static",
    annotations: [],
    steps: [],
  };

  blocks.unshift(diagramBlock);

  return {
    ...page,
    hero: EMPTY_HERO,
    blocks,
  };
}

/**
 * @param {object} lesson - plain object or mongoose doc `.toObject()` shape
 * @returns {object}
 */
function promoteHeroOnLesson(lesson) {
  if (!lesson || !Array.isArray(lesson.pages)) return lesson;
  return {
    ...lesson,
    pages: lesson.pages.map((p) => promotePageHeroToBlock(p)),
  };
}

module.exports = {
  promotePageHeroToBlock,
  promoteHeroOnLesson,
  EMPTY_HERO,
};
