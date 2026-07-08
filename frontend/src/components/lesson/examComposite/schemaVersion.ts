import { CompositeSchemaVersion } from "./types";

/** Legacy composite questions omit schemaVersion — treat as V1. */
export function resolveCompositeSchemaVersion(
  question: { schemaVersion?: number } | null | undefined
): CompositeSchemaVersion {
  const raw = question?.schemaVersion;
  if (raw === CompositeSchemaVersion.V2) return CompositeSchemaVersion.V2;
  return CompositeSchemaVersion.V1;
}
