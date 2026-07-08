import { CompositePartType } from "./types";

/** New interaction plugins ship disabled until their phase is verified. */
export const compositeFeatureFlags = {
  TABLE_PARTS_ENABLED: false,
  CALCULATION_PARTS_ENABLED: false,
  DATA_INTERPRETATION_PARTS_ENABLED: false,
  GRAPH_PARTS_ENABLED: false,
  LABEL_PARTS_ENABLED: false,
  MATCHING_PARTS_ENABLED: false,
  ORDERING_PARTS_ENABLED: false,
  EXTENDED_RESPONSE_PARTS_ENABLED: false,
} as const;

const FLAG_BY_PART_TYPE: Partial<
  Record<(typeof CompositePartType)[keyof typeof CompositePartType], keyof typeof compositeFeatureFlags>
> = {
  [CompositePartType.TABLE]: "TABLE_PARTS_ENABLED",
  [CompositePartType.CALCULATION]: "CALCULATION_PARTS_ENABLED",
  [CompositePartType.GRAPH]: "GRAPH_PARTS_ENABLED",
  [CompositePartType.LABEL]: "LABEL_PARTS_ENABLED",
  [CompositePartType.MATCHING]: "MATCHING_PARTS_ENABLED",
  [CompositePartType.ORDERING]: "ORDERING_PARTS_ENABLED",
  [CompositePartType.EXTENDED_RESPONSE]: "EXTENDED_RESPONSE_PARTS_ENABLED",
};

/** V1 types (mcq, short) are always enabled. */
export function isCompositePartTypeEnabled(partType: string): boolean {
  const normalized = partType.toLowerCase();
  if (normalized === CompositePartType.MCQ || normalized === CompositePartType.SHORT) {
    return true;
  }
  const flagKey = FLAG_BY_PART_TYPE[normalized as keyof typeof FLAG_BY_PART_TYPE];
  if (!flagKey) return false;
  return compositeFeatureFlags[flagKey];
}
