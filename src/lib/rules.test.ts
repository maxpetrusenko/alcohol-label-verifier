import { describe, expect, it } from "vitest";
import { extractionFromPlainText, GOVERNMENT_WARNING_TEXT, normalizeForMatch, verifyLabel } from "./rules";
import type { ApplicationData } from "./types";

const application: ApplicationData = {
  brandName: "Stone's Throw",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  bottlerAddress: "Bottled by Stone's Throw Distilling, Frankfort, KY",
  countryOfOrigin: "United States",
  beverageKind: "spirits",
};

describe("label verification rules", () => {
  it("normalizes case and apostrophes for brand matching", () => {
    expect(normalizeForMatch("STONE'S THROW")).toBe(normalizeForMatch("Stone’s Throw"));
  });

  it("approves matching core fields and exact warning", () => {
    const extraction = extractionFromPlainText(`STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nBottled by Stone's Throw Distilling, Frankfort, KY\nProduct of United States\n${GOVERNMENT_WARNING_TEXT}`);
    const result = verifyLabel(application, extraction, "test-label");
    expect(result.decision).toBe("approved");
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
    expect(result.checks.every((check) => check.requirementRef && check.severity)).toBe(true);
    expect(result.workflow.comparisonSummary).toContain("7 of 7");
    expect(result.nextSteps).toEqual(["No deterministic blockers found. Agent may approve if artwork and source record context look complete."]);
  });

  it("rejects an ABV mismatch", () => {
    const extraction = extractionFromPlainText(`STONE'S THROW\nKentucky Straight Bourbon Whiskey\n40% Alc./Vol. (80 Proof)\n750 mL\n${GOVERNMENT_WARNING_TEXT}`);
    const result = verifyLabel(application, extraction, "bad-abv");
    expect(result.decision).toBe("rejected");
    const alcohol = result.checks.find((check) => check.id === "alcohol-content");
    expect(alcohol?.status).toBe("fail");
    expect(alcohol?.guidance).toContain("corrected label");
    expect(result.nextSteps[0]).toContain("Resolve blocking mismatch");
  });

  it("flags non-exact warning text for review or rejection", () => {
    const extraction = extractionFromPlainText("STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nGovernment Warning: drink responsibly");
    const result = verifyLabel(application, extraction, "bad-warning");
    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "government-warning")?.status).toBe("fail");
  });

  it("identifies missing application facts before pretending the review is complete", () => {
    const incompleteApplication: ApplicationData = {
      brandName: "Stone's Throw",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      beverageKind: "spirits",
    };
    const extraction = extractionFromPlainText(`STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\n${GOVERNMENT_WARNING_TEXT}`);

    const result = verifyLabel(incompleteApplication, extraction, "missing-source-facts");

    expect(result.decision).toBe("needs_review");
    expect(result.missingApplicationFacts.map((fact) => fact.field)).toContain("bottlerAddress");
    expect(result.nextSteps.some((step) => step.includes("Bottler / producer address"))).toBe(true);
  });

  it("keeps low-confidence extraction out of clean approval", () => {
    const extraction = {
      ...extractionFromPlainText(`STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nBottled by Stone's Throw Distilling, Frankfort, KY\nProduct of United States\n${GOVERNMENT_WARNING_TEXT}`),
      confidence: 0.41,
    };

    const result = verifyLabel(application, extraction, "low-confidence");

    expect(result.decision).toBe("needs_review");
    expect(result.checks.find((check) => check.id === "extraction-confidence")?.status).toBe("needs_review");
  });

  it("adds needs-review guidance when label evidence is missing", () => {
    const result = verifyLabel(application, { labelText: "", confidence: 0.8, notes: [] }, "blank-label");
    const brand = result.checks.find((check) => check.id === "brand-name");

    expect(result.decision).toBe("rejected");
    expect(result.score).toBe(0);
    expect(brand?.status).toBe("needs_review");
    expect(brand?.guidance).toContain("clearer image");
    expect(result.nextSteps.some((step) => step.includes("Brand name"))).toBe(true);
  });
});
