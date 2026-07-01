import type { SpecKey } from "../api/taxonomy";
import { SPEC_DISPLAY_LABELS } from "../api/taxonomy";

const LS_KEY = "lr:specKey";

const VALID_SPEC_KEYS = Object.keys(SPEC_DISPLAY_LABELS) as SpecKey[];

export function getStoredSpecKey(): SpecKey {
  const v = localStorage.getItem(LS_KEY);
  if (v && VALID_SPEC_KEYS.includes(v as SpecKey)) return v as SpecKey;
  return "aqa-gcse-biology";
}

export function setStoredSpecKey(v: SpecKey): void {
  localStorage.setItem(LS_KEY, v);
}
