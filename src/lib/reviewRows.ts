import type { CheckSeverity, CheckStatus, LabelExtraction, VerificationCheck, VerificationResult } from "./types";

export type ReviewRow = {
  id: string;
  label: string;
  expected: string;
  observed: string;
  status: CheckStatus;
  severity: CheckSeverity;
  rationale: string;
  guidance?: string;
};

const PRIMARY_CHECK_IDS = [
  "target-isolation",
  "brand-name",
  "class-type",
  "alcohol-content",
  "alcohol-content-profile",
  "net-contents",
  "bottler-address",
  "country-origin",
  "government-warning",
] as const;

const OBSERVED_FALLBACKS: Partial<Record<string, keyof LabelExtraction>> = {
  "brand-name": "brandName",
  "class-type": "classType",
  "alcohol-content": "alcoholContent",
  "alcohol-content-profile": "alcoholContent",
  "net-contents": "netContents",
  "bottler-address": "bottlerAddress",
  "country-origin": "countryOfOrigin",
  "government-warning": "governmentWarning",
};

function fallbackObserved(check: VerificationCheck, extraction: LabelExtraction): string {
  const field = OBSERVED_FALLBACKS[check.id];
  return field ? String(extraction[field] ?? "") : "";
}

function toReviewRow(check: VerificationCheck, extraction: LabelExtraction): ReviewRow {
  return {
    id: check.id,
    label: check.label,
    expected: check.expected ?? "",
    observed: check.observed ?? fallbackObserved(check, extraction),
    status: check.status,
    severity: check.severity,
    rationale: check.rationale,
    guidance: check.guidance,
  };
}

export function reviewRows(result: VerificationResult): ReviewRow[] {
  return [...coreReviewRows(result), ...supplementalReviewRows(result)];
}

export function coreReviewRows(result: VerificationResult): ReviewRow[] {
  const checksById = new Map(result.checks.map((check) => [check.id, check]));
  return PRIMARY_CHECK_IDS.flatMap((id) => {
    const check = checksById.get(id);
    return check ? [toReviewRow(check, result.extraction)] : [];
  });
}

export function supplementalReviewRows(result: VerificationResult): ReviewRow[] {
  const primaryIds = new Set(PRIMARY_CHECK_IDS);
  return result.checks
    .filter((check) => !primaryIds.has(check.id as (typeof PRIMARY_CHECK_IDS)[number]))
    .map((check) => toReviewRow(check, result.extraction));
}
