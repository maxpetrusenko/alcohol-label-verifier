import { applicationFromFsyedFixture, type FsyedGeneratedFixtureJson } from "./applicationImport";
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

function expectedDecisionFromBehavior(expectedBehavior: string): VerificationDecision {
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

  const visualNotes: string[] = [];
  const notePattern = /\((Note:[^)]+)\)/giu;
  for (const match of prompt.matchAll(notePattern)) {
    if (match[1]) visualNotes.push(match[1].trim());
  }
  const tinyWarning = prompt.match(/ridiculously tiny[^:]+/iu)?.[0];
  if (tinyWarning) visualNotes.push(tinyWarning.trim());

  return [...quoted, ...visualNotes].join("\n");
}

export function evaluateGeneratedFixture(testCase: GeneratedFixtureEvalCase): GeneratedFixtureEvalResult {
  const labelText = labelTextFromImagePrompt(testCase.manifest.image_prompt);
  const extraction = extractionFromPlainText(labelText);
  const result = verifyLabel(applicationFromFsyedFixture(testCase.formData), extraction, `${testCase.id}.png`);
  const expectedDecision = expectedDecisionFromBehavior(testCase.manifest.expected_behavior);
  const failedChecks: string[] = [];
  const reviewChecks: string[] = [];
  const warningChecks: string[] = [];
  for (const check of result.checks) {
    if (check.status === "fail") failedChecks.push(check.id);
    if (check.status === "needs_review") reviewChecks.push(check.id);
    if (check.status === "warning") warningChecks.push(check.id);
  }

  return {
    id: testCase.id,
    category: testCase.manifest.category,
    description: testCase.manifest.description,
    expectedDecision,
    actualDecision: result.decision,
    matched: result.decision === expectedDecision,
    score: result.score,
    failedChecks,
    reviewChecks,
    warningChecks,
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
