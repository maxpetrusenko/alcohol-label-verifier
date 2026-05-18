import { NextResponse } from "next/server";
import { apiError, makeRequestId } from "../../../lib/apiResponses";
import { exportRequestSchema } from "../../../lib/apiSchemas";
import { buildExportBatch, buildExportPacket, isRecord, resultsToCsv } from "../../../lib/exportPacket";

export const runtime = "nodejs";

function rawExportBatch(rawPayload: unknown, parsedBatch: { batchId?: string; application?: unknown; results: unknown[]; meta?: unknown }) {
  const raw = isRecord(rawPayload) ? rawPayload : {};
  const rawBatch = isRecord(raw.batch) ? raw.batch : {};
  return buildExportBatch({
    ...rawBatch,
    ...(raw.adjudications !== undefined && rawBatch.adjudications === undefined ? { adjudications: raw.adjudications } : {}),
    ...(raw.reviewerDispositions !== undefined && rawBatch.reviewerDispositions === undefined ? { reviewerDispositions: raw.reviewerDispositions } : {}),
    ...(raw.dispositions !== undefined && rawBatch.dispositions === undefined ? { dispositions: raw.dispositions } : {}),
    batchId: parsedBatch.batchId,
    application: parsedBatch.application,
    results: parsedBatch.results,
    meta: parsedBatch.meta,
  });
}

export async function POST(request: Request) {
  const requestId = makeRequestId();
  try {
    const rawPayload = await request.json();
    const payload = exportRequestSchema.parse(rawPayload);
    const batch = rawExportBatch(rawPayload, payload.batch);

    if (payload.format === "csv") {
      return new NextResponse(resultsToCsv(batch), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${batch.batchId ?? "labelcheck-review"}.csv"`,
          "X-Request-Id": requestId,
        },
      });
    }

    return NextResponse.json(buildExportPacket(batch, requestId));
  } catch (error) {
    return apiError(error, "Unknown export error", "EXPORT_ERROR");
  }
}
