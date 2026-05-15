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

  it("routes OCR punctuation uncertainty on the warning to review instead of rejection", () => {
    const warningWithDroppedPeriod = GOVERNMENT_WARNING_TEXT.replace("birth defects. (2)", "birth defects (2)");
    const extraction = extractionFromPlainText(`STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nBottled by Stone's Throw Distilling, Frankfort, KY\nProduct of United States\n${warningWithDroppedPeriod}`);
    const result = verifyLabel(application, extraction, "warning-punctuation-ocr");

    expect(result.decision).toBe("needs_review");
    expect(result.checks.find((check) => check.id === "government-warning")?.status).toBe("needs_review");
  });

  it("routes degraded-photo missing warning extraction to review when label facts are visible", () => {
    const extraction = {
      ...extractionFromPlainText(
        "STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nBottled by Stone's Throw Distilling, Frankfort, KY\nProduct of United States",
      ),
      confidence: 0.98,
      notes: ["Flash glare and blur across the lower warning panel make small mandatory text unreadable."],
    };
    const result = verifyLabel(application, extraction, "bad-review-flash-photo");

    expect(result.decision).toBe("needs_review");
    expect(result.checks.find((check) => check.id === "government-warning")?.status).toBe("needs_review");
  });

  it("does not clean-pass exact warning text from a multi-label scene", () => {
    const extraction = {
      ...extractionFromPlainText(
        `STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nBottled by Stone's Throw Distilling, Frankfort, KY\nProduct of United States\n${GOVERNMENT_WARNING_TEXT}`,
      ),
      confidence: 0.95,
      notes: ["Multiple visible bottles and overlapping labels make the source label ambiguous."],
    };
    const result = verifyLabel(application, extraction, "crowded-overlap-scene");

    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "target-isolation")).toMatchObject({
      status: "fail",
      guidance: expect.stringContaining("one product label per image"),
    });
    expect(result.checks.find((check) => check.id === "government-warning")?.status).toBe("needs_review");
  });

  it("passes exact warning text split across label line wraps", () => {
    const wrappedWarning = GOVERNMENT_WARNING_TEXT.replace("Surgeon General, women", "Surgeon\nGeneral, women").replace("defects. (2)", "defects.\n(2)");
    const extraction = extractionFromPlainText(`STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nBottled by Stone's Throw Distilling, Frankfort, KY\nProduct of United States\n${wrappedWarning}`);
    const result = verifyLabel(application, extraction, "warning-line-wrap");

    expect(result.decision).toBe("approved");
    expect(result.checks.find((check) => check.id === "government-warning")?.status).toBe("pass");
  });

  it("rejects placeholder warning-present text as missing statutory warning evidence", () => {
    const extraction = extractionFromPlainText("STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nGOVERNMENT WARNING PRESENT");
    const result = verifyLabel(application, extraction, "warning-placeholder");

    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "government-warning")?.status).toBe("fail");
  });

  it("routes visible but unreadable government warning evidence to review", () => {
    const extraction = {
      ...extractionFromPlainText(
        "STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nBottled by Stone's Throw Distilling, Frankfort, KY\nProduct of United States\nGOVERNMENT WARNING: According to the Surgeon General ... blurred lower panel",
      ),
      notes: ["Flash glare and blur cross the Government Warning panel, so exact wording cannot be verified."],
    };
    const result = verifyLabel(application, extraction, "warning-visible-unreadable");

    expect(result.decision).toBe("needs_review");
    expect(result.checks.find((check) => check.id === "government-warning")).toMatchObject({
      status: "needs_review",
      rationale: "Government Warning evidence is visible, but image quality or extraction confidence prevents exact word-for-word verification.",
    });
  });

  it("handles wine and malt alcohol-content exceptions without requiring a source ABV", () => {
    const extraction = extractionFromPlainText(`STONE'S THROW\nRed Wine\n750 mL\nBottled by Stone's Throw Cellars, Napa, CA\nProduct of United States\n${GOVERNMENT_WARNING_TEXT}`);
    const result = verifyLabel(
      {
        brandName: "Stone's Throw",
        classType: "Red Wine",
        netContents: "750 mL",
        bottlerAddress: "Stone's Throw Cellars, Napa, CA",
        countryOfOrigin: "United States",
        beverageKind: "wine",
      },
      extraction,
      "wine-no-abv",
    );

    expect(result.decision).toBe("approved");
    expect(result.checks.find((check) => check.id === "alcohol-content-profile")).toMatchObject({
      status: "not_applicable",
      severity: "info",
    });
  });

  it("rejects unsupported open-ended beverage profiles", () => {
    const extraction = extractionFromPlainText(`STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nBottled by Stone's Throw Distilling, Frankfort, KY\nProduct of United States\n${GOVERNMENT_WARNING_TEXT}`);
    const result = verifyLabel({ ...application, beverageKind: "other" }, extraction, "other-selected");

    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "supported-profile")?.status).toBe("fail");
  });

  it("requires country of origin when the application is marked imported", () => {
    const result = verifyLabel(
      { ...application, bottlerAddress: "Stone's Throw Imports, New York, NY", imported: true, countryOfOrigin: "" },
      extractionFromPlainText(`STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nImported by Stone's Throw Imports, New York, NY\n${GOVERNMENT_WARNING_TEXT}`),
      "import-missing-origin",
    );

    expect(result.decision).toBe("needs_review");
    expect(result.missingApplicationFacts.find((fact) => fact.field === "countryOfOrigin")).toMatchObject({
      severity: "blocking",
    });
  });

  it("checks importer name and address for imported products", () => {
    const result = verifyLabel(
      {
        ...application,
        brandName: "Sol de Jalisco",
        classType: "Blanco Tequila",
        alcoholContent: "40% Alc./Vol.",
        bottlerAddress: "Casa Jalisco Imports, Denver, CO",
        countryOfOrigin: "Mexico",
        imported: true,
      },
      extractionFromPlainText(`Sol de Jalisco\nBlanco Tequila\n40% Alc./Vol.\n750 mL\nImported by Wrong Importer, Austin, TX\nProduct of Mexico\n${GOVERNMENT_WARNING_TEXT}`),
      "importer-address-mismatch",
    );

    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "bottler-address")).toMatchObject({
      status: "fail",
      expected: "Casa Jalisco Imports, Denver, CO",
      observed: "Wrong Importer, Austin, TX",
    });
    expect(result.checks.find((check) => check.id === "country-origin")).toMatchObject({
      status: "pass",
    });
  });

  it("rejects bottler or producer address mismatches separately from import country", () => {
    const result = verifyLabel(
      { ...application, brandName: "Old Cypress Distillery", bottlerAddress: "Old Tom Distillery, Frankfort, KY", countryOfOrigin: "" },
      extractionFromPlainText(`Old Cypress Distillery\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nDistilled and bottled by Old Cypress Distillery, Louisville, KY\n${GOVERNMENT_WARNING_TEXT}`),
      "bottler-address-mismatch",
    );

    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "bottler-address")).toMatchObject({
      status: "fail",
      observed: "Old Cypress Distillery, Louisville, KY",
    });
    expect(result.checks.find((check) => check.id === "country-origin")).toMatchObject({
      status: "not_applicable",
      expected: "Application import status is unchecked, so country of origin is not required",
      observed: "N/A: not evaluated from photo",
    });
  });

  it("keeps a readable bottler address mismatch as fail even on an angled photo", () => {
    const result = verifyLabel(
      { ...application, bottlerAddress: "Old Tom Distillery, Frankfort, KY", countryOfOrigin: "" },
      {
        ...extractionFromPlainText(
          `Iron Horse\nStraight Bourbon Whiskey\n45% Alc./Vol.\n750 mL\nBottled by Iron Horse Distillers, Chicago, IL\n${GOVERNMENT_WARNING_TEXT}`,
        ),
        notes: ["Photo is angled, but the bottler address line is readable."],
      },
      "angled-readable-address-mismatch",
    );

    expect(result.checks.find((check) => check.id === "bottler-address")).toMatchObject({
      status: "fail",
      observed: "Iron Horse Distillers, Chicago, IL",
    });
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

  it("keeps multi-product and covered-label scene photos out of clean approval", () => {
    const extraction = {
      ...extractionFromPlainText(`STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nBottled by Stone's Throw Distilling, Frankfort, KY\nProduct of United States\n${GOVERNMENT_WARNING_TEXT}`),
      notes: ["Multiple visible bottles on a shelf; the target label is not isolated and part of the label is covered by hand."],
    };

    const result = verifyLabel(application, extraction, "scene-many-products");

    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "target-isolation")?.status).toBe("fail");
    expect(result.checks.find((check) => check.id === "image-quality")).toMatchObject({
      status: "needs_review",
      observed: "Multiple visible bottles",
    });
  });

  it("flags structured fields that are not backed by raw extracted text", () => {
    const extraction = {
      ...extractionFromPlainText("STONE'S THROW\nKentucky Straight Bourbon Whiskey"),
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      bottlerAddress: "Bottled by Stone's Throw Distilling, Frankfort, KY",
      governmentWarning: GOVERNMENT_WARNING_TEXT,
      confidence: 0.98,
    };

    const result = verifyLabel({ ...application, countryOfOrigin: "" }, extraction, "inferred-structured-fields");

    expect(result.decision).toBe("needs_review");
    expect(result.checks.find((check) => check.id === "extraction-grounding")).toMatchObject({
      status: "needs_review",
      observed: expect.stringContaining("net contents"),
    });
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
    expect(result.checks.find((check) => check.id === "class-type")?.observed).toBeUndefined();
  });

  it("does not use raw OCR garbage as a fallback for missing structured fields", () => {
    const result = verifyLabel(
      application,
      {
        labelText: "C",
        confidence: 0,
        notes: ["target label not isolated: multiple bottles or labels visible"],
      },
      "covered-pouring-label",
    );

    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "target-isolation")?.status).toBe("fail");
    expect(result.checks.find((check) => check.id === "class-type")).toMatchObject({
      status: "needs_review",
      observed: undefined,
    });
    expect(result.checks.find((check) => check.id === "alcohol-content")).toMatchObject({
      status: "needs_review",
      observed: undefined,
    });
    expect(result.checks.find((check) => check.id === "net-contents")).toMatchObject({
      status: "needs_review",
      observed: undefined,
    });
  });

  it("does not flag label absence when vision extracted label facts with missing origin notes", () => {
    const result = verifyLabel(
      application,
      {
        ...extractionFromPlainText(`STONE'S THROW
Kentucky Straight Bourbon Whiskey
45% Alc./Vol. (90 Proof)
750 mL
Distilled and Bottled by Stone's Throw Distilling, Frankfort, KY
Government Warning: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects.
(2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery and may cause health problems.`),
        confidence: 0.99,
        notes: ["Country of Origin not explicitly stated on label."],
      },
      "vision-good-label",
    );

    expect(result.checks.find((check) => check.id === "label-presence")).toBeUndefined();
    expect(result.checks.find((check) => check.id === "production-statement")).toBeUndefined();
    expect(result.checks.find((check) => check.id === "government-warning")?.status).toBe("fail");
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
