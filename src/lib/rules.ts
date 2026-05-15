import type {
  ApplicationData,
  BeverageKind,
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

import { beverageKindFromClassType } from "./applicationImport";

export const GOVERNMENT_WARNING_TEXT =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

const TTB_DISTILLED_SPIRITS_LABELING_URL = "https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/labeling";

const REQUIREMENT_REFS = {
  brandName: {
    id: "ttb-brand-name",
    label: "Alcohol beverage brand name",
    source: "TTB beverage alcohol labeling guidance",
    url: "https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-brand-name",
  },
  classType: {
    id: "ttb-class-type",
    label: "Alcohol beverage class/type designation",
    source: "TTB beverage alcohol labeling guidance",
    url: TTB_DISTILLED_SPIRITS_LABELING_URL,
  },
  alcoholContent: {
    id: "ttb-alcohol-content",
    label: "Alcohol beverage alcohol content",
    source: "TTB commodity-specific alcohol content guidance",
    url: "https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-alcohol-content",
  },
  netContents: {
    id: "ttb-net-contents",
    label: "Alcohol beverage net contents",
    source: "TTB beverage alcohol labeling guidance",
    url: "https://www.ttb.gov/ds-labeling-home/ds-net-contents",
  },
  governmentWarning: {
    id: "ttb-health-warning",
    label: "Alcohol beverage health warning statement",
    source: "TTB distilled spirits health warning guidance",
    url: "https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-health-warning",
  },
  bottlerAddress: {
    id: "ttb-name-address",
    label: "Alcohol beverage bottler/importer name and address",
    source: "TTB beverage alcohol labeling guidance",
    url: "https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-name-address",
  },
  countryOfOrigin: {
    id: "ttb-country-origin",
    label: "Imported alcohol beverage country of origin",
    source: "TTB beverage alcohol import labeling guidance",
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
    source: "27 CFR 5.203",
    url: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-K/section-5.203",
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
  supportedProfile: {
    id: "labelcheck-supported-profile",
    label: "Supported beverage rule profile",
    source: "LabelCheck V1 scope",
    url: TTB_DISTILLED_SPIRITS_LABELING_URL,
  },
  alcoholContentProfile: {
    id: "ttb-alcohol-content-profile",
    label: "Alcohol content profile",
    source: "TTB commodity-specific alcohol content rules",
    url: TTB_DISTILLED_SPIRITS_LABELING_URL,
  },
  alcoholFormat: {
    id: "ttb-spirits-alcohol-format",
    label: "Distilled spirits alcohol content format",
    source: "27 CFR 5.65",
    url: "https://www.ecfr.gov/current/title-27/section-5.65",
  },
  nameAddressPhrase: {
    id: "ttb-name-address-phrase",
    label: "Name/address attribution phrase",
    source: "27 CFR 5.66",
    url: "https://www.ecfr.gov/current/title-27/section-5.66",
  },
  importerStatement: {
    id: "ttb-importer-statement",
    label: "Importer name/address statement",
    source: "27 CFR 5.67",
    url: "https://www.ecfr.gov/current/title-27/section-5.67",
  },
  sameFieldOfVision: {
    id: "ttb-same-field-of-vision",
    label: "Same field of vision",
    source: "27 CFR 5.63",
    url: "https://www.ecfr.gov/current/title-27/section-5.63",
  },
  conditionalDisclosure: {
    id: "ttb-conditional-disclosures",
    label: "Conditional disclosure",
    source: "TTB beverage alcohol labeling guidance",
    url: TTB_DISTILLED_SPIRITS_LABELING_URL,
  },
} satisfies Record<string, RequirementRef>;

const APPROVED_SPIRITS_FILL_SIZES_ML = [
  50,
  100,
  187,
  200,
  250,
  331,
  350,
  355,
  375,
  475,
  500,
  570,
  700,
  710,
  720,
  750,
  900,
  945,
  1000,
  1500,
  1750,
  1800,
  2000,
  3000,
  3750,
];
const US_STATE_ABBREVIATION_PATTERN =
  /,\s*(?:A[LKZR]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEHINOPST]|N[CDEHJMVY]|O[HKR]|P[AR]|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])\.?\b/iu;
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

const IMAGE_QUALITY_PATTERN =
  /\b(blurry|blurred|defocus blur|motion blur|glare|flash glare|low light|underexposed|overexposed|washed out|dim|dark photo|cropped|cut off|occlusion|skewed|angled|perspective|sideways|upside down|compression artifacts|sensor noise|downsampling|unreadable|poor quality|crowded|overlap|overlapping|multiple (?:visible )?(?:products|bottles|labels)|many (?:alcohol )?bottles|not isolated|foreground hand|covered by hand|hand-covered|label (?:is )?covered)\b/iu;

const LABEL_AMBIGUITY_PATTERN =
  /\b(target label not isolated|crowded|overlap|overlapping|multiple (?:visible )?(?:products|bottles|labels)|many (?:alcohol )?bottles|not isolated|mixed labels|several bottles|group of bottles|shelf|rack)\b/iu;

const NAME_ADDRESS_PHRASE_PATTERN =
  /\b(?:distilled|bottled|packed|filled|produced|manufactured|made|blended|imported)(?:\s+and\s+(?:distilled|bottled|packed|filled|produced|manufactured|made|blended|imported))*\s+(?:by|for)\b/iu;
const IMPORTER_PHRASE_PATTERN = /\bimported\s+(?:by|for)\b/iu;
const SAME_FIELD_OF_VISION_RISK_PATTERN =
  /\b(?:brand|class|type|alcohol|abv|proof|net contents?|mandatory information).{0,80}\b(?:different|separate|other|back|side|neck|rear)\s+(?:panel|label|side)\b|\b(?:different|separate|other|back|side|neck|rear)\s+(?:panel|label|side).{0,80}\b(?:brand|class|type|alcohol|abv|proof|net contents?|mandatory information)\b/iu;
const CLASS_CONFLICT_WORDS = [
  "vodka",
  "gin",
  "rum",
  "tequila",
  "mezcal",
  "brandy",
  "cognac",
  "liqueur",
  "cordial",
  "whiskey",
  "whisky",
  "wine",
  "beer",
  "lager",
  "ale",
];
const NEUTRAL_SPIRITS_SOURCE_PATTERN = /\b(?:grain|corn|wheat|rye|barley|grape|fruit|cane|molasses|potato|beet)\b/iu;

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
  return status === "not_applicable" ? "not applicable" : status.replace("_", " ");
}

function isBlank(value: string | undefined | null): boolean {
  return !normalizeForMatch(value);
}

function isUnitedStates(value: string | undefined | null): boolean {
  const normalized = normalizeForMatch(value);
  return normalized === "united states" || normalized === "usa" || normalized === "us" || normalized === "united states of america";
}

function isImportedProduct(application: ApplicationData): boolean {
  if (application.imported === true) return true;
  if (isBlank(application.countryOfOrigin)) return false;
  return !isUnitedStates(application.countryOfOrigin);
}

function effectiveBeverageKind(application: ApplicationData, extraction?: LabelExtraction): BeverageKind {
  if (application.beverageKind !== "other") return application.beverageKind;
  const inferred = beverageKindFromClassType(application.classType || extraction?.classType || extraction?.labelText || "");
  return inferred === "other" ? "spirits" : inferred;
}

function effectiveApplication(application: ApplicationData, extraction?: LabelExtraction): ApplicationData {
  return { ...application, beverageKind: effectiveBeverageKind(application, extraction) };
}

function hasUsStateAddress(value: string | undefined): boolean {
  if (!value) return false;
  return US_STATE_ABBREVIATION_PATTERN.test(value) || STATE_WORDS.some((state) => normalizeForMatch(value).includes(state));
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

function classTypeCheck(expected: string | undefined, observed: string | undefined, beverageKind: BeverageKind): VerificationCheck {
  const missingExpected = isBlank(expected);
  const missingObserved = isBlank(observed);
  const matches = !missingExpected && !missingObserved && normalizeForMatch(expected) === normalizeForMatch(observed);
  const expectedLooksApproved = APPROVED_CLASS_PATTERNS.some((pattern) => pattern.test(normalizeForMatch(expected)));
  const observedLooksApproved = APPROVED_CLASS_PATTERNS.some((pattern) => pattern.test(normalizeForMatch(observed)));
  const usesFancifulClass = beverageKind === "spirits" && !expectedLooksApproved && (!observed || !observedLooksApproved);
  const status: CheckStatus = usesFancifulClass ? "fail" : missingExpected || missingObserved ? "needs_review" : matches ? "pass" : "fail";

  return {
    id: "class-type",
    label: "Class / type designation",
    status,
    severity: "blocking",
    requirementRef: REQUIREMENT_REFS.classType,
    expected,
    observed: usesFancifulClass ? observed || expected : observed,
    rationale:
      status === "pass"
        ? "Full class/type designation matches after normalization for case and punctuation."
        : usesFancifulClass
          ? "The label text matches the application, but that text appears to be a fanciful name rather than an approved distilled spirits class/type."
        : status === "needs_review"
          ? missingExpected
            ? "The application record is missing the class/type designation."
            : "The class/type designation was not confidently extracted from the label."
          : "The full class/type designation does not match the application.",
    guidance:
      usesFancifulClass
        ? "Add the legal class/type designation, such as Vodka, Rum, Whiskey, or Liqueur. Keep the fanciful name separate from the class/type field."
        : status === "fail"
        ? "Request a corrected label or corrected application record so the full class/type designation agrees."
        : status === "needs_review"
          ? "Re-run extraction with a clearer image or inspect the label panel that contains the class/type designation."
          : undefined,
  };
}

function countryOriginCheck(expected: string | undefined, extraction: LabelExtraction): VerificationCheck {
  const observed = extraction.countryOfOrigin;
  const missingExpected = isBlank(expected);
  const missingObserved = isBlank(observed);
  const score = missingExpected ? 0 : similarity(expected, observed);
  const status: CheckStatus = missingExpected ? "needs_review" : !missingObserved && score >= 0.78 ? "pass" : "fail";
  const observedEvidence = missingObserved && hasUsStateAddress(extraction.bottlerAddress) ? `US bottler/importer address only: ${extraction.bottlerAddress}` : observed;

  return {
    id: "country-origin",
    label: "Country of origin",
    status,
    severity: "blocking",
    requirementRef: REQUIREMENT_REFS.countryOfOrigin,
    expected,
    observed: observedEvidence,
    rationale:
      status === "pass"
        ? "Imported country of origin matches the application."
        : missingExpected
          ? "The application record is missing the import country."
          : missingObserved
            ? "The expected import country was not found on the label. A U.S. address alone is not a country-of-origin statement for an imported product."
            : "The import country on the label does not match the application.",
    guidance:
      status === "pass"
        ? undefined
        : missingExpected
          ? "Add the country of origin from the application/import record."
          : "Request a corrected label or corrected application record so the country of origin agrees.",
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

function alcoholRequirementCheck(application: ApplicationData, observed: string | undefined): VerificationCheck | undefined {
  if (!isBlank(application.alcoholContent)) return alcoholCheck(application.alcoholContent ?? "", observed);
  if (application.beverageKind === "spirits") return undefined;
  if (application.beverageKind === "other") return undefined;

  return {
    id: "alcohol-content-profile",
    label: "Alcohol content / proof",
    status: "not_applicable",
    severity: "info",
    requirementRef: REQUIREMENT_REFS.alcoholContentProfile,
    expected: "Optional or conditional alcohol content for this beverage profile",
    observed,
    rationale:
      "No source ABV/proof was supplied. V1 does not block wine or malt beverage reviews solely on missing alcohol content because those profiles have commodity-specific exceptions.",
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

function approvedSpiritsFillSize(value: string | undefined): boolean | undefined {
  const ml = parseNetContentsToMl(value);
  if (ml === undefined) return undefined;
  return APPROVED_SPIRITS_FILL_SIZES_ML.some((approved) => Math.abs(approved - ml) <= 2);
}

function netContentsCheck(application: ApplicationData, observed: string | undefined): VerificationCheck {
  const check = fuzzyCheck("net-contents", "Net contents", application.netContents, observed, {
    severity: "blocking",
    requirementRef: REQUIREMENT_REFS.netContents,
    failGuidance: "Request a corrected label or corrected application record so the net contents agree.",
    reviewGuidance: "Re-run extraction with a clearer image or inspect the label panel that contains net contents.",
  }, 0.74, 0.45);

  if (application.beverageKind !== "spirits" || check.status !== "pass") return check;

  const approved = approvedSpiritsFillSize(observed);
  if (approved !== false) return check;

  return {
    ...check,
    status: "fail",
    severity: "blocking",
    requirementRef: REQUIREMENT_REFS.bottleSize,
    rationale: "The label net contents match the application, but the amount is not an authorized distilled spirits standard of fill.",
    guidance: "Request corrected artwork or source facts with an authorized distilled spirits container size.",
  };
}

function ageStatementCheck(application: ApplicationData, extraction: LabelExtraction): VerificationCheck | undefined {
  const classText = normalizeForMatch(extraction.classType || application.classType);
  if (!/\b(?:bourbon|rye|wheat|malt|corn)?\s*whisk(?:e)?y\b/u.test(classText)) return undefined;
  if (/\bstraight\b/u.test(classText)) return undefined;
  if (application.agedYears === undefined || application.agedYears >= 4) return undefined;
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

function alcoholFormatCheck(application: ApplicationData, extraction: LabelExtraction): VerificationCheck | undefined {
  if (application.beverageKind !== "spirits") return undefined;
  const observed = extraction.alcoholContent;
  if (isBlank(observed)) return undefined;
  const hasAbv = /\b\d+(?:\.\d+)?\s*%\s*(?:alc\.?\s*\/\s*vol\.?|abv|alcohol\s+by\s+volume)?\b/iu.test(observed ?? "");
  const hasProofOnly = /\b\d+(?:\.\d+)?\s*proof\b/iu.test(observed ?? "") && !hasAbv;
  if (hasAbv && !hasProofOnly) return undefined;

  return complianceFailCheck(
    "alcohol-format",
    "Alcohol content format",
    "Alcohol content stated as percent alcohol by volume",
    observed,
    REQUIREMENT_REFS.alcoholFormat,
    "Distilled spirits alcohol content was not found in percent alcohol-by-volume format.",
    "Add or correct the percent alcohol-by-volume statement. Proof may appear only as supplemental information.",
  );
}

function nameAddressPhraseCheck(application: ApplicationData, extraction: LabelExtraction): VerificationCheck | undefined {
  if (application.beverageKind !== "spirits") return undefined;
  if (isBlank(application.bottlerAddress) && isBlank(extraction.bottlerAddress)) return undefined;
  if (NAME_ADDRESS_PHRASE_PATTERN.test(extraction.labelText)) return undefined;

  const observed = extraction.bottlerAddress ?? extraction.labelText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => hasUsStateAddress(line));

  return complianceFailCheck(
    "name-address-phrase",
    "Name/address attribution phrase",
    "A standard attribution phrase such as Bottled by, Distilled by, Produced by, or Imported by",
    observed,
    REQUIREMENT_REFS.nameAddressPhrase,
    "A name/address line is present or expected, but no standard TTB-style attribution phrase was detected.",
    "Add the required attribution phrase immediately before the responsible party name and address.",
  );
}

function importerStatementCheck(application: ApplicationData, extraction: LabelExtraction): VerificationCheck | undefined {
  if (!isImportedProduct(application)) return undefined;
  if (IMPORTER_PHRASE_PATTERN.test(extraction.labelText)) return undefined;

  return complianceFailCheck(
    "importer-statement",
    "Importer statement",
    "Imported by or Imported for plus U.S. importer name and address",
    extraction.bottlerAddress,
    REQUIREMENT_REFS.importerStatement,
    "The application indicates an imported product, but the label does not include an imported-by/imported-for statement.",
    "Add the U.S. importer statement and compare it against the application importer record.",
  );
}

function sameFieldOfVisionCheck(extraction: LabelExtraction): VerificationCheck | undefined {
  const evidence = `${extraction.labelText}\n${extraction.notes.join("\n")}`;
  const observed = evidence.match(SAME_FIELD_OF_VISION_RISK_PATTERN)?.[0];
  if (!observed) return undefined;

  return {
    id: "same-field-of-vision",
    label: "Same field of vision",
    status: "needs_review",
    severity: "review",
    requirementRef: REQUIREMENT_REFS.sameFieldOfVision,
    expected: "Mandatory information visible in the required field of vision",
    observed,
    rationale: "The extracted evidence suggests mandatory facts may be split across panels, which text extraction cannot approve deterministically.",
    guidance: "Inspect the artwork layout and confirm the required statements appear in the same field of vision before approval.",
  };
}

function classTypeConflictCheck(application: ApplicationData, extraction: LabelExtraction): VerificationCheck | undefined {
  if (application.beverageKind !== "spirits") return undefined;
  const classText = normalizeForMatch(extraction.classType || application.classType);
  const rawEvidence = normalizeForMatch(`${extraction.labelText}\n${extraction.notes.join("\n")}`);
  if (!classText || !rawEvidence) return undefined;
  if (!isBlank(application.classType) && !isBlank(extraction.classType) && normalizeForMatch(application.classType) === normalizeForMatch(extraction.classType)) {
    return undefined;
  }

  const hasClassWord = (text: string, word: string) => new RegExp(`\\b${word}\\b`, "u").test(text);
  const classTokens = CLASS_CONFLICT_WORDS.filter((word) => hasClassWord(classText, word));
  const evidenceTokens = CLASS_CONFLICT_WORDS.filter((word) => hasClassWord(rawEvidence, word));
  const conflicts = evidenceTokens.filter((word) => !classTokens.includes(word));
  if (!conflicts.length) return undefined;

  return complianceFailCheck(
    "class-type-conflict",
    "Conflicting class/type terms",
    extraction.classType || application.classType,
    conflicts.join(", "),
    REQUIREMENT_REFS.classType,
    "The label evidence contains beverage class terms that conflict with the application class/type.",
    "Remove conflicting class/type wording or correct the application class/type before approval.",
  );
}

function conditionalDisclosureChecks(application: ApplicationData, extraction: LabelExtraction): VerificationCheck[] {
  const checks: VerificationCheck[] = [];
  const evidence = `${extraction.labelText}\n${extraction.notes.join("\n")}`;
  const normalizedClass = normalizeForMatch(extraction.classType || application.classType);
  const addFail = (id: string, label: string, expected: string, observed: string, rationale: string, guidance: string) => {
    checks.push({
      id,
      label,
      status: "fail",
      severity: "blocking",
      requirementRef: REQUIREMENT_REFS.conditionalDisclosure,
      expected,
      observed,
      rationale,
      guidance,
    });
  };

  if (/\b(?:so2|sulfur dioxide|sulphur dioxide|sulfite|sulphite).{0,24}(?:>=|>|at least|10\s*ppm)/iu.test(evidence) && !/\bcontains\s+sul(?:f|ph)ites\b/iu.test(extraction.labelText)) {
    addFail(
      "sulfites-disclosure",
      "Sulfites disclosure",
      "Contains sulfites",
      "Sulfites indicated in evidence without the required label statement",
      "Evidence indicates sulfites at a disclosure-triggering level, but the label statement was not detected.",
      "Add the Contains sulfites statement or correct the source facts if sulfites are not disclosure-triggering.",
    );
  }

  if (/\b(?:fd&c\s*)?yellow\s*#?\s*5\b/iu.test(evidence) && !/\bcontains\b.{0,40}\b(?:fd&c\s*)?yellow\s*#?\s*5\b/iu.test(extraction.labelText)) {
    addFail(
      "yellow-5-disclosure",
      "FD&C Yellow #5 disclosure",
      "Contains FD&C Yellow #5",
      "Yellow #5 indicated without a Contains disclosure",
      "Evidence indicates FD&C Yellow #5, but the required Contains disclosure was not detected.",
      "Add the FD&C Yellow #5 disclosure or correct the ingredient facts.",
    );
  }

  if (/\b(?:carmine|cochineal)\b/iu.test(evidence) && !/\bcontains\b.{0,40}\b(?:carmine|cochineal)\b/iu.test(extraction.labelText)) {
    addFail(
      "carmine-cochineal-disclosure",
      "Carmine/cochineal disclosure",
      "Contains carmine or Contains cochineal extract",
      "Carmine or cochineal indicated without a Contains disclosure",
      "Evidence indicates carmine or cochineal extract, but the required Contains disclosure was not detected.",
      "Add the carmine/cochineal disclosure or correct the ingredient facts.",
    );
  }

  if (normalizedClass.includes("neutral spirits") && !/\b(?:liqueur|cordial|specialty)\b/u.test(normalizedClass) && !NEUTRAL_SPIRITS_SOURCE_PATTERN.test(extraction.labelText)) {
    addFail(
      "neutral-spirits-source",
      "Neutral spirits source commodity",
      "Neutral spirits source commodity, such as neutral spirits distilled from grain",
      extraction.classType || application.classType,
      "Neutral spirits wording was detected without a source commodity statement.",
      "Add the source commodity for the neutral spirits statement or correct the class/type designation.",
    );
  }

  return checks;
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
  if (!isBlank(application.classType)) return undefined;
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
  const qualityIssue = evidence.match(IMAGE_QUALITY_PATTERN)?.[0];
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

function targetIsolationCheck(extraction: LabelExtraction): VerificationCheck | undefined {
  const evidence = `${extraction.labelText}\n${extraction.notes.join("\n")}`;
  const ambiguity = evidence.match(LABEL_AMBIGUITY_PATTERN)?.[0];
  if (!ambiguity) return undefined;

  return {
    id: "target-isolation",
    label: "Target label isolation",
    status: "fail",
    severity: "blocking",
    requirementRef: REQUIREMENT_REFS.imageQuality,
    expected: "One isolated product label or bottle per image",
    observed: ambiguity,
    rationale: "The submitted image appears to contain multiple bottles, multiple labels, or no clearly isolated target product, so the app could compare the wrong label to the application facts.",
    guidance: "Upload or crop one product label per image. For batch review, use one file per product instead of one crowded shelf or counter photo.",
  };
}

function structuredEvidenceCheck(extraction: LabelExtraction): VerificationCheck | undefined {
  const rawText = normalizeForMatch(extraction.labelText);
  if (!rawText) return undefined;

  const fields = [
    ["brand", extraction.brandName],
    ["class/type", extraction.classType],
    ["alcohol", extraction.alcoholContent],
    ["net contents", extraction.netContents],
    ["bottler/address", extraction.bottlerAddress],
    ["origin", extraction.countryOfOrigin],
    ["government warning", extraction.governmentWarning],
  ] as const;
  const unsupported = fields
    .filter(([, value]) => !isBlank(value) && !rawText.includes(normalizeForMatch(value)))
    .map(([label]) => label);

  if (!unsupported.length) return undefined;

  return {
    id: "extraction-grounding",
    label: "Extracted text evidence",
    status: "needs_review",
    severity: "review",
    requirementRef: REQUIREMENT_REFS.extractionConfidence,
    expected: "Structured fields must appear in the raw extracted label text",
    observed: `Unbacked fields: ${unsupported.join(", ")}`,
    rationale: "The model returned structured values that are not present in the raw extracted text, so they may be inferred or from an unseen panel.",
    guidance: "Use the raw extracted text and photo to confirm these values manually, or upload a clearer image of the relevant label panel.",
  };
}

function warningCheck(extraction: LabelExtraction): VerificationCheck {
  const observed = extraction.governmentWarning || extraction.labelText;
  const allEvidence = `${observed}\n${extraction.notes.join("\n")}`;
  const exact = observed.includes(GOVERNMENT_WARNING_TEXT);
  const whitespaceExact = observed.replace(/\s+/g, " ").trim().includes(GOVERNMENT_WARNING_TEXT.replace(/\s+/g, " ").trim());
  const hasAllCapsPrefix = /GOVERNMENT\s+WARNING\s*:/u.test(observed);
  const hasWarningHeading = /GOVERNMENT\s+WARNING\b/iu.test(observed);
  const hasCoreClauses = /pregnancy/i.test(observed) && /drive a car|operate machinery/i.test(observed) && /health problems/i.test(observed);
  const hasImageQualityConcern = IMAGE_QUALITY_PATTERN.test(allEvidence) || extraction.confidence < 0.55;
  const hasLabelAmbiguity = LABEL_AMBIGUITY_PATTERN.test(allEvidence);
  const extractedFactCount = [
    extraction.brandName,
    extraction.classType,
    extraction.alcoholContent,
    extraction.netContents,
    extraction.bottlerAddress,
    extraction.countryOfOrigin,
  ].filter((value) => !isBlank(value)).length;
  const warningCouldBeUnreadable = hasImageQualityConcern && extractedFactCount >= 3;

  let status: CheckStatus = "fail";
  let rationale = "The mandatory health warning text is missing or materially incomplete.";
  if ((exact || whitespaceExact) && hasAllCapsPrefix && hasLabelAmbiguity) {
    status = "needs_review";
    rationale = "The standard warning text appears exact, but the photo contains multiple or overlapping labels, so a reviewer must confirm it belongs to the application product.";
  } else if (exact && hasAllCapsPrefix) {
    status = "pass";
    rationale = "Extracted label evidence includes the exact standard warning text and all-caps prefix.";
  } else if (whitespaceExact && hasAllCapsPrefix) {
    status = "pass";
    rationale = "Extracted label evidence includes the exact standard warning wording after line-wrap normalization and has the all-caps prefix.";
  } else if (hasCoreClauses && hasAllCapsPrefix && hasImageQualityConcern) {
    status = "needs_review";
    rationale = "Core warning clauses and prefix are visible, but image quality or extraction confidence prevents exact statutory punctuation and capitalization verification.";
  } else if (hasWarningHeading && hasImageQualityConcern) {
    status = "needs_review";
    rationale = "Government Warning evidence is visible, but image quality or extraction confidence prevents exact word-for-word verification.";
  } else if (!extraction.governmentWarning && warningCouldBeUnreadable) {
    status = "needs_review";
    rationale = "Core label facts were extracted, but image quality prevents confirming whether the Government Health Warning is absent or just unreadable.";
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
        : status === "needs_review"
          ? "Inspect a clearer label image manually for exact statutory wording, capitalization, and punctuation before approval."
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

function supportedProfileCheck(application: ApplicationData): VerificationCheck | undefined {
  if (application.beverageKind === "spirits" || application.beverageKind === "wine" || application.beverageKind === "beer") return undefined;

  return {
    id: "supported-profile",
    label: "Supported beverage profile",
    status: "fail",
    severity: "blocking",
    requirementRef: REQUIREMENT_REFS.supportedProfile,
    expected: "Distilled spirits, wine, or malt beverage",
    observed: application.beverageKind,
    rationale: "This V1 rule profile does not implement an open-ended commodity profile.",
    guidance: "Select distilled spirits, wine, or beer/malt beverage when the source record matches one of those commodity profiles.",
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
    addFact("classType", "Class / type designation", "blocking", "Class/type is required for a label comparison.", "Add the application class/type designation.");
  }
  if (application.beverageKind === "spirits" && isBlank(application.alcoholContent)) {
    addFact("alcoholContent", "Alcohol content / proof", "blocking", "ABV/proof is required to compare alcohol content.", "Add the application ABV/proof statement.");
  }
  if (isBlank(application.netContents)) {
    addFact("netContents", "Net contents", "blocking", "Net contents is required to compare the container volume.", "Add the application net contents.");
  }
  if (isBlank(application.bottlerAddress)) {
    addFact(
      "bottlerAddress",
      "Bottler / producer address",
      "review",
      "Alcohol beverage labels need a bottler, producer, or importer name and address comparison, but the application fact is absent.",
      "Add the bottler, producer, or importer name and address from the application record.",
    );
  }
  if (application.imported === true && isBlank(application.countryOfOrigin)) {
    addFact(
      "countryOfOrigin",
      "Country of origin",
      "blocking",
      "Imported alcohol beverages need country-of-origin comparison, but the application fact is absent.",
      "Add the country of origin from the application/import record.",
    );
  }

  return facts;
}

function buildWorkflow(checks: VerificationCheck[], facts: MissingApplicationFact[]): VerificationWorkflow {
  const failCount = checks.filter((check) => check.status === "fail").length;
  const reviewCount = checks.filter((check) => check.status === "needs_review").length;
  const warningCount = checks.filter((check) => check.status === "warning").length;
  const deterministicChecks = checks.filter((check) => check.status !== "not_applicable");
  const passCount = deterministicChecks.filter((check) => check.status === "pass").length;
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
    comparisonSummary: `${passCount} of ${deterministicChecks.length} deterministic checks passed; ${failCount} blocking mismatch(es), ${reviewCount} review item(s), ${warningCount} warning(s), ${facts.length} missing application fact(s).`,
    missingApplicationFacts: facts,
    nextSteps,
  };
}

export function verifyLabel(application: ApplicationData, extraction: LabelExtraction, fileName = "label"): VerificationResult {
  const started = Date.now();
  const extractionForComparison = extraction;
  const applicationForComparison = effectiveApplication(application, extractionForComparison);
  const checks: VerificationCheck[] = [
    supportedProfileCheck(applicationForComparison),
    fuzzyCheck("brand-name", "Brand name", applicationForComparison.brandName, extractionForComparison.brandName, {
      severity: "blocking",
      requirementRef: REQUIREMENT_REFS.brandName,
      failGuidance: "Request a corrected label or corrected application record so the brand names agree.",
      reviewGuidance: "Re-run extraction with a clearer image or inspect the label panel that contains the brand name.",
    }),
    classTypeCheck(applicationForComparison.classType, extractionForComparison.classType, applicationForComparison.beverageKind),
    alcoholRequirementCheck(applicationForComparison, extractionForComparison.alcoholContent),
    netContentsCheck(applicationForComparison, extractionForComparison.netContents),
    warningCheck(extractionForComparison),
  ].filter((check): check is VerificationCheck => Boolean(check));

  checks.push(
    ...[
      targetIsolationCheck(extractionForComparison),
      labelPresenceCheck(extractionForComparison),
      ...(applicationForComparison.beverageKind === "spirits"
        ? [
            ageStatementCheck(applicationForComparison, extractionForComparison),
            alcoholFormatCheck(applicationForComparison, extractionForComparison),
            statementOfCompositionCheck(applicationForComparison, extractionForComparison),
            stateOfDistillationCheck(applicationForComparison, extractionForComparison),
            productionStatementCheck(extractionForComparison),
            nameAddressPhraseCheck(applicationForComparison, extractionForComparison),
            importerStatementCheck(applicationForComparison, extractionForComparison),
            sameFieldOfVisionCheck(extractionForComparison),
            approvedClassTypeCheck(applicationForComparison, extractionForComparison),
            classTypeConflictCheck(applicationForComparison, extractionForComparison),
          ]
        : []),
      ...conditionalDisclosureChecks(applicationForComparison, extractionForComparison),
      warningLegibilityCheck(extractionForComparison),
      imageQualityCheck(extractionForComparison),
      structuredEvidenceCheck(extractionForComparison),
    ].filter((check): check is VerificationCheck => Boolean(check)),
  );

  if (applicationForComparison.bottlerAddress) {
    checks.push(fuzzyCheck("bottler-address", "Bottler / producer / importer address", applicationForComparison.bottlerAddress, extractionForComparison.bottlerAddress, {
      severity: "review",
      requirementRef: REQUIREMENT_REFS.bottlerAddress,
      failGuidance: "Request a corrected label or corrected application record so the bottler/importer statement agrees.",
      reviewGuidance: "Inspect the back/side label or source artwork for the bottler, producer, or importer address.",
    }, 0.7, 0.7));
  }
  if (applicationForComparison.countryOfOrigin && isImportedProduct(applicationForComparison)) {
    checks.push(countryOriginCheck(applicationForComparison.countryOfOrigin, extractionForComparison));
  }

  const lowConfidenceCheck = confidenceCheck(extractionForComparison);
  if (lowConfidenceCheck) {
    checks.push(lowConfidenceCheck);
  }

  const facts = missingApplicationFacts(applicationForComparison);
  const workflow = buildWorkflow(checks, facts);
  const failCount = checks.filter((check) => check.status === "fail").length;
  const reviewCount = checks.filter((check) => check.status === "needs_review").length;
  const warningCount = checks.filter((check) => check.status === "warning").length;
  const deterministicChecks = checks.filter((check) => check.status !== "not_applicable");
  const passCount = deterministicChecks.filter((check) => check.status === "pass").length;
  const score = Math.round((passCount / Math.max(deterministicChecks.length, 1)) * 100);
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
        ? `All focused ${applicationForComparison.beverageKind === "spirits" ? "distilled-spirits" : "alcohol beverage"} label fields matched the application.`
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
