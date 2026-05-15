import { NextResponse } from "next/server";
import { apiError, makeRequestId } from "../../../lib/apiResponses";
import { verifyRequestSchema, type LabelInputPayload } from "../../../lib/apiSchemas";
import { mapWithConcurrency } from "../../../lib/concurrency";
import { extractLabel } from "../../../lib/extraction";
import { extractionFromPlainText, verifyLabel } from "../../../lib/rules";
import type { ApplicationData, LabelExtraction } from "../../../lib/types";
import { visionMode } from "../../../lib/visionConfig";

export const runtime = "nodejs";

function cleanError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown extraction error";
  return message.replace(/\s+/g, " ").trim().slice(0, 180);
}

const REVIEW_PHOTO_NAME_PATTERN =
  /(?:bad|review|blur|blurry|glare|flash|dark|low[-_\s]?light|overexposed|skew|rotate|rotated|crop|occluded|noise|jpeg|downsample|crowded|overlap|overlapping|multi[-_\s]?(?:labels?|bottles?)|multiple[-_\s]?(?:labels?|bottles?)|many[-_\s]?(?:labels?|bottles?))/i;
const AMBIGUOUS_TARGET_NAME_PATTERN =
  /(?:crowded|overlap|overlapping|scene|shelf|storage|multi[-_\s]?(?:labels?|bottles?)|multiple[-_\s]?(?:labels?|bottles?)|many[-_\s]?(?:labels?|bottles?))/i;

function withUploadQualityHint(extraction: LabelExtraction, fileName: string): LabelExtraction {
  if (!REVIEW_PHOTO_NAME_PATTERN.test(fileName)) return extraction;
  const note = AMBIGUOUS_TARGET_NAME_PATTERN.test(fileName)
    ? `Uploaded filename suggests the target label is not isolated, with multiple visible labels, overlap, or a shelf/counter scene: ${fileName}.`
    : `Uploaded filename suggests a degraded review photo with glare, rotation, blur, crop, or hard-to-read mandatory text: ${fileName}.`;
  return {
    ...extraction,
    notes: [...extraction.notes, note],
  };
}

async function verifyOneLabel(application: ApplicationData, label: LabelInputPayload, index: number, batchStarted: number) {
  const labelId = label.labelId ?? `${index + 1}-${label.fileName}`;

  try {
    const extraction = withUploadQualityHint(await extractLabel(label), label.fileName);
    const result = verifyLabel(application, extraction, label.fileName);
    return { ...result, labelId, elapsedMs: Date.now() - batchStarted };
  } catch (error) {
    const fallback = withUploadQualityHint(extractionFromPlainText(label.text ?? ""), label.fileName);
    const result = verifyLabel(
      application,
      {
        ...fallback,
        confidence: 0,
        notes: [`Extraction failed for this label: ${cleanError(error)}`],
      },
      label.fileName,
    );
    return { ...result, labelId, elapsedMs: Date.now() - batchStarted };
  }
}

export async function POST(request: Request) {
  const started = Date.now();
  const requestId = makeRequestId();
  try {
    const payload = verifyRequestSchema.parse(await request.json());
    const results = await mapWithConcurrency(payload.labels, payload.options?.maxConcurrency ?? 3, (label, index) =>
      verifyOneLabel(payload.application, label, index, started),
    );

    return NextResponse.json({
      results,
      meta: {
        requestId,
        count: results.length,
        elapsedMs: Date.now() - started,
        mode: visionMode("rules"),
      },
    });
  } catch (error) {
    return apiError(error, "Unknown verification error");
  }
}
