import { NextResponse } from "next/server";
import { apiError, makeRequestId } from "../../../lib/apiResponses";
import { exportRequestSchema } from "../../../lib/apiSchemas";

export const runtime = "nodejs";

type ExportResult = {
  labelId?: unknown;
  fileName?: unknown;
  decision?: unknown;
  score?: unknown;
  summary?: unknown;
  checks?: unknown;
};

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function checkCount(result: ExportResult, status: string): number {
  if (!Array.isArray(result.checks)) return 0;
  return result.checks.filter((check) => typeof check === "object" && check !== null && (check as { status?: unknown }).status === status).length;
}

function resultsToCsv(results: unknown[]): string {
  const rows = [
    ["labelId", "fileName", "decision", "score", "passChecks", "warningChecks", "reviewChecks", "failChecks", "summary"],
    ...results.map((item) => {
      const result = (typeof item === "object" && item !== null ? item : {}) as ExportResult;
      return [
        result.labelId,
        result.fileName,
        result.decision,
        result.score,
        checkCount(result, "pass"),
        checkCount(result, "warning"),
        checkCount(result, "needs_review"),
        checkCount(result, "fail"),
        result.summary,
      ];
    }),
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export async function POST(request: Request) {
  const requestId = makeRequestId();
  try {
    const payload = exportRequestSchema.parse(await request.json());

    if (payload.format === "csv") {
      return new NextResponse(resultsToCsv(payload.batch.results), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${payload.batch.batchId ?? "labelcheck-review"}.csv"`,
          "X-Request-Id": requestId,
        },
      });
    }

    return NextResponse.json({
      requestId,
      packetType: "labelcheck.review_packet",
      schemaVersion: "1.0",
      exportedAt: new Date().toISOString(),
      batch: payload.batch,
    });
  } catch (error) {
    return apiError(error, "Unknown export error", "EXPORT_ERROR");
  }
}
