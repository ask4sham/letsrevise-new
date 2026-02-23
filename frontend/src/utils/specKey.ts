import type { SpecKey } from "../api/taxonomy";

const LS_KEY = "lr:specKey";

export function getStoredSpecKey(): SpecKey {
  const v = localStorage.getItem(LS_KEY);
  if (v === "aqa-gcse-chemistry") return "aqa-gcse-chemistry";
  return "aqa-gcse-biology";
}

export function setStoredSpecKey(v: SpecKey): void {
  localStorage.setItem(LS_KEY, v);
}
