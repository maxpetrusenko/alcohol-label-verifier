import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GOVERNMENT_WARNING_TEXT } from "../../../lib/rules";
import { POST } from "./route";
import { POST as V1POST } from "../v1/extract/route";

function requestWithLabels(labels: unknown[]) {
  return new Request("http://localhost/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ labels }),
  });
}

describe("POST /api/extract", () => {
  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (originalOpenAIKey) process.env.OPENAI_API_KEY = originalOpenAIKey;
    else delete process.env.OPENAI_API_KEY;
    if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;
    else delete process.env.GEMINI_API_KEY;
  });

  it("extracts batch text labels with reviewer guidance", async () => {
    const response = await POST(
      requestWithLabels([
        {
          fileName: "wine.txt",
          text: `Harbor Glen Vineyards\nTable Wine\n13% Alc./Vol.\n750 mL\nProduced and bottled by Harbor Glen Vineyards, Dundee, OR\n${GOVERNMENT_WARNING_TEXT}`,
        },
        {
          fileName: "partial.txt",
          text: "Harbor Glen Vineyards\nTable Wine",
        },
      ]),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.meta.count).toBe(2);
    expect(data.meta.requestId).toBeTruthy();
    expect(data.results[0]).toMatchObject({
      fileName: "wine.txt",
      extraction: {
        brandName: "Harbor Glen Vineyards",
        classType: "Table Wine",
        alcoholContent: "13% Alc./Vol.",
        netContents: "750 mL",
      },
      guidance: {
        title: "Photo read and ready to compare",
        missing: [],
      },
    });
    expect(data.results[1].guidance.title).toBe("Photo read, but more evidence is needed");
    expect(data.results[1].guidance.missing).toContain("government warning");
  });

  it("returns validation errors with request ids", async () => {
    const response = await POST(requestWithLabels([]));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.requestId).toBeTruthy();
    expect(data.error.issues[0].path).toEqual(["labels"]);
  });

  it("serves the same contract through the v1 route", async () => {
    const response = await V1POST(
      requestWithLabels([
        {
          fileName: "spirit.txt",
          text: `Old Cypress Distillery\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol.\n750 mL\n${GOVERNMENT_WARNING_TEXT}`,
        },
      ]),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.meta.count).toBe(1);
    expect(data.results[0].fileName).toBe("spirit.txt");
  });
});
