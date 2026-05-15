import { describe, expect, it } from "vitest";
import { coreReviewRows, reviewRows, supplementalReviewRows } from "./reviewRows";
import type { VerificationCheck, VerificationResult } from "./types";

const requirementRef = {
  id: "test-requirement",
  label: "Test requirement",
  source: "Fixture",
  url: "https://example.com",
};

function check(overrides: Partial<VerificationCheck> & Pick<VerificationCheck, "id" | "label">): VerificationCheck {
  return {
    status: "pass",
    severity: "blocking",
    requirementRef,
    expected: `${overrides.label} expected`,
    observed: `${overrides.label} observed`,
    rationale: `${overrides.label} rationale`,
    ...overrides,
  };
}

function fixtureResult(checks: VerificationCheck[]): VerificationResult {
  return {
    fileName: "fixture.jpg",
    decision: "needs_review",
    score: 80,
    elapsedMs: 12,
    extraction: {
      labelText: "Full label text",
      brandName: "Observed Brand From Extraction",
      classType: "Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol.",
      netContents: "750 mL",
      governmentWarning: "GOVERNMENT WARNING: visible text",
      bottlerAddress: "Fixture Distilling, Louisville, KY",
      countryOfOrigin: "Mexico",
      confidence: 0.9,
      notes: [],
    },
    checks,
    summary: "Fixture summary",
    missingApplicationFacts: [],
    nextSteps: [],
    workflow: {
      comparisonSummary: "Fixture comparison",
      missingApplicationFacts: [],
      nextSteps: [],
    },
  };
}

describe("reviewRows", () => {
  it("orders reviewer comparison rows and appends remaining checks", () => {
    const result = fixtureResult([
      check({ id: "image-quality", label: "Image quality", severity: "info" }),
      check({ id: "government-warning", label: "Government warning" }),
      check({ id: "brand-name", label: "Brand name" }),
      check({ id: "class-type", label: "Class / type designation" }),
      check({ id: "country-origin", label: "Country of origin", severity: "review" }),
      check({ id: "net-contents", label: "Net contents" }),
      check({ id: "bottler-address", label: "Bottler / producer / importer address", severity: "review" }),
      check({ id: "alcohol-content", label: "Alcohol content" }),
    ]);
    const rows = reviewRows(result);

    expect(rows.map((row) => row.id)).toEqual([
      "brand-name",
      "class-type",
      "alcohol-content",
      "net-contents",
      "bottler-address",
      "country-origin",
      "government-warning",
      "image-quality",
    ]);
    expect(coreReviewRows(result).map((row) => row.id)).toEqual([
      "brand-name",
      "class-type",
      "alcohol-content",
      "net-contents",
      "bottler-address",
      "country-origin",
      "government-warning",
    ]);
    expect(supplementalReviewRows(result).map((row) => row.id)).toEqual(["image-quality"]);
  });

  it("prefers check values and falls back to extraction fields for observed values", () => {
    const rows = reviewRows(
      fixtureResult([
        check({
          id: "brand-name",
          label: "Brand name",
          expected: "Expected Brand",
          observed: undefined,
          status: "needs_review",
          rationale: "Brand needs review",
          guidance: "Inspect the brand panel.",
        }),
        check({
          id: "net-contents",
          label: "Net contents",
          expected: "750 mL",
          observed: "1 L",
        }),
      ]),
    );

    expect(rows[0]).toEqual({
      id: "brand-name",
      label: "Brand name",
      expected: "Expected Brand",
      observed: "Observed Brand From Extraction",
      status: "needs_review",
      severity: "blocking",
      rationale: "Brand needs review",
      guidance: "Inspect the brand panel.",
    });
    expect(rows[1]).toMatchObject({
      id: "net-contents",
      expected: "750 mL",
      observed: "1 L",
    });
  });
});
