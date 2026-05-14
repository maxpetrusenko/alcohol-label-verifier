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

  it("keeps degraded photos out of clean approval", () => {
    const extraction = {
      ...extractionFromPlainText(`STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nBottled by Stone's Throw Distilling, Frankfort, KY\nProduct of United States\n${GOVERNMENT_WARNING_TEXT}`),
      notes: ["Image has glare across the warning panel."],
    };

    const result = verifyLabel(application, extraction, "glare-photo");

    expect(result.decision).toBe("needs_review");
    expect(result.checks.find((check) => check.id === "image-quality")?.status).toBe("needs_review");
  });

  it("adds needs-review guidance when label evidence is missing", () => {
    const result = verifyLabel(application, { labelText: "", confidence: 0, notes: [] }, "blank-label");
    const brand = result.checks.find((check) => check.id === "brand-name");
    const labelPresence = result.checks.find((check) => check.id === "label-presence");

    expect(result.decision).toBe("rejected");
    expect(result.score).toBeLessThan(25);
    expect(brand?.status).toBe("needs_review");
    expect(labelPresence?.status).toBe("needs_review");
    expect(brand?.guidance).toContain("clearer image");
    expect(result.nextSteps.some((step) => step.includes("Brand name"))).toBe(true);
  });

  it("does not pass typed application fields when the photo has no label", () => {
    const result = verifyLabel(
      application,
      {
        labelText: "",
        confidence: 0,
        notes: ["Photo shows a person in a room. No alcohol bottle or label is visible."],
      },
      "webcam-person",
    );

    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "label-presence")?.status).toBe("fail");
    expect(result.checks.find((check) => check.id === "class-type")?.status).toBe("needs_review");
    expect(result.checks.find((check) => check.id === "class-type")?.observed).toBe("");
  });

  it("rejects non-approved distilled spirits bottle sizes", () => {
    const extraction = extractionFromPlainText(`Crestview\nVodka\n40% Alc./Vol.\n800 mL\nProduced and bottled by Crestview Spirits, Denver, CO\n${GOVERNMENT_WARNING_TEXT}`);

    const result = verifyLabel(
      {
        brandName: "Crestview",
        classType: "Vodka",
        alcoholContent: "40% Alc./Vol.",
        netContents: "800 mL",
        bottlerAddress: "Crestview Spirits, Denver, CO",
        beverageKind: "spirits",
      },
      extraction,
      "non-standard-fill",
    );

    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "approved-bottle-size")?.status).toBe("fail");
  });

  it("rejects missing composition statements for liqueurs", () => {
    const extraction = extractionFromPlainText(`Fireglow\nCinnamon Liqueur\n33% Alc./Vol.\n750 mL\nProduced and bottled by Fireglow Spirits, Austin, TX\n${GOVERNMENT_WARNING_TEXT}`);
    const result = verifyLabel(
      {
        brandName: "Fireglow",
        classType: "Cinnamon Liqueur",
        alcoholContent: "33% Alc./Vol.",
        netContents: "750 mL",
        bottlerAddress: "Fireglow Spirits, Austin, TX",
        beverageKind: "spirits",
      },
      extraction,
      "missing-composition",
    );

    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "statement-of-composition")?.status).toBe("fail");
  });

  it("rejects straight whisky labels without state of distillation", () => {
    const extraction = extractionFromPlainText(`Oak & Iron\nStraight Bourbon Whiskey\n45% Alc./Vol.\n750 mL\nBottled by Oak & Iron Distillers, Brooklyn, NY\n${GOVERNMENT_WARNING_TEXT}`);
    const result = verifyLabel(
      {
        brandName: "Oak & Iron",
        classType: "Straight Bourbon Whiskey",
        alcoholContent: "45% Alc./Vol.",
        netContents: "750 mL",
        bottlerAddress: "Oak & Iron Distillers, Brooklyn, NY",
        beverageKind: "spirits",
      },
      extraction,
      "missing-state",
    );

    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "state-of-distillation")?.status).toBe("fail");
  });

  it("rejects fanciful class names used as class/type", () => {
    const extraction = extractionFromPlainText(`Golden Stallion\nPremium Reserve\n40% Alc./Vol.\n750 mL\nProduced and bottled by Stallion Spirits, Dallas, TX\n${GOVERNMENT_WARNING_TEXT}`);
    const result = verifyLabel(
      {
        brandName: "Golden Stallion",
        classType: "Premium Reserve",
        alcoholContent: "40% Alc./Vol.",
        netContents: "750 mL",
        bottlerAddress: "Stallion Spirits, Dallas, TX",
        beverageKind: "spirits",
      },
      extraction,
      "fanciful-class",
    );

    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "approved-class-type")?.status).toBe("fail");
  });

  it("rejects non-standard production statements", () => {
    const extraction = extractionFromPlainText(`Pine Valley\nGin\n43% Alc./Vol.\n750 mL\nCrafted by Pine Valley Co., Bend, OR\n${GOVERNMENT_WARNING_TEXT}`);
    const result = verifyLabel(
      {
        brandName: "Pine Valley",
        classType: "Gin",
        alcoholContent: "43% Alc./Vol.",
        netContents: "750 mL",
        bottlerAddress: "Pine Valley Co., Bend, OR",
        beverageKind: "spirits",
      },
      extraction,
      "bad-production",
    );

    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "production-statement")?.status).toBe("fail");
  });
});
