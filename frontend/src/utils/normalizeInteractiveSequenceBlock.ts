/**
 * Editor/load normalization for interactiveSequence (step-by-step process) blocks.
 */

import { normalizeBlockType } from "../types/lessonBlocks";
import {
  cleanSequenceStepDescription,
  sequenceStepDescriptionNeedsCleaning,
} from "./cleanSequenceStepDescription";
import {
  buildSequenceStepsFromGeneratorScript,
  hydrateInteractiveSequenceStepsForEditor,
  interactiveSequenceStepsNeedHydration,
  type InteractiveSequenceStepEditorRow,
} from "./parseGeneratorVisualScript";

function cleanStepRowDescription(
  row: InteractiveSequenceStepEditorRow,
  index: number
): InteractiveSequenceStepEditorRow {
  const desc = String(row.description ?? "");
  if (!desc.trim()) return row;
  if (!sequenceStepDescriptionNeedsCleaning(desc)) return row;
  const cleaned = cleanSequenceStepDescription(desc, {
    stepTitle: row.title,
    stepIndex: index,
  });
  if (cleaned === desc) return row;
  return { ...row, description: cleaned };
}

export type { InteractiveSequenceStepEditorRow };

export function blockLooksLikeInteractiveSequence(block: Record<string, unknown>): boolean {
  const t = normalizeBlockType(String(block.type ?? ""));
  if (t === "interactiveSequence") return true;
  if (t !== "text") return false;
  const role = String(block.role ?? "").trim().toLowerCase();
  if (role === "sequence" || role === "process") return true;
  const intro = String(block.intro ?? "");
  const content = String(block.content ?? "");
  return buildSequenceStepsFromGeneratorScript(intro, content).length > 0;
}

function sanitizeStringArray(value: unknown, max = 30): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value
    .map((id) => String(id ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
  return ids.length ? ids : undefined;
}

function preserveInteractiveSequenceBlockFields(
  block: Record<string, unknown>,
  out: Record<string, unknown>
): void {
  const blockId = String(block.id ?? "").trim();
  if (blockId) out.id = blockId;

  const presentationMode = String(block.presentationMode ?? "").trim();
  if (presentationMode === "progressiveReveal") {
    out.presentationMode = "progressiveReveal";
  }

  if (block.enableTestMe === false) out.enableTestMe = false;
  else if (block.enableTestMe === true) out.enableTestMe = true;

  const sourceIds = sanitizeStringArray(block.sourceIds);
  if (sourceIds) out.sourceIds = sourceIds;
}

function mergePreservedStepFields(
  hydrated: InteractiveSequenceStepEditorRow[],
  rawSeq: unknown[]
): Array<InteractiveSequenceStepEditorRow & { sourceIds?: string[] }> {
  return hydrated.map((row, index) => {
    const prev = rawSeq[index];
    if (!prev || typeof prev !== "object") return row;
    const p = prev as Record<string, unknown>;
    const next: InteractiveSequenceStepEditorRow & { sourceIds?: string[] } = { ...row };
    const sid = String(p.id ?? "").trim();
    if (sid) next.id = sid;
    const stepSourceIds = sanitizeStringArray(p.sourceIds);
    if (stepSourceIds) next.sourceIds = stepSourceIds;
    return next;
  });
}

/** Normalize one block for the editor (type, steps[], legacy `steps` alias). */
export function normalizeInteractiveSequenceBlockForEditor(
  block: Record<string, unknown>
): Record<string, unknown> {
  const intro = String(block.intro ?? "");
  const content = String(block.content ?? "");
  const rawSeq = Array.isArray(block.sequenceSteps)
    ? block.sequenceSteps
    : Array.isArray(block.steps)
      ? block.steps
      : [];

  const hydrated = hydrateInteractiveSequenceStepsForEditor(intro, content, rawSeq).map(
    cleanStepRowDescription
  );
  const sequenceSteps = mergePreservedStepFields(hydrated, rawSeq);

  const out: Record<string, unknown> = {
    ...block,
    type: "interactiveSequence",
    intro,
    content,
    sequenceSteps,
  };
  preserveInteractiveSequenceBlockFields(block, out);
  const note = String(block.note ?? "").trim();
  if (note) out.note = note;
  else delete out.note;
  delete out.steps;
  return out;
}

/** Apply sequence hydration across all pages (returns new pages if anything changed). */
export function applyInteractiveSequenceHydrationToPages<T extends { blocks?: unknown[] }>(
  pages: T[]
): { pages: T[]; changed: boolean } {
  let changed = false;
  const nextPages = pages.map((page) => {
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    let pageChanged = false;
    const nextBlocks = blocks.map((raw) => {
      if (!raw || typeof raw !== "object") return raw;
      const b = raw as Record<string, unknown>;
      if (!blockLooksLikeInteractiveSequence(b)) return raw;

      const intro = String(b.intro ?? "");
      const content = String(b.content ?? "");
      const rawSeq = Array.isArray(b.sequenceSteps)
        ? b.sequenceSteps
        : Array.isArray(b.steps)
          ? b.steps
          : [];
      const needs = interactiveSequenceStepsNeedHydration(
        rawSeq.filter((s) => s && typeof s === "object") as Array<{
          title?: string;
          description?: string;
        }>
      );
      const hydrated = hydrateInteractiveSequenceStepsForEditor(intro, content, rawSeq);

      const typeFix = normalizeBlockType(String(b.type ?? "")) !== "interactiveSequence";
      const stepsFix = needs && hydrated.length > 0;
      const mergeDescFix =
        !needs &&
        hydrated.length > 0 &&
        hydrated.some((row, i) => {
          const prev = rawSeq[i] as { description?: string } | undefined;
          return !String(prev?.description ?? "").trim() && Boolean(row.description?.trim());
        });

      if (!typeFix && !stepsFix && !mergeDescFix) return raw;

      pageChanged = true;
      return normalizeInteractiveSequenceBlockForEditor({
        ...b,
        sequenceSteps: stepsFix || mergeDescFix ? hydrated : rawSeq,
      });
    });

    if (!pageChanged) return page;
    changed = true;
    return { ...page, blocks: nextBlocks };
  });

  return { pages: changed ? nextPages : pages, changed };
}
