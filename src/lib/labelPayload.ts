import type { ApplicationData, VerificationResult } from "./types";

export type PendingLabel = {
  labelId?: string;
  fileName: string;
  mimeType?: string;
  dataUrl?: string;
  text?: string;
  application?: ApplicationData;
};

export const MAX_LABEL_BATCH = 300;
export const VERIFY_REQUEST_LABEL_LIMIT = 25;

export function batchLimitError(count: number) {
  return count > MAX_LABEL_BATCH ? `Batch limit is ${MAX_LABEL_BATCH} labels. Select ${MAX_LABEL_BATCH} or fewer files.` : null;
}

export function isImageLikeUpload(file: { name: string; type: string }) {
  return file.type.startsWith("image/") || /\.(avif|gif|heic|jpe?g|png|webp)$/iu.test(file.name);
}

export function chunkVerificationLabels(labels: PendingLabel[], chunkSize = VERIFY_REQUEST_LABEL_LIMIT): PendingLabel[][] {
  const chunks: PendingLabel[][] = [];
  for (let start = 0; start < labels.length; start += chunkSize) {
    chunks.push(labels.slice(start, start + chunkSize));
  }
  return chunks;
}

export type IndexedVerificationChunk = {
  start: number;
  labels: PendingLabel[];
};

export function chunkVerificationLabelsWithIndex(labels: PendingLabel[], chunkSize = VERIFY_REQUEST_LABEL_LIMIT): IndexedVerificationChunk[] {
  const chunks: IndexedVerificationChunk[] = [];
  for (let start = 0; start < labels.length; start += chunkSize) {
    chunks.push({ start, labels: labels.slice(start, start + chunkSize) });
  }
  return chunks;
}

const BATCH_FAILURE_REF = {
  id: "labelcheck-batch-verification",
  label: "Batch verification request",
  source: "LabelCheck review workflow",
  url: "https://cola.maxpetrusenko.com",
};

function cleanBatchFailureMessage(message: string) {
  return message.replace(/\s+/g, " ").trim() || "Verification request failed.";
}

export function batchFailureResult(label: PendingLabel, message: string, elapsedMs = 0): VerificationResult {
  const detail = cleanBatchFailureMessage(message);
  return {
    labelId: label.labelId,
    fileName: label.fileName,
    decision: "needs_review",
    score: 0,
    elapsedMs,
    extraction: {
      labelText: label.text ?? "",
      confidence: 0,
      notes: [`Verification request failed for this label: ${detail}`],
    },
    checks: [
      {
        id: "batch-request",
        label: "Verification request",
        status: "needs_review",
        severity: "blocking",
        requirementRef: BATCH_FAILURE_REF,
        expected: "Completed extraction and rules check",
        observed: "Request failed",
        rationale: `This label stayed in the batch, but its request did not complete: ${detail}`,
        guidance: "Retry this label, or split the batch if the network or provider is overloaded.",
      },
    ],
    summary: "Verification did not finish for this label.",
    missingApplicationFacts: [],
    nextSteps: ["Retry this label, or split the batch into smaller groups."],
    workflow: {
      comparisonSummary: "Verification did not finish for this label.",
      missingApplicationFacts: [],
      nextSteps: ["Retry this label, or split the batch into smaller groups."],
    },
  };
}

function withOptionalText(label: PendingLabel, text?: string): PendingLabel {
  if (!text) {
    const rest = { ...label };
    delete rest.text;
    return rest;
  }

  return { ...label, text };
}

export function buildVerificationLabels(labels: PendingLabel[], fallbackText: string): PendingLabel[] {
  const fallback = fallbackText.trim();

  if (!labels.length) {
    return [{ fileName: "typed-label", text: fallback }];
  }

  return labels.map((label) => {
    const explicitText = label.text?.trim();
    const text = explicitText || (!label.dataUrl ? fallback : undefined);
    return withOptionalText(label, text);
  });
}
