import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applicationFromImportJson, applicationsFromCsvText, applicationsFromImportJson } from "./applicationImport";

const repoRoot = process.cwd();

describe("application import", () => {
  it("imports fsyed generated fixture JSON as application facts", () => {
    expect(
      applicationFromImportJson({
        brand_name: "Wrong Brand Name",
        class_type: "Tennessee Whiskey",
        abv: "40% Alc./Vol.",
        net_contents: "750 mL",
        bottler_name: "Smoky Hollow Distillery",
        bottler_address: "Nashville, TN",
        country_of_origin: "",
        is_import: false,
      }),
    ).toEqual({
      brandName: "Wrong Brand Name",
      classType: "Tennessee Whiskey",
      alcoholContent: "40% Alc./Vol.",
      netContents: "750 mL",
      bottlerAddress: "Smoky Hollow Distillery, Nashville, TN",
      countryOfOrigin: "United States",
      beverageKind: "spirits",
      imported: false,
    });
  });

  it("imports manifest rows with nested form_data", () => {
    const application = applicationFromImportJson({
      form_data: {
        brand_name: "Smoky Hollow",
        class_type: "Tennessee Whiskey",
        abv: "40% Alc./Vol.",
        net_contents: "750 mL",
        bottler_name: "Smoky Hollow Distillery",
        bottler_address: "Nashville, TN",
        country_of_origin: "",
        is_import: false,
      },
    });

    expect(application?.brandName).toBe("Smoky Hollow");
    expect(application?.countryOfOrigin).toBe("United States");
  });

  it("maps amaretto and non-standard fixture class text to the spirits prototype profile", () => {
    expect(
      applicationFromImportJson({
        brand_name: "Bella Notte",
        class_type: "Amaretto",
        abv: "28% Alc./Vol.",
        net_contents: "750 mL",
        bottler_name: "Bella Spirits",
        bottler_address: "New York, NY",
        country_of_origin: "",
        is_import: false,
      })?.beverageKind,
    ).toBe("spirits");

    expect(
      applicationFromImportJson({
        brand_name: "Ocean Breeze",
        class_type: "Ocean Breeze",
        abv: "40% Alc./Vol.",
        net_contents: "750 mL",
        bottler_name: "Breeze Spirits",
        bottler_address: "Miami, FL",
        country_of_origin: "",
        is_import: false,
      })?.beverageKind,
    ).toBe("spirits");
  });

  it("imports many CSV source fact rows for batch review", () => {
    const rows = applicationsFromCsvText(`file_name,brand,class_type,abv,net_contents,bottler,address,country,imported
front-a.png,Smoky Hollow,Tennessee Whiskey,40% Alc./Vol.,750 mL,Smoky Hollow Distillery,"Nashville, TN",United States,false
front-b.png,Highland Crest,Scotch Whisky,40% Alc./Vol.,700 mL,Highland Crest Imports,"New York, NY",Scotland,true`);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      fileName: "front-a.png",
      rowNumber: 2,
      application: {
        brandName: "Smoky Hollow",
        classType: "Tennessee Whiskey",
        beverageKind: "spirits",
      },
    });
    expect(rows[1]).toMatchObject({
      fileName: "front-b.png",
      application: {
        countryOfOrigin: "Scotland",
        imported: true,
      },
    });
  });

  it("imports JSON arrays for batch review", () => {
    const rows = applicationsFromImportJson([
      {
        fileName: "label-1.png",
        brandName: "Frostweaver",
        classType: "Vodka",
        alcoholContent: "40% Alc./Vol.",
        netContents: "1000 mL",
      },
      {
        file_name: "label-2.png",
        brand_name: "Island Bounty",
        class_type: "Spiced Rum",
        abv: "40% Alc./Vol.",
        net_contents: "750 mL",
      },
    ]);

    expect(rows.map((row) => row.fileName)).toEqual(["label-1.png", "label-2.png"]);
    expect(rows.map((row) => row.application.brandName)).toEqual(["Frostweaver", "Island Bounty"]);
  });

  it("imports the generated bulk fixture source facts file", () => {
    const bulkPath = join(repoRoot, "public/evals/fixtures/generated/bulk-application-facts.json");
    const rows = applicationsFromImportJson(JSON.parse(readFileSync(bulkPath, "utf8")), "bulk-application-facts.json");
    const mismatch = rows.find((row) => row.fileName === "02-mismatch-01.png");
    const youngWhisky = rows.find((row) => row.fileName === "04-noncompliant-06.png");

    expect(rows).toHaveLength(60);
    expect(mismatch?.application.brandName).toBe("Wrong Brand Name");
    expect(mismatch?.application.classType).toBe("Tennessee Whiskey");
    expect(youngWhisky?.application.agedYears).toBe(2);
  });
});
