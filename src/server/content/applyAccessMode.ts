type AccessMode = "full" | "preview";

/**
 * IP protection layer:
 * - "full" returns everything
 * - "preview" returns a deliberately partial payload
 */
export function applyAccessMode<T extends Record<string, any>>(payload: T, mode: AccessMode): T {
  if (mode === "full") return payload;

  const clone: any = structuredClone(payload);

  // If payload uses slots, keep only the first few and strip bodies
  if (Array.isArray(clone.slots)) {
    clone.slots = clone.slots.slice(0, 3).map((s: any) => ({
      ...s,
      content: s?.content ? "[PREVIEW]" : s?.content,
      prompt: s?.prompt ? "[PREVIEW]" : s?.prompt,
    }));
  }

  // If payload uses blocks, keep only the first few and strip bodies
  if (Array.isArray(clone.blocks)) {
    clone.blocks = clone.blocks.slice(0, 3).map((b: any) => ({
      ...b,
      content: "[PREVIEW]",
    }));
  }

  // Strip assessment items in preview
  if (clone.assessment) {
    clone.assessment = { ...clone.assessment, items: [] };
  }

  clone.metadata = { ...(clone.metadata ?? {}), preview: true };

  return clone;
}
