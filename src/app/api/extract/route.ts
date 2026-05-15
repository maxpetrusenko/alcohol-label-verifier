import { NextResponse } from "next/server";
import { apiError, makeRequestId } from "../../../lib/apiResponses";
import { extractRequestSchema } from "../../../lib/apiSchemas";
import { mapWithConcurrency } from "../../../lib/concurrency";
import { buildExtractionGuidance, extractLabel } from "../../../lib/extraction";
import { visionMode } from "../../../lib/visionConfig";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const started = Date.now();
  const requestId = makeRequestId();
  try {
    const payload = extractRequestSchema.parse(await request.json());
    const results = await mapWithConcurrency(payload.labels, payload.options?.maxConcurrency ?? 3, async (label) => {
      const extraction = await extractLabel(label);
      return {
        fileName: label.fileName,
        extraction,
        guidance: buildExtractionGuidance(extraction),
      };
    });

    return NextResponse.json({
      results,
      meta: {
        requestId,
        count: results.length,
        elapsedMs: Date.now() - started,
        mode: visionMode("guidance"),
      },
    });
  } catch (error) {
    return apiError(error, "Unknown extraction error");
  }
}
