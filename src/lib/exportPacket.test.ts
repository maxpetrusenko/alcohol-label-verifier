import { describe, expect, it } from "vitest";
import { buildExportBatch, buildExportPacket, resultsToCsv } from "./exportPacket";

describe("exportPacket", () => {
  it("scrubs raw image fields and raw image data URLs from nested batch payloads", () => {
    const batch = buildExportBatch({
      batchId: "batch-1",
      dataUrl: "data:image/png;base64,raw",
      results: [
        {
          labelId: "front",
          imageBase64: "raw",
          nested: {
            preview: "data:image/jpeg;base64,raw",
            retained: "visible text evidence",
          },
        },
      ],
    });

    expect(batch.dataUrl).toBeUndefined();
    expect(batch.results[0]).toEqual({
      labelId: "front",
      nested: {
        retained: "visible text evidence",
      },
    });
  });

  it("builds an empty safe batch from malformed export input", () => {
    const batch = buildExportBatch(null);
    const packet = buildExportPacket(batch, "req_1", "2026-05-18T00:00:00.000Z");

    expect(batch.results).toEqual([]);
    expect(packet.batchId).toBeNull();
    expect(packet.application).toBeNull();
    expect(packet.rawImagePolicy.excludedByDefault).toBe(true);
  });

  it("matches reviewer disposition arrays by result id and escapes CSV cells", () => {
    const csv = resultsToCsv({
      results: [
        {
          resultId: "result-1",
          fileName: "front,label.txt",
          decision: "rejected",
          score: 64,
          summary: "Line one\nLine two",
          checks: "not an array",
        },
      ],
      dispositions: [{ resultId: "result-1", status: "request_correction", overrideReason: "abv_mismatch", reviewerNote: "Fix ABV, then resend." }],
    });

    expect(csv).toContain("labelId,fileName,decision,disposition,reason,note,score");
    expect(csv).toContain(',"front,label.txt",rejected,request_correction,abv_mismatch,"Fix ABV, then resend.",64,0,0,0,0,"Line one');
  });
});
