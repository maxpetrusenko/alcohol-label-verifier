import type { ApplicationData, BeverageKind } from "./types";

export type FsyedGeneratedFixtureJson = {
  brand_name: string;
  class_type: string;
  abv: string;
  net_contents: string;
  bottler_name: string;
  bottler_address: string;
  country_of_origin: string;
  is_import: boolean;
  description?: string;
  expected_behavior?: string;
  reason?: string;
  aged_years?: string | number;
};

export type ImportedApplication = {
  application: ApplicationData;
  sourceName: string;
  rowNumber?: number;
  fileName?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value.trim()) return value.trim();
    const matchedKey = Object.keys(record).find((candidate) => candidate.toLowerCase().trim() === key.toLowerCase());
    const matchedValue = matchedKey ? stringValue(record[matchedKey]) : "";
    if (matchedValue.trim()) return matchedValue.trim();
  }
  return "";
}

export function beverageKindFromClassType(classType: string): BeverageKind {
  const normalized = classType.toLowerCase();
  if (/\b(beer|lager|ale|stout|porter)\b/u.test(normalized)) return "beer";
  if (/\b(wine|cider|mead|sake)\b/u.test(normalized)) return "wine";
  if (/\b(whiskey|whisky|bourbon|rye|vodka|gin|rum|tequila|mezcal|liqueur|cordial|amaretto|schnapps|absinthe|cognac|brandy|scotch|spirits?)\b/u.test(normalized)) return "spirits";
  return "other";
}

function beverageKindForAlcoholPrototype(classType: string): BeverageKind {
  const inferred = beverageKindFromClassType(classType);
  return inferred === "other" ? "spirits" : inferred;
}

function agedYearsFromRecord(record: Record<string, unknown>): number | undefined {
  const direct = numberValue(record.agedYears ?? record.aged_years ?? record.ageYears ?? record.age_years ?? record.age);
  if (direct !== undefined) return direct;

  const reason = stringValue(record.reason);
  if (/\baged?\s+under\s+4\s+years?\b|\bunder\s+4\s+years?\b/iu.test(reason)) return 2;
  return undefined;
}

export function isJsonLikeUpload(file: { name: string; type: string }) {
  return file.type === "application/json" || /\.json$/iu.test(file.name);
}

export function isCsvLikeUpload(file: { name: string; type: string }) {
  return file.type === "text/csv" || file.type === "application/vnd.ms-excel" || /\.csv$/iu.test(file.name);
}

export function isApplicationImportUpload(file: { name: string; type: string }) {
  return isJsonLikeUpload(file) || isCsvLikeUpload(file);
}

export function applicationFromFsyedFixture(fixture: FsyedGeneratedFixtureJson): ApplicationData {
  const bottlerAddress = [fixture.bottler_name, fixture.bottler_address].filter(Boolean).join(", ");
  const agedYears = agedYearsFromRecord(fixture as unknown as Record<string, unknown>);

  return {
    brandName: fixture.brand_name,
    classType: fixture.class_type,
    alcoholContent: fixture.abv,
    netContents: fixture.net_contents,
    ...(bottlerAddress ? { bottlerAddress } : {}),
    ...(fixture.country_of_origin ? { countryOfOrigin: fixture.country_of_origin } : { countryOfOrigin: "United States" }),
    beverageKind: beverageKindForAlcoholPrototype(fixture.class_type),
    imported: fixture.is_import,
    ...(agedYears !== undefined ? { agedYears } : {}),
  };
}

function applicationFromFsyedRecord(record: Record<string, unknown>): ApplicationData | null {
  const brandName = stringValue(record.brand_name);
  const classType = stringValue(record.class_type);
  const netContents = stringValue(record.net_contents);
  if (!brandName && !classType && !netContents) return null;
  const agedYearsRaw = record.aged_years ?? record.agedYears ?? record.age_years ?? record.ageYears ?? record.age;

  return applicationFromFsyedFixture({
    brand_name: brandName,
    class_type: classType,
    abv: stringValue(record.abv),
    net_contents: netContents,
    bottler_name: stringValue(record.bottler_name),
    bottler_address: stringValue(record.bottler_address),
    country_of_origin: stringValue(record.country_of_origin),
    is_import: record.is_import === true,
    reason: stringValue(record.reason),
    aged_years: typeof agedYearsRaw === "number" ? agedYearsRaw : stringValue(agedYearsRaw),
  });
}

function applicationFromCamelRecord(record: Record<string, unknown>): ApplicationData | null {
  const brandName = stringValue(record.brandName);
  const classType = stringValue(record.classType);
  const netContents = stringValue(record.netContents);
  if (!brandName && !classType && !netContents) return null;
  const agedYears = agedYearsFromRecord(record);

  return {
    brandName,
    classType,
    alcoholContent: stringValue(record.alcoholContent),
    netContents,
    bottlerAddress: stringValue(record.bottlerAddress),
    countryOfOrigin: stringValue(record.countryOfOrigin) || "United States",
    beverageKind: (["spirits", "wine", "beer"].includes(stringValue(record.beverageKind)) ? record.beverageKind : beverageKindForAlcoholPrototype(classType)) as BeverageKind,
    imported: record.imported === true,
    ...(agedYears !== undefined ? { agedYears } : {}),
  };
}

export function applicationFromImportJson(value: unknown): ApplicationData | null {
  if (!isRecord(value)) return null;
  if (isRecord(value.form_data)) return applicationFromFsyedRecord(value.form_data);
  return applicationFromFsyedRecord(value) ?? applicationFromCamelRecord(value);
}

function importedApplicationFromRecord(record: Record<string, unknown>, sourceName: string, rowNumber?: number): ImportedApplication | null {
  const normalized: Record<string, unknown> = {
    brand_name: firstString(record, ["brand_name", "brandName", "brand", "brand name"]),
    class_type: firstString(record, ["class_type", "classType", "class", "type", "class/type", "class or type"]),
    abv: firstString(record, ["abv", "alcoholContent", "alcohol_content", "alcohol", "alcohol by volume"]),
    net_contents: firstString(record, ["net_contents", "netContents", "contents", "net contents", "size"]),
    bottler_name: firstString(record, ["bottler_name", "bottlerName", "bottler", "producer", "importer", "name"]),
    bottler_address: firstString(record, ["bottler_address", "bottlerAddress", "address", "producer address", "importer address"]),
    country_of_origin: firstString(record, ["country_of_origin", "countryOfOrigin", "country", "origin"]),
    is_import: record.is_import === true || /^true|yes|y|1$/iu.test(firstString(record, ["is_import", "imported", "is import"])),
    reason: firstString(record, ["reason", "noncompliance_reason", "notes"]),
    aged_years: firstString(record, ["aged_years", "agedYears", "age_years", "ageYears", "age"]),
  };
  const application = applicationFromFsyedRecord(normalized) ?? applicationFromCamelRecord(record);
  if (!application) return null;
  const fileName = firstString(record, ["file_name", "fileName", "filename", "label_file", "labelFile", "image", "image_file"]);
  return {
    application,
    sourceName,
    ...(rowNumber ? { rowNumber } : {}),
    ...(fileName ? { fileName } : {}),
  };
}

function parseCsvRows(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = values[index] ?? "";
    });
    return record;
  });
}

export function applicationsFromCsvText(text: string, sourceName = "application.csv"): ImportedApplication[] {
  return parseCsvRows(text)
    .map((record, index) => importedApplicationFromRecord(record, sourceName, index + 2))
    .filter((application): application is ImportedApplication => Boolean(application));
}

export function applicationsFromImportJson(value: unknown, sourceName = "application.json"): ImportedApplication[] {
  if (Array.isArray(value)) {
    return value
      .map((record, index) => (isRecord(record) ? importedApplicationFromRecord(record, sourceName, index + 1) : null))
      .filter((application): application is ImportedApplication => Boolean(application));
  }

  if (!isRecord(value)) return [];

  const candidateArrays = [value.rows, value.applications, value.records, value.items, value.labels];
  for (const candidate of candidateArrays) {
    if (Array.isArray(candidate)) return applicationsFromImportJson(candidate, sourceName);
  }

  const application = applicationFromImportJson(value);
  if (!application) return [];
  const fileName = firstString(value, ["file_name", "fileName", "filename", "label_file", "labelFile", "image", "image_file"]);
  return [{ application, sourceName, ...(fileName ? { fileName } : {}) }];
}
