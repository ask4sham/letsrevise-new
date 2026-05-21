/**
 * Client-side mirror of backend promotePageHeroToBlock — ensures editor state
 * has movable diagram blocks even before the lesson is re-saved.
 */

export type LessonPageHeroLike = {
  type?: string;
  src?: string;
  caption?: string;
};

export type LessonPageLike = {
  hero?: LessonPageHeroLike;
  blocks?: Record<string, unknown>[];
  [key: string]: unknown;
};

const EMPTY_HERO: LessonPageHeroLike = { type: "none", src: "", caption: "" };

function safeStr(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

function pageAlreadyHasHeroDiagram(blocks: Record<string, unknown>[], heroSrc: string): boolean {
  const src = safeStr(heroSrc);
  if (!src) return false;
  return blocks.some((b) => {
    if (!b || String(b.type) !== "diagram") return false;
    return safeStr(b.imageUrl) === src;
  });
}

export function promotePageHeroToBlock<T extends LessonPageLike>(page: T): T {
  const hero = page.hero;
  const heroType = safeStr(hero?.type).toLowerCase();
  const heroSrc = safeStr(hero?.src);

  if (!hero || heroType === "none" || !heroSrc) return page;
  if (heroType !== "image") return page;

  const blocks = Array.isArray(page.blocks) ? [...page.blocks] : [];

  if (pageAlreadyHasHeroDiagram(blocks, heroSrc)) {
    return { ...page, hero: EMPTY_HERO };
  }

  const caption = safeStr(hero.caption);
  const diagramBlock: Record<string, unknown> = {
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

export function promoteHeroOnPages<T extends LessonPageLike>(pages: T[]): T[] {
  return pages.map((p) => promotePageHeroToBlock(p));
}
