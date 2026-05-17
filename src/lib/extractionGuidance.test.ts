import { describe, expect, it } from "vitest";
import { buildExtractionGuidance } from "./extractionGuidance";
import type { LabelExtraction } from "./types";

const completeExtraction: LabelExtraction = {
  labelText: "Silver Ridge Cellars Red Wine 13.5% Alc./Vol. 750 mL GOVERNMENT WARNING",
  brandName: "Silver Ridge Cellars",
  classType: "Red Wine",
  alcoholContent: "13.5% Alc./Vol.",
  netContents: "750 mL",
  governmentWarning: "GOVERNMENT WARNING: ...",
  confidence: 0.91,
  notes: [],
};

describe("buildExtractionGuidance", () => {
  it("marks a complete extraction ready for application comparison", () => {
    const guidance = buildExtractionGuidance(completeExtraction);

    expect(guidance.title).toBe("Photo read and ready to compare");
    expect(guidance.found).toEqual(["brand", "class/type", "ABV/proof", "net contents", "government warning"]);
    expect(guidance.missing).toEqual([]);
    expect(guidance.nextSteps).toContain("Run comparison against the application record.");
  });

  it("names missing fields and asks for another package panel", () => {
    const guidance = buildExtractionGuidance({
      ...completeExtraction,
      alcoholContent: undefined,
      netContents: undefined,
      governmentWarning: undefined,
    });

    expect(guidance.title).toBe("Photo read, but more evidence is needed");
    expect(guidance.found).toEqual(["brand", "class/type"]);
    expect(guidance.missing).toEqual(["ABV/proof", "net contents", "government warning"]);
    expect(guidance.nextSteps[1]).toBe(
      "Retake or add another panel if these fields are on the package: ABV/proof, net contents, government warning.",
    );
  });
});
