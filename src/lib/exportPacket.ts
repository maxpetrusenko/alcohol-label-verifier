import packageJson from "../../package.json";

const EXPORT_PACKET_SCHEMA_VERSION = "1.0";

const RAW_IMAGE_FIELDS = [
  "dataUrl",
  "data_url",
  "imageDataUrl",
  "image_data_url",
  "rawImage",
  "raw_image",
  "rawImageBytes",
  "raw_image_bytes",
  "imageBytes",
  "image_bytes",
  "imageBase64",
  "image_base64",
];

const RAW_IMAGE_FIELD_NAMES = new Set(RAW_IMAGE_FIELDS.map((field) => field.toLowerCase()));

type RecordValue = Record<string, unknown>;

export type ExportBatch = {
  batchId?: unknown;
  application?: unknown;
  results: unknown[];
  meta?: unknown;
  adjudications?: unknown;
  reviewerDispositions?: unknown;
  dispositions?: unknown;
  [key: string]: unknown;
};

export type RawImagePolicy = {
  mode: "excluded";
  excludedByDefault: true;
  excludedFields: string[];
};

export type ExportPacket = {
  requestId: string;
  packetType: "labelcheck.review_packet";
  schemaVersion: string;
  exportedAt: string;
  appVersion?: string;
  batchId: unknown;
  application: unknown;
  results: unknown[];
  adjudications?: unknown;
  reviewerDispositions?: unknown;
  dispositions?: unknown;
  rawImagePolicy: RawImagePolicy;
  batch: ExportBatch;
};

type ReviewerReview = {
  disposition?: unknown;
  reason?: unknown;
  note?: unknown;
};

const rawImagePolicy: RawImagePolicy = {
  mode: "excluded",
  excludedByDefault: true,
  excludedFields: RAW_IMAGE_FIELDS,
};

export function defaultAppVersion(): string | undefined {
  return typeof packageJson.version === "string" && packageJson.version.trim() ? packageJson.version : undefined;
}

export function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRawImageString(value: unknown): boolean {
  return typeof value === "string" && /^data:image\/[a-z0-9.+-]+;base64,/iu.test(value);
}

function scrubRawImageBytes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubRawImageBytes);
  if (!isRecord(value)) return value;

  const entries: Array<[string, unknown]> = [];
  for (const [key, item] of Object.entries(value)) {
    if (RAW_IMAGE_FIELD_NAMES.has(key.toLowerCase()) || isRawImageString(item)) continue;
    entries.push([key, scrubRawImageBytes(item)]);
  }
  return Object.fromEntries(entries);
}

function firstDefined(record: RecordValue, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") return record[key];
  }
  return undefined;
}

function normalizeReviewerReview(value: unknown): ReviewerReview | undefined {
  if (typeof value === "string") return { disposition: value };
  if (!isRecord(value)) return undefined;

  const review = {
    disposition: firstDefined(value, ["disposition", "decision", "status"]),
    reason: firstDefined(value, ["reason", "reasonCode", "overrideReason"]),
    note: firstDefined(value, ["note", "notes", "comment", "comments", "reviewerNote"]),
  };

  return Object.values(review).some((item) => item !== undefined) ? review : undefined;
}

function resultKeys(result: unknown): string[] {
  if (!isRecord(result)) return [];
  return [result.labelId, result.fileName, result.id, result.resultId].filter((value): value is string => typeof value === "string" && value.length > 0);
}

function reviewFromCollection(collection: unknown, keys: string[]): ReviewerReview | undefined {
  if (!keys.length) return undefined;
  const keySet = new Set(keys);

  if (isRecord(collection)) {
    for (const key of keys) {
      const review = normalizeReviewerReview(collection[key]);
      if (review) return review;
    }
  }

  if (Array.isArray(collection)) {
    for (const item of collection) {
      if (!isRecord(item)) continue;
      const itemKeys = resultKeys(item);
      if (itemKeys.some((key) => keySet.has(key))) {
        const review = normalizeReviewerReview(item);
        if (review) return review;
      }
    }
  }

  return undefined;
}

function reviewerReviewForResult(batch: Pick<ExportBatch, "adjudications" | "reviewerDispositions" | "dispositions">, result: unknown) {
  const directReview = isRecord(result)
    ? normalizeReviewerReview(result.adjudication) ??
      normalizeReviewerReview(result.reviewerDisposition) ??
      normalizeReviewerReview(result.reviewer) ??
      normalizeReviewerReview(result.review) ??
      normalizeReviewerReview(result.disposition)
    : undefined;
  if (directReview) return directReview;

  const keys = resultKeys(result);
  return (
    reviewFromCollection(batch.adjudications, keys) ??
    reviewFromCollection(batch.reviewerDispositions, keys) ??
    reviewFromCollection(batch.dispositions, keys)
  );
}

export function buildExportBatch(rawBatch: unknown): ExportBatch {
  const batch = isRecord(rawBatch) ? rawBatch : {};
  const results = Array.isArray(batch.results) ? batch.results : [];
  return scrubRawImageBytes({ ...batch, results }) as ExportBatch;
}

export function buildExportPacket(batch: ExportBatch, requestId: string, exportedAt = new Date().toISOString()): ExportPacket {
  const appVersion = defaultAppVersion();
  return {
    requestId,
    packetType: "labelcheck.review_packet",
    schemaVersion: EXPORT_PACKET_SCHEMA_VERSION,
    exportedAt,
    ...(appVersion ? { appVersion } : {}),
    batchId: batch.batchId ?? null,
    application: batch.application ?? null,
    results: batch.results,
    ...(batch.adjudications !== undefined ? { adjudications: batch.adjudications } : {}),
    ...(batch.reviewerDispositions !== undefined ? { reviewerDispositions: batch.reviewerDispositions } : {}),
    ...(batch.dispositions !== undefined ? { dispositions: batch.dispositions } : {}),
    rawImagePolicy,
    batch,
  };
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function checkCount(result: unknown, status: string): number {
  if (!isRecord(result) || !Array.isArray(result.checks)) return 0;
  return result.checks.filter((check) => isRecord(check) && check.status === status).length;
}

function resultValue(result: unknown, key: string): unknown {
  return isRecord(result) ? result[key] : undefined;
}

export function resultsToCsv(batch: ExportBatch): string {
  const hasReviewerReview = batch.results.some((result) => reviewerReviewForResult(batch, result));
  const headers = ["labelId", "fileName", "decision", ...(hasReviewerReview ? ["disposition", "reason", "note"] : []), "score", "passChecks", "warningChecks", "reviewChecks", "failChecks", "summary"];
  const rows = [
    headers,
    ...batch.results.map((result) => {
      const review = reviewerReviewForResult(batch, result);
      return [
        resultValue(result, "labelId"),
        resultValue(result, "fileName"),
        resultValue(result, "decision"),
        ...(hasReviewerReview ? [review?.disposition, review?.reason, review?.note] : []),
        resultValue(result, "score"),
        checkCount(result, "pass"),
        checkCount(result, "warning"),
        checkCount(result, "needs_review"),
        checkCount(result, "fail"),
        resultValue(result, "summary"),
      ];
    }),
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}
