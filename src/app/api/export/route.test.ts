import { describe, expect, it } from "vitest";
import { POST } from "./route";
import { POST as V1POST } from "../v1/export/route";

const result = {
  labelId: "front",
  fileName: "front.txt",
  decision: "approved",
  score: 100,
  summary: "All checks passed.",
  checks: [
    { status: "pass" },
    { status: "warning" },
  ],
};

function request(body: unknown) {
  return new Request("http://localhost/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/export", () => {
  it("returns a JSON review packet", async () => {
    const response = await POST(request({ batch: { batchId: "batch-1", results: [result] }, format: "json" }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.requestId).toBeTruthy();
    expect(data.packetType).toBe("labelcheck.review_packet");
    expect(data.schemaVersion).toBe("1.0");
    expect(data.batch.results[0].labelId).toBe("front");
  });

  it("returns a CSV review summary", async () => {
    const response = await V1POST(request({ batch: { batchId: "batch-1", results: [result] }, format: "csv" }));
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(csv).toContain("labelId,fileName,decision,score");
    expect(csv).toContain("front,front.txt,approved,100,1,1,0,0,All checks passed.");
  });

  it("returns structured validation errors", async () => {
    const response = await POST(request({ batch: { results: [] } }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.issues[0].path).toEqual(["batch", "results"]);
  });
});
