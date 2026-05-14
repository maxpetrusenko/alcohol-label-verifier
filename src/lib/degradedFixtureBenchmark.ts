import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applicationFromFsyedFixture, type FsyedGeneratedFixtureJson } from "./fixtureCases";
import { labelTextFromImagePrompt } from "./generatedFixtureEval";
import { extractionFromPlainText, verifyLabel } from "./rules";
import type { VerificationDecision } from "./types";

export type DegradedFixture = {
  schemaVersion: number;
  id: string;
  sourceId: string;
  title: string;
  photoQuality: "good" | "bad";
  variant: string;
  degradationFamily: string;
  severityLevel: number;
  orientation: string;
  angleDegrees: number;
  image: string;
  imageHash: string;
  form_data: FsyedGeneratedFixtureJson;
  image_prompt: string;
  expectedSourceBehavior: string;
  expectedDecision: VerificationDecision;
  expectedProblemChecks: string[];
  extractionConfidence: number;
  visualObservation: string;
};

export type DegradedFixtureBenchmarkResult = {
  id: string;
  sourceId: string;
  variant: string;
  severityLevel: number;
  orientation: string;
  angleDegrees: number;
  image: string;
  expectedDecision: VerificationDecision;
  actualDecision: VerificationDecision;
  matched: boolean;
  problemChecks: string[];
  missingExpectedProblemChecks: string[];
};

export type DegradedFixtureBenchmarkReport = {
  total: number;
  matched: number;
  byVariant: Record<string, { total: number; matched: number }>;
  sampleFailures: DegradedFixtureBenchmarkResult[];
  sampleReviewPhotos: DegradedFixtureBenchmarkResult[];
  results: DegradedFixtureBenchmarkResult[];
  gaps: DegradedFixtureBenchmarkResult[];
};

export const degradedFixtureDir = join(process.cwd(), "public/evals/fixtures/degraded-generated");

export function loadDegradedFixtures(dir = degradedFixtureDir): DegradedFixture[] {
  return JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as DegradedFixture[];
}

export function benchmarkDegradedFixture(fixture: DegradedFixture): DegradedFixtureBenchmarkResult {
  const labelText = [labelTextFromImagePrompt(fixture.image_prompt), fixture.visualObservation].filter(Boolean).join("\n");
  const extraction = {
    ...extractionFromPlainText(labelText),
    confidence: fixture.extractionConfidence,
    notes: [fixture.visualObservation],
  };
  const result = verifyLabel(applicationFromFsyedFixture(fixture.form_data), extraction, fixture.image);
  const problemChecks = result.checks.filter((check) => check.status !== "pass").map((check) => check.id);
  const missingExpectedProblemChecks = fixture.expectedProblemChecks.filter((checkId) => !problemChecks.includes(checkId));

  return {
    id: fixture.id,
    sourceId: fixture.sourceId,
    variant: fixture.variant,
    severityLevel: fixture.severityLevel,
    orientation: fixture.orientation,
    angleDegrees: fixture.angleDegrees,
    image: fixture.image,
    expectedDecision: fixture.expectedDecision,
    actualDecision: result.decision,
    matched: result.decision === fixture.expectedDecision && missingExpectedProblemChecks.length === 0,
    problemChecks,
    missingExpectedProblemChecks,
  };
}

export function benchmarkDegradedFixtures(fixtures: DegradedFixture[]): DegradedFixtureBenchmarkReport {
  const results = fixtures.map(benchmarkDegradedFixture);
  const gaps = results.filter((result) => !result.matched);
  const byVariant: DegradedFixtureBenchmarkReport["byVariant"] = {};

  for (const result of results) {
    byVariant[result.variant] ??= { total: 0, matched: 0 };
    byVariant[result.variant].total += 1;
    if (result.matched) byVariant[result.variant].matched += 1;
  }

  return {
    total: results.length,
    matched: results.length - gaps.length,
    byVariant,
    sampleFailures: gaps.slice(0, 10),
    sampleReviewPhotos: results.filter((result) => result.actualDecision === "needs_review").slice(0, 10),
    results,
    gaps,
  };
}
