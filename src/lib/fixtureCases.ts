import { applicationFromFsyedFixture, type FsyedGeneratedFixtureJson } from "./applicationImport";
import type { ApplicationData, VerificationDecision } from "./types";

const GENERATED_FIXTURE_PUBLIC_PATH = "/evals/fixtures/spirits-generated-canonical";

export type FixtureCategory = "pass" | "mismatch" | "label_noncompliant" | "matching_noncompliant" | "warning_bad" | "warning_sneaky";

export type FixtureCase = {
  id: string;
  title: string;
  category: FixtureCategory;
  description: string;
  expectedBehavior: string;
  expectedDecision: VerificationDecision;
  publicImagePath: string;
  publicJsonPath: string;
  labelText?: string;
  application: ApplicationData;
  source: {
    repository: "fsyeddev-ttb-label";
    sourceDirectory: "evals/fixtures/spirits-generated-canonical";
    fixtureId: string;
  };
  caveat?: string;
};

function fixturePaths(id: string) {
  return {
    publicImagePath: `${GENERATED_FIXTURE_PUBLIC_PATH}/${id}.png`,
    publicJsonPath: `${GENERATED_FIXTURE_PUBLIC_PATH}/${id}.json`,
  };
}

function defineFixtureCase(
  id: string,
  category: FixtureCategory,
  title: string,
  raw: FsyedGeneratedFixtureJson,
  expectedDecision: VerificationDecision,
  labelText?: string,
  caveat?: string,
): FixtureCase {
  return {
    id,
    title,
    category,
    description: raw.description ?? title,
    expectedBehavior: raw.expected_behavior ?? raw.reason ?? "See upstream manifest for expected behavior.",
    expectedDecision,
    ...fixturePaths(id),
    ...(labelText ? { labelText } : {}),
    application: applicationFromFsyedFixture(raw),
    source: {
      repository: "fsyeddev-ttb-label",
      sourceDirectory: "evals/fixtures/spirits-generated-canonical",
      fixtureId: id,
    },
    ...(caveat ? { caveat } : {}),
  };
}

const GOVERNMENT_WARNING_TEXT =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

/*
 * Fixture attribution:
 * Generated label images and JSON form records copied from
 * /Users/maxpetrusenko/Desktop/Projects/oss/fsyeddev-ttb-label/evals/fixtures/spirits-generated-canonical.
 * The upstream per-case JSON is application/form data; label-visible text is in the PNG
 * and in manifest.json image prompts, so OCR/vision extraction is still needed for UI runs.
 */
export const fixtureCases = [
  defineFixtureCase(
    "01-pass-01",
    "pass",
    "Clean bourbon approval",
    {
      brand_name: "Old Cypress Distillery",
      class_type: "Kentucky Straight Bourbon Whiskey",
      abv: "45% Alc./Vol.",
      net_contents: "750 mL",
      bottler_name: "Old Cypress Distillery",
      bottler_address: "Louisville, KY",
      country_of_origin: "",
      is_import: false,
    },
    "approved",
    `Old Cypress Distillery
Kentucky Straight Bourbon Whiskey
45% Alc./Vol.
750 mL
Distilled and bottled by Old Cypress Distillery, Louisville, KY
${GOVERNMENT_WARNING_TEXT}`,
  ),
  defineFixtureCase(
    "01-pass-02",
    "pass",
    "Scotch approval fixture",
    {
      brand_name: "Highland Crest",
      class_type: "Scotch Whisky",
      abv: "40% Alc./Vol.",
      net_contents: "700 mL",
      bottler_name: "Highland Crest Imports",
      bottler_address: "New York, NY",
      country_of_origin: "Scotland",
      is_import: true,
    },
    "approved",
    `Highland Crest
Scotch Whisky
40% Alc./Vol.
700 mL
Imported by Highland Crest Imports, New York, NY
Product of Scotland
${GOVERNMENT_WARNING_TEXT}`,
  ),
  defineFixtureCase(
    "01-pass-03",
    "pass",
    "Frostweaver vodka approval",
    {
      brand_name: "Frostweaver",
      class_type: "Vodka",
      abv: "40% Alc./Vol.",
      net_contents: "1000 mL",
      bottler_name: "Frostweaver Spirits",
      bottler_address: "Denver, CO",
      country_of_origin: "",
      is_import: false,
      description: "Clean, fully compliant Vodka",
      expected_behavior: "All fields pass, including bottler/producer address.",
    },
    "approved",
    `Frostweaver
Vodka
40% Alc./Vol.
1000 mL
Produced and bottled by Frostweaver Spirits, Denver, CO
${GOVERNMENT_WARNING_TEXT}`,
  ),
  defineFixtureCase(
    "02-mismatch-01",
    "mismatch",
    "Brand mismatch rejection",
    {
      brand_name: "Wrong Brand Name",
      class_type: "Tennessee Whiskey",
      abv: "40% Alc./Vol.",
      net_contents: "750 mL",
      bottler_name: "Smoky Hollow Distillery",
      bottler_address: "Nashville, TN",
      country_of_origin: "",
      is_import: false,
      description: "JSON wrong brand name, label correct",
      expected_behavior: "FAIL on cross-validation (Brand mismatch)",
    },
    "rejected",
    `Smoky Hollow
Tennessee Whiskey
40% Alc./Vol.
750 mL
Distilled and bottled by Smoky Hollow Distillery, Nashville, TN
${GOVERNMENT_WARNING_TEXT}`,
  ),
  defineFixtureCase(
    "02-mismatch-03",
    "mismatch",
    "ABV mismatch rejection",
    {
      brand_name: "Island Bounty",
      class_type: "Spiced Rum",
      abv: "35% Alc./Vol.",
      net_contents: "750 mL",
      bottler_name: "Island Bounty Co.",
      bottler_address: "Key West, FL",
      country_of_origin: "",
      is_import: false,
      description: "JSON wrong ABV, label correct",
      expected_behavior: "FAIL on cross-validation (ABV mismatch)",
    },
    "rejected",
    `Island Bounty
Spiced Rum
Rum with natural spices
40% Alc./Vol.
750 mL
Produced and bottled by Island Bounty Co., Key West, FL
${GOVERNMENT_WARNING_TEXT}`,
  ),
  defineFixtureCase(
    "03-noncompliant-01",
    "label_noncompliant",
    "Non-approved bottle size",
    {
      brand_name: "Crestview",
      class_type: "Vodka",
      abv: "40% Alc./Vol.",
      net_contents: "800 mL",
      bottler_name: "Crestview Spirits",
      bottler_address: "Denver, CO",
      country_of_origin: "",
      is_import: false,
      description: "Label non-compliant: non-approved bottle size (800 mL)",
      expected_behavior: "FAIL compliance (Net contents 800 mL not approved)",
    },
    "rejected",
    `Crestview
Vodka
40% Alc./Vol.
800 mL
Produced and bottled by Crestview Spirits, Denver, CO
${GOVERNMENT_WARNING_TEXT}`,
    "Current ApplicationData carries net contents but does not encode bottle-size approval tables.",
  ),
  defineFixtureCase(
    "04-noncompliant-12",
    "matching_noncompliant",
    "Missing state of distillation",
    {
      brand_name: "Iron Horse",
      class_type: "Straight Bourbon Whiskey",
      abv: "45% Alc./Vol.",
      net_contents: "750 mL",
      bottler_name: "Iron Horse Distillers",
      bottler_address: "Chicago, IL",
      country_of_origin: "",
      is_import: false,
      description: "Non-compliant matching JSON: missing state of distillation on Straight Bourbon",
      expected_behavior: "FAIL Straight whiskies require a state of distillation on the label.",
    },
    "rejected",
    `Iron Horse
Straight Bourbon Whiskey
45% Alc./Vol.
750 mL
Distilled and bottled by Iron Horse Distillers, Chicago, IL
${GOVERNMENT_WARNING_TEXT}`,
    "Current ApplicationData has no dedicated field for regulatory reason metadata.",
  ),
  defineFixtureCase(
    "05-warning-bad-01",
    "warning_bad",
    "Missing government warning",
    {
      brand_name: "Ghost Pine",
      class_type: "Gin",
      abv: "45% Alc./Vol.",
      net_contents: "750 mL",
      bottler_name: "Ghost Pine Spirits",
      bottler_address: "Savannah, GA",
      country_of_origin: "",
      is_import: false,
      description: "Government warning completely missing",
      expected_behavior: "FAIL compliance (Government warning missing)",
    },
    "rejected",
    `Ghost Pine
Gin
45% Alc./Vol.
750 mL
Produced and bottled by Ghost Pine Spirits, Savannah, GA`,
  ),
  defineFixtureCase(
    "06-warning-sneaky-01",
    "warning_sneaky",
    "Near-miss government warning",
    {
      brand_name: "Maple Ridge",
      class_type: "Bourbon Whiskey",
      abv: "40% Alc./Vol.",
      net_contents: "750 mL",
      bottler_name: "Ridge Distilling",
      bottler_address: "Burlington, VT",
      country_of_origin: "",
      is_import: false,
      description: "Sneaky warning: 'could cause' instead of 'may cause'",
      expected_behavior: "FAIL compliance (Exact warning text mismatch)",
    },
    "rejected",
    `Maple Ridge
Bourbon Whiskey
40% Alc./Vol.
750 mL
Produced and bottled by Ridge Distilling, Burlington, VT
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and could cause health problems.`,
  ),
] as const satisfies readonly FixtureCase[];

export const fixtureCasesById = Object.fromEntries(fixtureCases.map((fixture) => [fixture.id, fixture])) as Record<
  (typeof fixtureCases)[number]["id"],
  (typeof fixtureCases)[number]
>;
