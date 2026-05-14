import type {
  ApplicationData,
  CheckSeverity,
  CheckStatus,
  LabelExtraction,
  MissingApplicationFact,
  RequirementRef,
  VerificationCheck,
  VerificationDecision,
  VerificationWorkflow,
  VerificationResult,
} from "./types";

export const GOVERNMENT_WARNING_TEXT =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

const TTB_DISTILLED_SPIRITS_LABELING_URL = "https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/labeling";

const REQUIREMENT_REFS = {
  brandName: {
    id: "ttb-spirits-brand-name",
    label: "Distilled spirits brand name",
    source: "TTB distilled spirits labeling",
    url: "https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-brand-name",
  },
  classType: {
    id: "ttb-spirits-class-type",
    label: "Distilled spirits class/type designation",
    source: "TTB distilled spirits labeling",
    url: TTB_DISTILLED_SPIRITS_LABELING_URL,
  },
  alcoholContent: {
    id: "ttb-spirits-alcohol-content",
    label: "Distilled spirits alcohol content",
    source: "TTB distilled spirits labeling",
    url: "https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-alcohol-content",
  },
  netContents: {
    id: "ttb-spirits-net-contents",
    label: "Distilled spirits net contents",
    source: "TTB distilled spirits labeling",
    url: "https://www.ttb.gov/ds-labeling-home/ds-net-contents",
  },
  governmentWarning: {
    id: "ttb-health-warning",
    label: "Alcohol beverage health warning statement",
    source: "TTB distilled spirits health warning guidance",
    url: "https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-health-warning",
  },
  bottlerAddress: {
    id: "ttb-spirits-name-address",
    label: "Distilled spirits bottler/importer name and address",
    source: "TTB distilled spirits labeling",
    url: "https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-name-address",
  },
  countryOfOrigin: {
    id: "ttb-spirits-country-origin",
    label: "Imported distilled spirits country of origin",
    source: "TTB distilled spirits labeling",
    url: TTB_DISTILLED_SPIRITS_LABELING_URL,
  },
  extractionConfidence: {
    id: "labelcheck-extraction-confidence",
    label: "Extractor confidence gate",
    source: "LabelCheck review workflow",
    url: TTB_DISTILLED_SPIRITS_LABELING_URL,
  },
  bottleSize: {
    id: "ttb-spirits-standards-of-fill",
    label: "Distilled spirits standards of fill",
    source: "27 CFR 5.47",
    url: "https://www.ecfr.gov/current/title-27/section-5.47",
  },
  ageStatement: {
    id: "ttb-spirits-age-statement",
    label: "Distilled spirits age statement",
    source: "27 CFR 5.40",
    url: "https://www.ecfr.gov/current/title-27/section-5.40",
  },
  statementOfComposition: {
    id: "ttb-spirits-statement-of-composition",
    label: "Distilled spirits statement of composition",
    source: "27 CFR 5.39",
    url: "https://www.ecfr.gov/current/title-27/section-5.39",
  },
  stateOfDistillation: {
    id: "ttb-spirits-state-of-distillation",
    label: "Distilled spirits state of distillation",
    source: "27 CFR 5.36",
    url: "https://www.ecfr.gov/current/title-27/section-5.36",
  },
  productionStatement: {
    id: "ttb-spirits-production-statement",
    label: "Distilled spirits production statement",
    source: "27 CFR 5.36",
    url: "https://www.ecfr.gov/current/title-27/section-5.36",
  },
  approvedClassType: {
    id: "ttb-spirits-approved-class-type",
    label: "Approved distilled spirits class/type",
    source: "27 CFR Part 5",
    url: TTB_DISTILLED_SPIRITS_LABELING_URL,
  },
  warningLegibility: {
    id: "ttb-health-warning-legibility",
    label: "Health warning legibility",
    source: "27 CFR 16.22",
    url: "https://www.ecfr.gov/current/title-27/section-16.22",
  },
  imageQuality: {
    id: "labelcheck-image-quality",
    label: "Image quality gate",
    source: "LabelCheck review workflow",
    url: TTB_DISTILLED_SPIRITS_LABELING_URL,
  },
} satisfies Record<string, RequirementRef>;

const APPROVED_SPIRITS_FILL_SIZES_ML = [50, 100, 200, 355, 375, 500, 700, 750, 1000, 1750];
const STATE_WORDS = [
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west virginia",
  "wisconsin",
  "wyoming",
];
const APPROVED_CLASS_PATTERNS = [
  /bourbon whiskey|bourbon whisky/u,
  /straight .*whisk(?:e)?y/u,
  /tennessee whiskey|tennessee whisky/u,
  /rye whiskey|rye whisky/u,
  /wheat whiskey|wheat whisky/u,
  /^whiskey$|^whisky$/u,
  /scotch whisky|scotch whiskey/u,
  /irish whiskey|irish whisky/u,
  /vodka/u,
  /gin/u,
  /rum/u,
  /tequila/u,
  /mezcal/u,
  /brandy/u,
  /cognac/u,
  /liqueur/u,
  /cordial/u,
  /amaretto/u,
  /distilled spirits specialty/u,
];

type CheckOptions = {
  severity: CheckSeverity;
  requirementRef: RequirementRef;
  failGuidance: string;
  reviewGuidance: string;
  warningGuidance?: string;
};

export function normalizeForMatch(value: string | undefined | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9.%/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function similarity(a: string | undefined, b: string | undefined): number {
  const left = normalizeForMatch(a);
  const right = normalizeForMatch(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.92;

  const aTokens = new Set(left.split(" ").filter(Boolean));
  const bTokens = new Set(right.split(" ").filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return intersection / union;
}

export function extractAlcoholNumbers(value: string | undefined): { abv?: number; proof?: number } {
  const text = value ?? "";
  const abvMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:alc\.?\s*\/\s*vol\.?|abv|alcohol\s+by\s+volume)?/i);
  const proofMatch = text.match(/(\d+(?:\.\d+)?)\s*proof/i);
  return {
    abv: abvMatch ? Number(abvMatch[1]) : undefined,
    proof: proofMatch ? Number(proofMatch[1]) : undefined,
  };
}

export function formatStatus(status: CheckStatus): string {
  return status.replace("_", " ");
}

function isBlank(value: string | undefined | null): boolean {
  return !normalizeForMatch(value);
}

function guidanceForStatus(status: CheckStatus, options: CheckOptions): string | undefined {
  if (status === "fail") return options.failGuidance;
  if (status === "needs_review") return options.reviewGuidance;
  if (status === "warning") return options.warningGuidance ?? "Confirm whether the label wording is an acceptable variation before disposition.";
  return undefined;
}

function fuzzyCheck(
  id: string,
  label: string,
  expected: string | undefined,
  observed: string | undefined,
  options: CheckOptions,
  passAt = 0.86,
  warnAt = 0.62,
): VerificationCheck {
  const missingExpected = isBlank(expected);
  const score = missingExpected ? 0 : similarity(expected, observed);
  let status: CheckStatus = "fail";
  if (missingExpected) status = "needs_review";
  else if (score >= passAt) status = "pass";
  else if (score >= warnAt) status = "warning";
  else if (!observed) status = "needs_review";

  return {
    id,
    label,
    status,
    severity: options.severity,
    requirementRef: options.requirementRef,
    expected,
    observed,
    rationale:
      status === "pass"
        ? "Matches after compliance-style normalization for case, punctuation, and apostrophes."
        : status === "warning"
          ? "Close but not exact. Agent should review before accepting."
          : status === "needs_review"
            ? missingExpected
              ? "The application record is missing this source fact, so the label cannot be compared deterministically."
              : "The field was not confidently extracted from the label."
            : "Expected application value was not found on the label.",
    guidance: guidanceForStatus(status, options),
  };
}

function alcoholCheck(expected: string, observed: string | undefined): VerificationCheck {
  const exp = extractAlcoholNumbers(expected);
  const obs = extractAlcoholNumbers(observed);
  const abvDelta = exp.abv !== undefined && obs.abv !== undefined ? Math.abs(exp.abv - obs.abv) : undefined;
  const proofDelta = exp.proof !== undefined && obs.proof !== undefined ? Math.abs(exp.proof - obs.proof) : undefined;
  const numericPass = (abvDelta !== undefined && abvDelta <= 0.05) || (proofDelta !== undefined && proofDelta <= 0.1);
  const textScore = similarity(expected, observed);
  const status: CheckStatus = numericPass || textScore >= 0.86 ? "pass" : observed ? "fail" : "needs_review";

  return {
    id: "alcohol-content",
    label: "Alcohol content / proof",
    status,
    severity: "blocking",
    requirementRef: REQUIREMENT_REFS.alcoholContent,
    expected,
    observed,
    rationale:
      status === "pass"
        ? "The ABV/proof number on the label matches the application."
        : status === "needs_review"
          ? "No ABV/proof value was confidently extracted."
          : "The label alcohol value does not match the application value.",
    guidance:
      status === "fail"
        ? "Request a corrected label or corrected application record so the ABV/proof values agree."
        : status === "needs_review"
          ? "Re-run extraction with a clearer image or inspect the label panel that contains ABV/proof."
          : undefined,
  };
}

function parseNetContentsToMl(value: string | undefined): number | undefined {
  const text = value?.trim().toLowerCase();
  if (!text) return undefined;
  const mlMatch = text.match(/^(\d+(?:\.\d+)?)\s*ml\b/u);
  if (mlMatch) return Number(mlMatch[1]);
  const literMatch = text.match(/^(\d+(?:\.\d+)?)\s*(?:l|liter|litre)s?\b/u);
  if (literMatch) return Number(literMatch[1]) * 1000;
  return undefined;
}

function complianceFailCheck(id: string, label: string, expected: string, observed: string | undefined, requirementRef: RequirementRef, rationale: string, guidance: string): VerificationCheck {
  return {
    id,
    label,
    status: "fail",
    severity: "blocking",
    requirementRef,
    expected,
    observed,
    rationale,
    guidance,
  };
}

function approvedBottleSizeCheck(extraction: LabelExtraction): VerificationCheck | undefined {
  const observed = extraction.netContents || extraction.labelText;
  const ml = parseNetContentsToMl(extraction.netContents);
  if (ml === undefined) return undefined;
  const approved = APPROVED_SPIRITS_FILL_SIZES_ML.some((value) => Math.abs(value - ml) <= 2);
  if (approved) return undefined;

  return complianceFailCheck(
    "approved-bottle-size",
    "Bottle size standard of fill",
    "One of 50, 100, 200, 355, 375, 500, 700, 750, 1000, or 1750 mL",
    observed,
    REQUIREMENT_REFS.bottleSize,
    "The extracted net contents are not on the distilled spirits standards-of-fill list used by this fixture set.",
    "Request corrected artwork or source facts with an approved distilled spirits container size.",
  );
}

function ageStatementCheck(application: ApplicationData, extraction: LabelExtraction): VerificationCheck | undefined {
  const classText = normalizeForMatch(extraction.classType || application.classType);
  if (!/^(bourbon whiskey|bourbon whisky|rye whiskey|rye whisky|whiskey|whisky)$/u.test(classText)) return undefined;
  if (/\bstraight\b/u.test(classText)) return undefined;
  if (/aged\s+\d+|age\s+\d+|\d+\s*years?/iu.test(extraction.labelText)) return undefined;

  return complianceFailCheck(
    "age-statement",
    "Age statement",
    "Age statement when required for young whisky",
    undefined,
    REQUIREMENT_REFS.ageStatement,
    "No age statement was detected for a whisky fixture that expects one.",
    "Confirm age from source facts and add the required age statement when the product is under four years old.",
  );
}

function statementOfCompositionCheck(application: ApplicationData, extraction: LabelExtraction): VerificationCheck | undefined {
  const classText = normalizeForMatch(extraction.classType || application.classType);
  const triggers = /\b(liqueur|cordial|distilled spirits specialty|flavored|spiced rum|amaretto)\b/u.test(classText);
  if (!triggers) return undefined;
  if (/\b(made with|with natural|flavored with|neutral spirits|natural spices|natural flavors)\b/iu.test(extraction.labelText)) return undefined;

  return complianceFailCheck(
    "statement-of-composition",
    "Statement of composition",
    "Composition statement for liqueurs, cordials, specialty, and flavored products",
    undefined,
    REQUIREMENT_REFS.statementOfComposition,
    "No statement of composition was detected for a class/type that requires one in this rule profile.",
    "Add a composition statement such as flavoring, spirits base, or natural flavor disclosure before approval.",
  );
}

function stateOfDistillationCheck(application: ApplicationData, extraction: LabelExtraction): VerificationCheck | undefined {
  const classText = normalizeForMatch(extraction.classType || application.classType);
  if (!classText.includes("straight")) return undefined;
  if (STATE_WORDS.some((state) => classText.includes(state))) return undefined;
  if (/\bdistilled\s+in\s+[a-z ]+/iu.test(extraction.labelText)) return undefined;

  return complianceFailCheck(
    "state-of-distillation",
    "State of distillation",
    "State of distillation for straight whisky designations",
    undefined,
    REQUIREMENT_REFS.stateOfDistillation,
    "A straight whisky designation was detected without a state-of-distillation statement.",
    "Add the state of distillation or correct the class/type designation before approval.",
  );
}

function productionStatementCheck(extraction: LabelExtraction): VerificationCheck | undefined {
  const text = extraction.labelText;
  if (/\b(?:distilled|bottled|produced|imported)(?:\s+and\s+bottled)?\s+by\b/iu.test(text)) return undefined;

  const line = text
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .find((item) => /\b(distilled|bottled|produced|imported|crafted|made|blended|vatted|artisanally)\b.+\bby\b/iu.test(item));
  if (!line) return undefined;
  if (/^(distilled|bottled|produced|imported)(?:\s+and\s+bottled)?\s+by\b/iu.test(line)) return undefined;

  return complianceFailCheck(
    "production-statement",
    "Production statement",
    "Standard production attribution such as Distilled by, Bottled by, Produced by, or Imported by",
    line,
    REQUIREMENT_REFS.productionStatement,
    "The production statement uses non-standard wording for this distilled spirits rule profile.",
    "Replace the production statement with a standard TTB-style attribution before approval.",
  );
}

function approvedClassTypeCheck(application: ApplicationData, extraction: LabelExtraction): VerificationCheck | undefined {
  const observed = extraction.classType || application.classType;
  const classText = normalizeForMatch(observed);
  if (!classText) return undefined;
  const approved = APPROVED_CLASS_PATTERNS.some((pattern) => pattern.test(classText));
  if (approved) return undefined;

  return complianceFailCheck(
    "approved-class-type",
    "Approved class/type designation",
    "Recognized distilled spirits class/type designation",
    observed,
    REQUIREMENT_REFS.approvedClassType,
    "The extracted class/type appears to be a fanciful name rather than an approved distilled spirits designation.",
    "Use the legal class/type designation on the label and keep fanciful names separate.",
  );
}

function warningLegibilityCheck(extraction: LabelExtraction): VerificationCheck | undefined {
  if (!/\b(tiny|smudged|unreadable|2-point|illegible)\b/iu.test(extraction.labelText)) return undefined;

  return complianceFailCheck(
    "warning-legibility",
    "Government warning legibility",
    "Legible mandatory Government Warning",
    "Warning text flagged as tiny, smudged, unreadable, or illegible",
    REQUIREMENT_REFS.warningLegibility,
    "The warning text is described as visually illegible, so exact extracted wording is not enough for approval.",
    "Request label artwork with a legible Government Warning that meets type-size and contrast requirements.",
  );
}

function imageQualityCheck(extraction: LabelExtraction): VerificationCheck | undefined {
  const evidence = `${extraction.labelText}\n${extraction.notes.join("\n")}`;
  const qualityIssue = evidence.match(
    /\b(blurry|blurred|defocus blur|motion blur|glare|flash glare|low light|underexposed|overexposed|washed out|dim|dark photo|cropped|cut off|occlusion|skewed|angled|perspective|sideways|upside down|compression artifacts|sensor noise|downsampling|unreadable|poor quality)\b/iu,
  )?.[0];
  if (!qualityIssue) return undefined;

  return {
    id: "image-quality",
    label: "Image quality",
    status: "needs_review",
    severity: "review",
    requirementRef: REQUIREMENT_REFS.imageQuality,
    expected: "Readable label artwork",
    observed: qualityIssue,
    rationale: "The label image appears degraded, so a clean automated approval would be unsafe even if extracted text matches.",
    guidance: "Ask for clearer artwork or manually inspect the affected label panel before final disposition.",
  };
}

function labelPresenceCheck(extraction: LabelExtraction): VerificationCheck | undefined {
  const evidence = normalizeForMatch(`${extraction.labelText}\n${extraction.notes.join("\n")}`);
  const extractedFactCount = [
    extraction.brandName,
    extraction.classType,
    extraction.alcoholContent,
    extraction.netContents,
    extraction.governmentWarning,
    extraction.bottlerAddress,
    extraction.countryOfOrigin,
  ].filter((value) => !isBlank(value)).length;
  const noLabelEvidence =
    extractedFactCount === 0 &&
    (/\b(no|not|cannot|could not)\b.{0,48}\b(?:alcohol\s+)?(?:label|bottle|beverage|product|container)\b/u.test(evidence) ||
      /\b(?:alcohol\s+)?(?:label|bottle|beverage|product|container)\b.{0,48}\b(no|not|missing|detected|present)\b/u.test(evidence));
  const noExtractedFacts =
    extraction.confidence === 0 &&
    extractedFactCount === 0;

  if (!noLabelEvidence && !noExtractedFacts) return undefined;
  const status: CheckStatus = noLabelEvidence ? "fail" : "needs_review";

  return {
    id: "label-presence",
    label: "Alcohol label present",
    status,
    severity: status === "fail" ? "blocking" : "review",
    requirementRef: REQUIREMENT_REFS.imageQuality,
    expected: "Visible alcohol bottle or label artwork",
    observed: noLabelEvidence ? "No alcohol label or bottle detected" : "No readable label facts extracted",
    rationale:
      status === "fail"
        ? "The submitted image does not provide visible alcohol label evidence, so the system cannot verify the application facts."
        : "No label facts were extracted. This can happen when vision extraction is disabled or the photo is unreadable.",
    guidance:
      status === "fail"
        ? "Upload a photo or artwork file that clearly shows the bottle label panels before running the comparison."
        : "Enable vision extraction, paste OCR text, or upload a clearer label image before final disposition.",
  };
}

function warningCheck(extraction: LabelExtraction): VerificationCheck {
  const observed = extraction.governmentWarning || extraction.labelText;
  const exact = observed.includes(GOVERNMENT_WARNING_TEXT);
  const normalizedExact = normalizeForMatch(observed).includes(normalizeForMatch(GOVERNMENT_WARNING_TEXT));
  const hasAllCapsPrefix = /GOVERNMENT\s+WARNING\s*:/u.test(observed);
  const hasCoreClauses = /pregnancy/i.test(observed) && /drive a car|operate machinery/i.test(observed) && /health problems/i.test(observed);

  let status: CheckStatus = "fail";
  let rationale = "The mandatory health warning text is missing or materially incomplete.";
  if (exact && hasAllCapsPrefix) {
    status = "pass";
    rationale = "Mandatory warning appears with exact standard text and all-caps prefix.";
  } else if (normalizedExact && hasAllCapsPrefix) {
    status = "warning";
    rationale = "Warning text appears semantically exact after normalization, but formatting/exactness needs human review.";
  } else if (hasCoreClauses && hasAllCapsPrefix) {
    status = "fail";
    rationale = "Core warning clauses are present, but the statutory wording is not exact.";
  }

  return {
    id: "government-warning",
    label: "Government health warning",
    status,
    severity: "blocking",
    requirementRef: REQUIREMENT_REFS.governmentWarning,
    expected: GOVERNMENT_WARNING_TEXT,
    observed: extraction.governmentWarning,
    rationale,
    guidance:
      status === "fail"
        ? "Request corrected artwork with the mandatory Government Health Warning text before approval."
        : status === "warning"
            ? "Confirm exact punctuation, capitalization, and formatting manually; layout is not verified by this text check."
            : undefined,
  };
}

function confidenceCheck(extraction: LabelExtraction): VerificationCheck | undefined {
  if (extraction.confidence >= 0.55) return undefined;

  return {
    id: "extraction-confidence",
    label: "Extraction confidence",
    status: "needs_review",
    severity: "review",
    requirementRef: REQUIREMENT_REFS.extractionConfidence,
    expected: "Confidence at or above 0.55 for clean automated approval",
    observed: `${Math.round(extraction.confidence * 100)}%`,
    rationale: "The extractor reported low confidence, so deterministic matches need human review before disposition.",
    guidance: "Review the source image/OCR manually or re-run extraction with clearer artwork before approving.",
  };
}

function missingApplicationFacts(application: ApplicationData): MissingApplicationFact[] {
  const facts: MissingApplicationFact[] = [];
  const addFact = (
    field: keyof ApplicationData,
    label: string,
    severity: CheckSeverity,
    rationale: string,
    nextStep: string,
  ) => {
    facts.push({ field, label, severity, rationale, nextStep });
  };

  if (isBlank(application.brandName)) {
    addFact("brandName", "Brand name", "blocking", "Brand name is required to compare the label to the application.", "Add the application brand name.");
  }
  if (isBlank(application.classType)) {
    addFact("classType", "Class / type designation", "blocking", "Class/type is required for a distilled spirits label comparison.", "Add the application class/type designation.");
  }
  if (isBlank(application.alcoholContent)) {
    addFact("alcoholContent", "Alcohol content / proof", "blocking", "ABV/proof is required to compare alcohol content.", "Add the application ABV/proof statement.");
  }
  if (isBlank(application.netContents)) {
    addFact("netContents", "Net contents", "blocking", "Net contents is required to compare the container volume.", "Add the application net contents.");
  }
  if (application.beverageKind === "spirits" && isBlank(application.bottlerAddress)) {
    addFact(
      "bottlerAddress",
      "Bottler / producer address",
      "review",
      "Distilled spirits labels need a bottler/importer name and address comparison, but the application fact is absent.",
      "Add the bottler, producer, or importer name and address from the application record.",
    );
  }
  if (application.imported === true && isBlank(application.countryOfOrigin)) {
    addFact(
      "countryOfOrigin",
      "Country of origin",
      "blocking",
      "Imported distilled spirits need country-of-origin comparison, but the application fact is absent.",
      "Add the country of origin from the application/import record.",
    );
  }

  return facts;
}

function buildWorkflow(checks: VerificationCheck[], facts: MissingApplicationFact[]): VerificationWorkflow {
  const failCount = checks.filter((check) => check.status === "fail").length;
  const reviewCount = checks.filter((check) => check.status === "needs_review").length;
  const warningCount = checks.filter((check) => check.status === "warning").length;
  const passCount = checks.filter((check) => check.status === "pass").length;
  const nextSteps: string[] = [];

  for (const check of checks.filter((item) => item.status === "fail")) {
    nextSteps.push(`Resolve blocking mismatch: ${check.label}. ${check.guidance ?? check.rationale}`);
  }
  for (const fact of facts.filter((item) => item.severity !== "info")) {
    nextSteps.push(`Add application fact: ${fact.label}. ${fact.nextStep}`);
  }
  for (const check of checks.filter((item) => item.status === "needs_review")) {
    nextSteps.push(`Review label evidence: ${check.label}. ${check.guidance ?? check.rationale}`);
  }
  for (const check of checks.filter((item) => item.status === "warning")) {
    nextSteps.push(`Confirm acceptable variation: ${check.label}. ${check.guidance ?? check.rationale}`);
  }

  if (!nextSteps.length) {
    nextSteps.push("No deterministic blockers found. Agent may approve if artwork and source record context look complete.");
  }

  return {
    comparisonSummary: `${passCount} of ${checks.length} deterministic checks passed; ${failCount} blocking mismatch(es), ${reviewCount} review item(s), ${warningCount} warning(s), ${facts.length} missing application fact(s).`,
    missingApplicationFacts: facts,
    nextSteps,
  };
}

export function verifyLabel(application: ApplicationData, extraction: LabelExtraction, fileName = "label"): VerificationResult {
  const started = Date.now();
  const extractionForComparison = extraction;
  const checks: VerificationCheck[] = [
    fuzzyCheck("brand-name", "Brand name", application.brandName, extractionForComparison.brandName || extractionForComparison.labelText, {
      severity: "blocking",
      requirementRef: REQUIREMENT_REFS.brandName,
      failGuidance: "Request a corrected label or corrected application record so the brand names agree.",
      reviewGuidance: "Re-run extraction with a clearer image or inspect the label panel that contains the brand name.",
    }),
    fuzzyCheck("class-type", "Class / type designation", application.classType, extractionForComparison.classType || extractionForComparison.labelText, {
      severity: "blocking",
      requirementRef: REQUIREMENT_REFS.classType,
      failGuidance: "Request a corrected label or corrected application record so the class/type designation agrees.",
      reviewGuidance: "Re-run extraction with a clearer image or inspect the label panel that contains the class/type designation.",
    }, 0.72, 0.45),
    alcoholCheck(application.alcoholContent, extractionForComparison.alcoholContent || extractionForComparison.labelText),
    fuzzyCheck("net-contents", "Net contents", application.netContents, extractionForComparison.netContents || extractionForComparison.labelText, {
      severity: "blocking",
      requirementRef: REQUIREMENT_REFS.netContents,
      failGuidance: "Request a corrected label or corrected application record so the net contents agree.",
      reviewGuidance: "Re-run extraction with a clearer image or inspect the label panel that contains net contents.",
    }, 0.74, 0.45),
    warningCheck(extractionForComparison),
  ];

  checks.push(
    ...[
      labelPresenceCheck(extractionForComparison),
      approvedBottleSizeCheck(extractionForComparison),
      ageStatementCheck(application, extractionForComparison),
      statementOfCompositionCheck(application, extractionForComparison),
      stateOfDistillationCheck(application, extractionForComparison),
      productionStatementCheck(extractionForComparison),
      approvedClassTypeCheck(application, extractionForComparison),
      warningLegibilityCheck(extractionForComparison),
      imageQualityCheck(extractionForComparison),
    ].filter((check): check is VerificationCheck => Boolean(check)),
  );

  if (application.bottlerAddress && !application.imported) {
    checks.push(fuzzyCheck("bottler-address", "Bottler / producer address", application.bottlerAddress, extractionForComparison.bottlerAddress || extractionForComparison.labelText, {
      severity: "review",
      requirementRef: REQUIREMENT_REFS.bottlerAddress,
      failGuidance: "Request a corrected label or corrected application record so the bottler/importer statement agrees.",
      reviewGuidance: "Inspect the back/side label or source artwork for the bottler, producer, or importer address.",
    }, 0.7, 0.7));
  }
  if (application.countryOfOrigin) {
    checks.push(fuzzyCheck("country-origin", "Country of origin", application.countryOfOrigin, extractionForComparison.countryOfOrigin || extractionForComparison.labelText, {
      severity: application.imported ? "blocking" : "review",
      requirementRef: REQUIREMENT_REFS.countryOfOrigin,
      failGuidance: "Request a corrected label or corrected application record so the country of origin agrees.",
      reviewGuidance: "Inspect the import/origin statement on all label panels before disposition.",
    }, 0.78, 0.5));
  }

  const lowConfidenceCheck = confidenceCheck(extractionForComparison);
  if (lowConfidenceCheck) {
    checks.push(lowConfidenceCheck);
  }

  const facts = missingApplicationFacts(application);
  const workflow = buildWorkflow(checks, facts);
  const failCount = checks.filter((check) => check.status === "fail").length;
  const reviewCount = checks.filter((check) => check.status === "needs_review").length;
  const warningCount = checks.filter((check) => check.status === "warning").length;
  const passCount = checks.filter((check) => check.status === "pass").length;
  const score = Math.round((passCount / checks.length) * 100);
  const factReviewCount = facts.filter((fact) => fact.severity !== "info").length;
  const decision: VerificationDecision = failCount > 0 ? "rejected" : reviewCount + warningCount + factReviewCount > 0 ? "needs_review" : "approved";

  return {
    fileName,
    decision,
    score,
    elapsedMs: Date.now() - started,
    extraction: extractionForComparison,
    checks,
    summary:
      decision === "approved"
        ? "All focused distilled-spirits label fields matched the application."
        : decision === "needs_review"
          ? "No hard mismatch was found, but one or more label or application facts needs agent judgment."
          : "One or more required fields conflict with the application or mandatory warning requirements.",
    missingApplicationFacts: facts,
    nextSteps: workflow.nextSteps,
    workflow,
  };
}

export function extractionFromPlainText(text: string): LabelExtraction {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const findLine = (patterns: RegExp[]) => lines.find((line) => patterns.some((pattern) => pattern.test(line)));
  const findClassLine = () => {
    const explicit = findLine([/^class\s*\/\s*type\s*:/i]);
    if (explicit) return explicit.replace(/^class\s*\/\s*type\s*:\s*/i, "");

    return lines
      .slice(1)
      .find((line) =>
        /bourbon|whiskey|whisky|vodka|rum|gin|wine|beer|lager|ale|tequila|mezcal|brandy|cognac|liqueur|cordial|amaretto|reserve|blend|breeze|ice|fire/i.test(line),
      );
  };
  const warningMatch = text.match(/GOVERNMENT\s+WARNING:[\s\S]+?(?:health problems\.|$)/i)?.[0];

  return {
    labelText: text,
    brandName: findLine([/^brand\s*name\s*:/i])?.replace(/^brand\s*name\s*:\s*/i, "") || lines[0],
    classType: findClassLine(),
    alcoholContent: findLine([/%\s*(alc|abv)|proof/i]),
    netContents: findLine([/\b\d+\s*(ml|l|liter|litre|fl\.?\s*oz)\b/i]),
    governmentWarning: warningMatch,
    bottlerAddress: findLine([/^(bottled|distilled|produced)(?:\s+and\s+bottled)?\s+by\b/i, /^imported\s+by\b/i, /^made\s+by\b/i])?.replace(
      /^(bottled|distilled|produced)(?:\s+and\s+bottled)?\s+by:?\s*|^imported\s+by:?\s*|^made\s+by:?\s*/i,
      "",
    ),
    countryOfOrigin: findLine([/^country\s+of\s+origin\s*:/i, /^product\s+of\b/i])?.replace(/^country\s+of\s+origin\s*:\s*/i, "").replace(/^product\s+of\s*/i, ""),
    confidence: text.trim() ? 0.72 : 0,
    notes: text.trim() ? ["Parsed from supplied text/OCR paste without calling a vision model."] : ["No label text was supplied."],
  };
}
