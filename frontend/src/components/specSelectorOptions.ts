import { SPEC_DISPLAY_LABELS, SpecKey } from "../api/taxonomy";
import { formatSpecOptionLabel } from "../utils/createLessonSpecSync";

/** All registered specs — shared by SpecSelector and bank pickers. */
export const ALL_SPEC_KEYS = Object.keys(SPEC_DISPLAY_LABELS) as SpecKey[];

export function getSpecSelectorOptions(): Array<{ value: SpecKey; label: string }> {
  return ALL_SPEC_KEYS.map((value) => ({
    value,
    label: formatSpecOptionLabel(value, SPEC_DISPLAY_LABELS[value]),
  }));
}
