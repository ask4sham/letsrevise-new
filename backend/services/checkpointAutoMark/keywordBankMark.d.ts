/**
 * Type definitions for keyword-bank auto-marking (short-answer / explain checkpoints).
 * Backend runtime is JavaScript; this file is for TS consumers (frontend, IDE).
 */

export type AutoMarkVerdict = "correct" | "partial" | "incorrect";

export interface CheckpointAutoMarkBank {
  /** Model answer line (used for substring / variant checks). */
  canonicalAnswer?: string;
  /** Must appear (substring / conservative word match). */
  requiredKeywords?: string[];
  /** Nice-to-have; improves feedback only. */
  optionalKeywords?: string[];
  /** If any phrase appears, answer is incorrect (conservative safety). */
  forbiddenMisconceptions?: string[];
  /** Full answer lines that count as correct when matched as substring. */
  acceptedVariants?: string[];
  /** Min fraction of required keywords for "partial" (0–1). Default 0.6 in service. */
  minMatchThreshold?: number;
}

export interface AutoMarkResult {
  verdict: AutoMarkVerdict;
  matchedRequired: string[];
  missingRequired: string[];
  matchedOptional: string[];
  misconceptionHits: string[];
  feedback: string;
  /** 0–1 share of required keywords matched */
  requiredRatio: number;
}

export function autoMarkShortAnswer(
  studentAnswer: string,
  bank: CheckpointAutoMarkBank
): AutoMarkResult;

export function normalizeForMatch(s: string): string;
export function normalizeBank(bank: CheckpointAutoMarkBank): Required<
  Pick<CheckpointAutoMarkBank, "minMatchThreshold">
> &
  CheckpointAutoMarkBank;
export function keywordMatched(studentRaw: string, phraseRaw: string): boolean;

export declare const DEFAULT_THRESHOLD: number;
