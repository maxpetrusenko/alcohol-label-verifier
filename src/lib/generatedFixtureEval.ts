import { applicationFromFsyedFixture, type FsyedGeneratedFixtureJson } from "./fixtureCases";
import { extractionFromPlainText, verifyLabel } from "./rules";
import type { VerificationDecision } from "./types";

export type GeneratedManifestFixture = {
  id: string;
  category: number;
  description: string;
  form_data: FsyedGeneratedFixtureJson;
  image_prompt: string;
  expected_behavior: string;
};

export type GeneratedFixtureEvalCase = {
  id: string;
  manifest: GeneratedManifestFixture;
  formData: FsyedGeneratedFixtureJson;
};

export type GeneratedFixtureEvalResult = {
  id: string;
  category: number;
  description: string;
  expectedDecision: VerificationDecision;
  actualDecision: VerificationDecision;
  matched: boolean;
  score: number;
  failedChecks: string[];
  reviewChecks: string[];
  warningChecks: string[];
  labelText: string;
};

export type GeneratedFixtureEvalReport = {
  total: number;
  matched: number;
  gaps: GeneratedFixtureEvalResult[];
  results: GeneratedFixtureEvalResult[];
};

export function expectedDecisionFromBehavior(expectedBehavior: string): VerificationDecision {
  const normalized = expectedBehavior.toLowerCase();
  if (/\boverall\s+pass\b|\bpass\b/u.test(normalized) && !/\bfail\b/u.test(normalized)) return "approved";
  if (/\breview\b/u.test(normalized)) return "needs_review";
  return "rejected";
}

export function labelTextFromImagePrompt(prompt: string): string {
  const quoted: string[] = [];
  const quotedPattern = /'((?:\\'|[^'])*)'/gu;
  for (const match of prompt.matchAll(quotedPattern)) {
    const value = match[1]?.replace(/\\'/gu, "'").trim();
    if (value) quoted.push(value);
  }

  return quoted.join("\n");
}

export function evaluateGeneratedFixture(testCase: GeneratedFixtureEvalCase): GeneratedFixtureEvalResult {
  const labelText = labelTextFromImagePrompt(testCase.manifest.image_prompt);
  const extraction = extractionFromPlainText(labelText);
  const result = verifyLabel(applicationFromFsyedFixture(testCase.formData), extraction, `${testCase.id}.png`);
  const expectedDecision = expectedDecisionFromBehavior(testCase.manifest.expected_behavior);

  return {
    id: testCase.id,
    category: testCase.manifest.category,
    description: testCase.manifest.description,
    expectedDecision,
    actualDecision: result.decision,
    matched: result.decision === expectedDecision,
    score: result.score,
    failedChecks: result.checks.filter((check) => check.status === "fail").map((check) => check.id),
    reviewChecks: result.checks.filter((check) => check.status === "needs_review").map((check) => check.id),
    warningChecks: result.checks.filter((check) => check.status === "warning").map((check) => check.id),
    labelText,
  };
}

export function evaluateGeneratedFixtures(testCases: GeneratedFixtureEvalCase[]): GeneratedFixtureEvalReport {
  const results = testCases.map(evaluateGeneratedFixture);
  const gaps = results.filter((result) => !result.matched);

  return {
    total: results.length,
    matched: results.length - gaps.length,
    gaps,
    results,
  };
}
