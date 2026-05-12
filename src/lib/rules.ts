import type {
  ApplicationData,
  CheckStatus,
  LabelExtraction,
  VerificationCheck,
  VerificationDecision,
  VerificationResult,
} from "./types";

export const GOVERNMENT_WARNING_TEXT =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

export function normalizeForMatch(value: string | undefined | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9.%/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function similarity(a: string | undefined, b: string | undefined): number {
  const left = normalizeForMatch(a);
  const right = normalizeForMatch(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.92;

  const aTokens = new Set(left.split(" ").filter(Boolean));
  const bTokens = new Set(right.split(" ").filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return intersection / union;
}

export function extractAlcoholNumbers(value: string | undefined): { abv?: number; proof?: number } {
  const text = value ?? "";
  const abvMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:alc\.?\s*\/\s*vol\.?|abv|alcohol\s+by\s+volume)?/i);
  const proofMatch = text.match(/(\d+(?:\.\d+)?)\s*proof/i);
  return {
    abv: abvMatch ? Number(abvMatch[1]) : undefined,
    proof: proofMatch ? Number(proofMatch[1]) : undefined,
  };
}

export function formatStatus(status: CheckStatus): string {
  return status.replace("_", " ");
}

function fuzzyCheck(
  id: string,
  label: string,
  expected: string | undefined,
  observed: string | undefined,
  passAt = 0.86,
  warnAt = 0.62,
): VerificationCheck {
  const score = similarity(expected, observed);
  let status: CheckStatus = "fail";
  if (score >= passAt) status = "pass";
  else if (score >= warnAt) status = "warning";
  else if (!observed) status = "needs_review";

  return {
    id,
    label,
    status,
    expected,
    observed,
    rationale:
      status === "pass"
        ? "Matches after compliance-style normalization for case, punctuation, and apostrophes."
        : status === "warning"
          ? "Close but not exact. Agent should review before accepting."
          : status === "needs_review"
            ? "The field was not confidently extracted from the label."
            : "Expected application value was not found on the label.",
  };
}

function alcoholCheck(expected: string, observed: string | undefined): VerificationCheck {
  const exp = extractAlcoholNumbers(expected);
  const obs = extractAlcoholNumbers(observed);
  const abvDelta = exp.abv !== undefined && obs.abv !== undefined ? Math.abs(exp.abv - obs.abv) : undefined;
  const proofDelta = exp.proof !== undefined && obs.proof !== undefined ? Math.abs(exp.proof - obs.proof) : undefined;
  const numericPass = (abvDelta !== undefined && abvDelta <= 0.05) || (proofDelta !== undefined && proofDelta <= 0.1);
  const textScore = similarity(expected, observed);
  const status: CheckStatus = numericPass || textScore >= 0.86 ? "pass" : observed ? "fail" : "needs_review";

  return {
    id: "alcohol-content",
    label: "Alcohol content / proof",
    status,
    expected,
    observed,
    rationale:
      status === "pass"
        ? "The ABV/proof number on the label matches the application."
        : status === "needs_review"
          ? "No ABV/proof value was confidently extracted."
          : "The label alcohol value does not match the application value.",
  };
}

function warningCheck(extraction: LabelExtraction): VerificationCheck {
  const observed = extraction.governmentWarning || extraction.labelText;
  const exact = observed.includes(GOVERNMENT_WARNING_TEXT);
  const normalizedExact = normalizeForMatch(observed).includes(normalizeForMatch(GOVERNMENT_WARNING_TEXT));
  const hasAllCapsPrefix = /GOVERNMENT\s+WARNING\s*:/u.test(observed);
  const hasCoreClauses = /pregnancy/i.test(observed) && /drive a car|operate machinery/i.test(observed) && /health problems/i.test(observed);

  let status: CheckStatus = "fail";
  let rationale = "The mandatory health warning text is missing or materially incomplete.";
  if (exact && hasAllCapsPrefix) {
    status = "pass";
    rationale = "Mandatory warning appears with exact standard text and all-caps prefix.";
  } else if (normalizedExact && hasAllCapsPrefix) {
    status = "warning";
    rationale = "Warning text appears semantically exact after normalization, but formatting/exactness needs human review.";
  } else if (hasCoreClauses && hasAllCapsPrefix) {
    status = "needs_review";
    rationale = "Core warning clauses are present, but the wording may not be exact.";
  }

  return {
    id: "government-warning",
    label: "Government health warning",
    status,
    expected: GOVERNMENT_WARNING_TEXT,
    observed: extraction.governmentWarning,
    rationale,
  };
}

export function verifyLabel(application: ApplicationData, extraction: LabelExtraction, fileName = "label"): VerificationResult {
  const started = Date.now();
  const checks: VerificationCheck[] = [
    fuzzyCheck("brand-name", "Brand name", application.brandName, extraction.brandName || extraction.labelText),
    fuzzyCheck("class-type", "Class / type designation", application.classType, extraction.classType || extraction.labelText, 0.72, 0.45),
    alcoholCheck(application.alcoholContent, extraction.alcoholContent || extraction.labelText),
    fuzzyCheck("net-contents", "Net contents", application.netContents, extraction.netContents || extraction.labelText, 0.74, 0.45),
    warningCheck(extraction),
  ];

  if (application.bottlerAddress) {
    checks.push(fuzzyCheck("bottler-address", "Bottler / producer address", application.bottlerAddress, extraction.bottlerAddress || extraction.labelText, 0.7, 0.45));
  }
  if (application.countryOfOrigin) {
    checks.push(fuzzyCheck("country-origin", "Country of origin", application.countryOfOrigin, extraction.countryOfOrigin || extraction.labelText, 0.78, 0.5));
  }

  const failCount = checks.filter((check) => check.status === "fail").length;
  const reviewCount = checks.filter((check) => check.status === "needs_review").length;
  const warningCount = checks.filter((check) => check.status === "warning").length;
  const passCount = checks.filter((check) => check.status === "pass").length;
  const score = Math.round((passCount / checks.length) * 100);
  const decision: VerificationDecision = failCount > 0 ? "rejected" : reviewCount + warningCount > 0 ? "needs_review" : "approved";

  return {
    fileName,
    decision,
    score,
    elapsedMs: Date.now() - started,
    extraction,
    checks,
    summary:
      decision === "approved"
        ? "All core label fields matched the application."
        : decision === "needs_review"
          ? "No hard mismatch was found, but one or more fields needs agent judgment."
          : "One or more required fields conflict with the application or mandatory warning requirements.",
  };
}

export function extractionFromPlainText(text: string): LabelExtraction {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const findLine = (patterns: RegExp[]) => lines.find((line) => patterns.some((pattern) => pattern.test(line)));
  const warningMatch = text.match(/GOVERNMENT\s+WARNING:[\s\S]+?(?:health problems\.|$)/i)?.[0];

  return {
    labelText: text,
    brandName: findLine([/^brand\s*name\s*:/i])?.replace(/^brand\s*name\s*:\s*/i, "") || lines[0],
    classType: findLine([/^class\s*\/\s*type\s*:/i, /bourbon|whiskey|vodka|rum|gin|wine|beer|lager|ale|tequila/i])?.replace(/^class\s*\/\s*type\s*:\s*/i, ""),
    alcoholContent: findLine([/%\s*(alc|abv)|proof/i]),
    netContents: findLine([/\b\d+\s*(ml|l|liter|litre|fl\.?\s*oz)\b/i]),
    governmentWarning: warningMatch,
    confidence: text.trim() ? 0.72 : 0,
    notes: text.trim() ? ["Parsed from supplied text/OCR paste without calling a vision model."] : ["No label text was supplied."],
  };
}
