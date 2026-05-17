import type { LabelExtraction } from "./types";

export function buildExtractionGuidance(extraction: LabelExtraction) {
  const found = [
    extraction.brandName && "brand",
    extraction.classType && "class/type",
    extraction.alcoholContent && "ABV/proof",
    extraction.netContents && "net contents",
    extraction.governmentWarning && "government warning",
  ].filter(Boolean);

  const missing = [
    !extraction.brandName && "brand",
    !extraction.classType && "class/type",
    !extraction.alcoholContent && "ABV/proof",
    !extraction.netContents && "net contents",
    !extraction.governmentWarning && "government warning",
  ].filter(Boolean);

  return {
    title: missing.length ? "Photo read, but more evidence is needed" : "Photo read and ready to compare",
    found,
    missing,
    nextSteps: [
      "Confirm or import the COLA application facts for the same SKU.",
      missing.length ? `Retake or add another panel if these fields are on the package: ${missing.join(", ")}.` : "Run comparison against the application record.",
      "Use the rule results as a review aid; the human reviewer keeps final disposition.",
    ],
  };
}
