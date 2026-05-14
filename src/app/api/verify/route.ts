import { NextResponse } from "next/server";
import { apiError, makeRequestId } from "../../../lib/apiResponses";
import { verifyRequestSchema, type LabelInputPayload } from "../../../lib/apiSchemas";
import { mapWithConcurrency } from "../../../lib/concurrency";
import { extractLabel } from "../../../lib/extraction";
import { extractionFromPlainText, verifyLabel } from "../../../lib/rules";
import type { ApplicationData } from "../../../lib/types";

export const runtime = "nodejs";

function cleanError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown extraction error";
  return message.replace(/\s+/g, " ").trim().slice(0, 180);
}

async function verifyOneLabel(application: ApplicationData, label: LabelInputPayload, index: number, batchStarted: number) {
  const labelId = label.labelId ?? `${index + 1}-${label.fileName}`;

  try {
    const extraction = await extractLabel(label);
    const result = verifyLabel(application, extraction, label.fileName);
    return { ...result, labelId, elapsedMs: Date.now() - batchStarted };
  } catch (error) {
    const fallback = extractionFromPlainText(label.text ?? "");
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
        mode: process.env.OPENAI_API_KEY ? "vision+rules" : "text-only-demo",
      },
    });
  } catch (error) {
    return apiError(error, "Unknown verification error");
  }
}
