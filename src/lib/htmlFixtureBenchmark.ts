import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractionFromPlainText, verifyLabel } from "./rules";
import type { ApplicationData, VerificationDecision } from "./types";

export type HtmlGeneratedFixture = {
  schemaVersion: number;
  id: string;
  title: string;
  kind: string;
  variant: string;
  expectedDecision: VerificationDecision;
  expectedProblemChecks: string[];
  extractionConfidence: number;
  application: ApplicationData;
  labelVisibleText: string;
  visualObservation: string;
  artifacts: {
    svg: string;
    html: string;
  };
  contentHash: string;
};

export type HtmlFixtureBenchmarkResult = {
  id: string;
  title: string;
  kind: string;
  variant: string;
  expectedDecision: VerificationDecision;
  actualDecision: VerificationDecision;
  matched: boolean;
  score: number;
  problemChecks: string[];
  missingExpectedProblemChecks: string[];
};

export type HtmlFixtureBenchmarkReport = {
  total: number;
  matched: number;
  results: HtmlFixtureBenchmarkResult[];
  gaps: HtmlFixtureBenchmarkResult[];
};

export const htmlGeneratedFixtureDir = join(process.cwd(), "public/evals/fixtures/spirits-rendered-regression");

export function loadHtmlGeneratedFixtures(dir = htmlGeneratedFixtureDir): HtmlGeneratedFixture[] {
  return JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as HtmlGeneratedFixture[];
}

export function benchmarkHtmlGeneratedFixture(fixture: HtmlGeneratedFixture): HtmlFixtureBenchmarkResult {
  const benchmarkText = [fixture.labelVisibleText, fixture.visualObservation].filter(Boolean).join("\n");
  const extraction = {
    ...extractionFromPlainText(benchmarkText),
    confidence: fixture.extractionConfidence,
  };
  const result = verifyLabel(fixture.application, extraction, fixture.artifacts.svg);
  const problemChecks: string[] = [];
  for (const check of result.checks) {
    if (check.status !== "pass") problemChecks.push(check.id);
  }
  const missingExpectedProblemChecks = fixture.expectedProblemChecks.filter((checkId) => !problemChecks.includes(checkId));

  return {
    id: fixture.id,
    title: fixture.title,
    kind: fixture.kind,
    variant: fixture.variant,
    expectedDecision: fixture.expectedDecision,
    actualDecision: result.decision,
    matched: result.decision === fixture.expectedDecision && missingExpectedProblemChecks.length === 0,
    score: result.score,
    problemChecks,
    missingExpectedProblemChecks,
  };
}

export function benchmarkHtmlGeneratedFixtures(fixtures: HtmlGeneratedFixture[]): HtmlFixtureBenchmarkReport {
  const results = fixtures.map(benchmarkHtmlGeneratedFixture);
  const gaps = results.filter((result) => !result.matched);
  return {
    total: results.length,
    matched: results.length - gaps.length,
    results,
    gaps,
  };
}
