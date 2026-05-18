import { Fragment } from "react";
import { AlertTriangle, BadgeCheck, XCircle } from "lucide-react";
import {
  applicationFromImportJson,
  applicationsFromCsvText,
  applicationsFromImportJson,
  isApplicationImportUpload,
  isCsvLikeUpload,
  type ImportedApplication,
} from "@/lib/applicationImport";
import { isImageLikeUpload } from "@/lib/labelPayload";
import type { ApplicationData, VerificationDecision, VerificationResult } from "@/lib/types";

export const defaultApplication: ApplicationData = {
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
  bottlerAddress: "",
  countryOfOrigin: "United States",
  beverageKind: "spirits",
};

const MAX_VISION_IMAGE_EDGE = 768;
export const VISION_IMAGE_QUALITY = 0.72;

export const fields = [
  ["brandName", "Brand"],
  ["classType", "Class or type"],
  ["alcoholContent", "Alcohol"],
  ["netContents", "Contents"],
  ["bottlerAddress", "Bottler / producer / importer address"],
  ["countryOfOrigin", "Country"],
] as const;

export type FactFieldKey = (typeof fields)[number][0];

export const fieldPlaceholders: Partial<Record<FactFieldKey, string>> = {
  bottlerAddress: "Example: Frostweaver Spirits, Denver, CO",
};

export const selectFieldKeys = new Set<FactFieldKey>(["alcoholContent", "netContents", "countryOfOrigin"]);

export const fieldOptions: Partial<Record<FactFieldKey, string[]>> = {
  classType: [
    "Vodka",
    "Gin",
    "Rum",
    "Brandy",
    "Cognac",
    "Liqueur",
    "Bourbon Whiskey",
    "Straight Bourbon Whiskey",
    "Kentucky Straight Bourbon Whiskey",
    "Rye Whiskey",
    "Scotch Whisky",
    "Irish Whiskey",
    "Tennessee Whiskey",
    "Blanco Tequila",
    "Mezcal",
    "Red Wine",
    "White Wine",
    "Beer",
    "Lager",
    "Ale",
    "Hard Cider",
  ],
  alcoholContent: ["40% Alc./Vol.", "43% Alc./Vol.", "45% Alc./Vol. (90 Proof)", "35% Alc./Vol.", "13.5% Alc./Vol.", "12% Alc./Vol.", "5% Alc./Vol."],
  netContents: ["50 mL", "100 mL", "200 mL", "375 mL", "700 mL", "750 mL", "1 L", "1.75 L", "12 fl oz", "16 fl oz"],
  countryOfOrigin: ["United States", "Mexico", "France", "Italy", "Spain", "Canada", "Ireland", "Scotland", "United Kingdom", "Japan"],
};

export const demoFixtures = {
  pass: "01-pass-01",
  fail: "06-warning-sneaky-01",
} as const;

const DEMO_LABEL_TEXT: Record<(typeof demoFixtures)[keyof typeof demoFixtures], string> = {
  "01-pass-01": [
    "Old Cypress Distillery",
    "Kentucky Straight Bourbon Whiskey",
    "45% Alc./Vol.",
    "750 mL",
    "Distilled and bottled by Old Cypress Distillery, Louisville, KY",
    "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
  ].join("\n"),
  "06-warning-sneaky-01": [
    "Maple Ridge",
    "Bourbon Whiskey",
    "40% Alc./Vol.",
    "750 mL",
    "Distilled and bottled by Ridge Distilling, Burlington, VT",
    "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and could cause health problems.",
  ].join("\n"),
};

export function demoLabelText(id: string) {
  return DEMO_LABEL_TEXT[id as keyof typeof DEMO_LABEL_TEXT];
}

export const reviewerDispositionOptions = [
  { value: "accept_recommendation", label: "Accept recommendation", hint: "Use app result" },
  { value: "request_correction", label: "Request correction", hint: "Send label back" },
  { value: "override", label: "Reject / override", hint: "Reviewer decides" },
  { value: "sme_review", label: "SME review", hint: "Escalate" },
] as const;

export type ReviewerDisposition = (typeof reviewerDispositionOptions)[number]["value"];

export const reviewerReasonOptions = [
  { value: "matches_record", label: "Matches source record" },
  { value: "label_correction", label: "Label correction needed" },
  { value: "source_facts_issue", label: "Source facts issue" },
  { value: "image_quality", label: "Image quality or OCR issue" },
  { value: "policy_interpretation", label: "Policy interpretation" },
  { value: "system_error", label: "System error" },
  { value: "other", label: "Other" },
] as const;

export type ReviewerReasonCode = (typeof reviewerReasonOptions)[number]["value"];

export type Adjudication = {
  resultKey: string;
  labelId?: string;
  fileName: string;
  disposition: ReviewerDisposition;
  reasonCode: ReviewerReasonCode | "";
  note: string;
  recommendationDecision: VerificationDecision;
  reviewerDecision?: VerificationDecision;
  isComplete: boolean;
  updatedAt: string;
};

export type AdjudicationUpdate = Partial<Pick<Adjudication, "disposition" | "reasonCode" | "note" | "reviewerDecision">>;

export type KnownEvalFixture = {
  application: ApplicationData;
  labelText?: string;
};

export function optionListId(key: FactFieldKey) {
  return fieldOptions[key] ? `options-${key}` : undefined;
}

export function decisionIcon(decision?: VerificationResult["decision"]) {
  if (decision === "approved") return <BadgeCheck aria-hidden className="decision-icon pass" />;
  if (decision === "rejected") return <XCircle aria-hidden className="decision-icon fail" />;
  return <AlertTriangle aria-hidden className="decision-icon review" />;
}

function statusLabel(status: string) {
  if (status === "pass") return "PASS";
  if (status === "fail") return "FAIL";
  if (status === "needs_review") return "REVIEW";
  if (status === "warning") return "WARN";
  if (status === "not_applicable") return "N/A";
  return status.replace("_", " ").toUpperCase();
}

export function rowStatusLabel(row: { status: string; severity: string }) {
  return statusLabel(row.status);
}

function diffToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function labelEvidenceContent(row: { id: string; expected: string; observed: string; status: string }) {
  const observed = row.observed || "Not found";
  if (row.id !== "government-warning" || row.status === "pass" || !row.expected || !row.observed) return observed;

  const expectedWords = row.expected.split(/\s+/).map(diffToken);
  let wordIndex = 0;
  let offset = 0;
  return observed.split(/(\s+)/).map((part) => {
    const key = `${offset}:${part}`;
    offset += part.length;
    if (/^\s+$/u.test(part)) return <Fragment key={key}>{part}</Fragment>;
    const differs = diffToken(part) !== expectedWords[wordIndex];
    wordIndex += 1;
    return differs ? (
      <mark className="diff-word" key={key}>
        {part}
      </mark>
    ) : (
      <Fragment key={key}>{part}</Fragment>
    );
  });
}

export function rowReason(row: { id: string; label: string; expected: string; observed: string; status: string; rationale: string; guidance?: string }) {
  if (row.status === "pass") return "";
  if (row.status === "needs_review" && !row.observed) {
    return `Could not read ${row.label.toLowerCase()} from the label image. Upload a clearer image or inspect that label area manually.`;
  }
  if (row.id === "government-warning" && row.observed) {
    if (!/^GOVERNMENT\s+WARNING\s*:/u.test(row.observed)) {
      return 'Government Health Warning prefix must be exactly "GOVERNMENT WARNING:" in all caps.';
    }
    return "Government Health Warning must match the statutory wording exactly. Correct the highlighted word or punctuation before approval.";
  }
  const mismatchReasons: Record<string, string> = {
    "brand-name": "Brand name on the label does not match the application record.",
    "class-type": row.rationale.includes("fanciful name")
      ? "Application and label both show this text, but it is a fanciful name, not a legal class/type. Add the legal designation, such as Vodka, Rum, Whiskey, or Liqueur."
      : "Class/type on the label does not match the application record.",
    "alcohol-content": "Alcohol content or proof on the label does not match the application record.",
    "net-contents": row.expected === row.observed
      ? "Net contents match the application, but this container size is not authorized for this beverage profile."
      : "Net contents on the label do not match the application record.",
    "bottler-address": "Bottler, producer, or importer statement on the label does not match the application record.",
    "country-origin": "Country of origin on the label is missing or does not match the imported product record.",
    "target-isolation": "This image does not isolate one target product label, so the app may compare the wrong label.",
    "supported-profile": "This source record selected an unsupported beverage profile. Choose distilled spirits, wine, or beer.",
    "alcohol-content-profile": "Alcohol content could not be checked because this beverage profile has conditional ABV rules.",
  };
  if (row.status === "fail" && mismatchReasons[row.id]) return mismatchReasons[row.id];
  if (row.status === "needs_review" && mismatchReasons[row.id]) return mismatchReasons[row.id];
  return row.guidance || row.rationale;
}

export function dispositionLabel(disposition: ReviewerDisposition) {
  return reviewerDispositionOptions.find((option) => option.value === disposition)?.label ?? disposition;
}

export function reasonCodeLabel(reasonCode: ReviewerReasonCode | "") {
  return reviewerReasonOptions.find((option) => option.value === reasonCode)?.label ?? "";
}

export function dispositionNeedsReason(disposition?: ReviewerDisposition) {
  return disposition === "request_correction" || disposition === "override" || disposition === "sme_review";
}

export function isAdjudicationComplete(adjudication: Pick<Adjudication, "disposition" | "reasonCode" | "note" | "reviewerDecision">) {
  if (adjudication.disposition === "accept_recommendation") return true;
  if (adjudication.disposition === "override" && !adjudication.reviewerDecision) return false;
  return Boolean(adjudication.reasonCode && adjudication.note.trim());
}

export function defaultReviewerDecision(disposition: ReviewerDisposition, recommendationDecision: VerificationDecision) {
  if (disposition === "accept_recommendation") return recommendationDecision;
  if (disposition !== "override") return undefined;
  return recommendationDecision === "approved" ? "rejected" : "approved";
}

export function adjudicationResultKey(
  result?: Pick<VerificationResult, "fileName" | "decision" | "score" | "checks">,
  label?: { fileName?: string },
) {
  const fileName = result?.fileName ?? label?.fileName ?? "single-label";
  const resultFingerprint = result ? `${result.decision}:${result.score}:${result.checks.map((check) => `${check.id}:${check.status}`).join(",")}` : "pending";
  return `${fileName}::${resultFingerprint}`;
}

const ADJUDICATION_STORAGE_PREFIX = "labelcheck:reviewer-disposition:v1:";

function localStorageKey(resultKey: string) {
  return `${ADJUDICATION_STORAGE_PREFIX}${encodeURIComponent(resultKey)}`;
}

function isReviewerDisposition(value: unknown): value is ReviewerDisposition {
  return reviewerDispositionOptions.some((option) => option.value === value);
}

function isReasonCode(value: unknown): value is ReviewerReasonCode | "" {
  return value === "" || reviewerReasonOptions.some((option) => option.value === value);
}

function isVerificationDecision(value: unknown): value is VerificationDecision {
  return value === "approved" || value === "needs_review" || value === "rejected";
}

export function readStoredAdjudication(resultKey: string) {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(localStorageKey(resultKey));
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<Adjudication>;
    if (!isReviewerDisposition(value.disposition) || !isReasonCode(value.reasonCode) || !isVerificationDecision(value.recommendationDecision) || !value.fileName) {
      return undefined;
    }
    const adjudication: Adjudication = {
      resultKey,
      fileName: value.fileName,
      disposition: value.disposition,
      reasonCode: value.reasonCode,
      note: typeof value.note === "string" ? value.note : "",
      recommendationDecision: value.recommendationDecision,
      reviewerDecision: isVerificationDecision(value.reviewerDecision) ? value.reviewerDecision : undefined,
      isComplete: false,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
      ...(typeof value.labelId === "string" ? { labelId: value.labelId } : {}),
    };
    return { ...adjudication, isComplete: isAdjudicationComplete(adjudication) };
  } catch {
    return undefined;
  }
}

export function writeStoredAdjudication(adjudication: Adjudication) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localStorageKey(adjudication.resultKey), JSON.stringify(adjudication));
}

export function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

type DroppedEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (success: (file: File) => void, failure?: (error: DOMException) => void) => void;
  createReader?: () => {
    readEntries: (success: (entries: DroppedEntry[]) => void, failure?: (error: DOMException) => void) => void;
  };
};

type DroppedDataTransferItem = DataTransferItem & {
  webkitGetAsEntry?: () => DroppedEntry | null;
};

function isSupportedUpload(file: File) {
  return isImageLikeUpload(file) || isApplicationImportUpload(file);
}

function fileFromEntry(entry: DroppedEntry) {
  return new Promise<File | null>((resolve) => {
    if (!entry.file) {
      resolve(null);
      return;
    }

    entry.file((file) => resolve(isSupportedUpload(file) ? file : null), () => resolve(null));
  });
}

async function filesFromEntry(entry: DroppedEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = await fileFromEntry(entry);
    return file ? [file] : [];
  }

  if (!entry.isDirectory || !entry.createReader) return [];

  const reader = entry.createReader();
  const files: File[] = [];

  async function readAllEntries(): Promise<void> {
    const entries = await new Promise<DroppedEntry[]>((resolve) => {
      reader.readEntries(resolve, () => resolve([]));
    });
    if (!entries.length) return;
    const nested = await Promise.all(entries.map(filesFromEntry));
    files.push(...nested.flat());
    await readAllEntries();
  }

  await readAllEntries();
  return files;
}

export async function filesFromDrop(dataTransfer: DataTransfer) {
  const entries: DroppedEntry[] = [];
  for (const item of [...dataTransfer.items]) {
    const entry = (item as DroppedDataTransferItem).webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  if (entries.length) {
    const files = await Promise.all(entries.map(filesFromEntry));
    return files.flat();
  }

  return [...dataTransfer.files].filter(isSupportedUpload);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsText(file);
  });
}

function basename(fileName: string) {
  return fileName.replace(/\.[^.]+$/u, "");
}

function normalizedFileKey(fileName?: string) {
  return basename(fileName ?? "").toLowerCase().replace(/[^a-z0-9]+/gu, "");
}

export function applicationForLabel(
  label: { fileName: string },
  index: number,
  application: ApplicationData,
  importedApplications: ImportedApplication[],
): ApplicationData | null {
  if (importedApplications.length <= 1) return importedApplications[0]?.application ?? application;
  const labelKey = normalizedFileKey(label.fileName);
  const matched = importedApplications.find((row) => {
    const rowKey = normalizedFileKey(row.fileName);
    return rowKey && (rowKey === labelKey || labelKey.includes(rowKey) || rowKey.includes(labelKey));
  });
  return matched?.application ?? importedApplications[index]?.application ?? null;
}

export async function applicationsFromImportFile(file: File): Promise<ImportedApplication[]> {
  const text = await readFileAsText(file);
  return isCsvLikeUpload(file) ? applicationsFromCsvText(text, file.name) : applicationsFromImportJson(JSON.parse(text), file.name);
}

export async function knownEvalFixtureFromImage(imageFile: File): Promise<KnownEvalFixture | null> {
  const id = basename(imageFile.name);
  const candidateUrls = [];
  if (/^(?:0[1-6])-[a-z]+(?:-[a-z]+)?-\d{2}$/iu.test(id)) candidateUrls.push(`/evals/fixtures/spirits-generated-canonical/${id}.json`);
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/iu.test(id)) {
    candidateUrls.push(`/evals/fixtures/spirits-rendered-regression/${id}.json`);
    candidateUrls.push(`/evals/fixtures/wine-rendered-canonical/${id}.json`);
    candidateUrls.push(`/evals/fixtures/wine-nano-fail-review/${id}.json`);
  }

  const fixtures = await Promise.all(
    candidateUrls.map(async (url) => {
      const response = await fetch(url, { cache: "no-store" });
      return response.ok ? response.json() : null;
    }),
  );

  for (const fixture of fixtures) {
    if (!fixture) continue;
    const application = applicationFromImportJson(fixture);
    if (application) {
      const labelText =
        typeof fixture.labelVisibleText === "string" ? fixture.labelVisibleText : typeof fixture.labelText === "string" ? fixture.labelText : demoLabelText(id);
      return { application, ...(labelText ? { labelText } : {}) };
    }
  }

  return null;
}

export function drawScaledImage(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, MAX_VISION_IMAGE_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function optimizedImageDataUrl(file: File) {
  const original = await readFileAsDataUrl(file);
  if (file.type === "image/gif") return { dataUrl: original, mimeType: file.type };

  return new Promise<{ dataUrl: string; mimeType: string }>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = drawScaledImage(image, image.naturalWidth, image.naturalHeight);
      if (!canvas) {
        resolve({ dataUrl: original, mimeType: file.type });
        return;
      }
      resolve({ dataUrl: canvas.toDataURL("image/jpeg", VISION_IMAGE_QUALITY), mimeType: "image/jpeg" });
    };
    image.onerror = () => resolve({ dataUrl: original, mimeType: file.type });
    image.src = original;
  });
}
