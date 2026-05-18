import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { POST as V1POST } from "../v1/verify/route";
import { MAX_LABEL_DATA_URL_LENGTH } from "../../../lib/apiSchemas";
import { GOVERNMENT_WARNING_TEXT } from "../../../lib/rules";

const application = {
  brandName: "Old Cypress Distillery",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol.",
  netContents: "750 mL",
  bottlerAddress: "Old Cypress Distillery, Louisville, KY",
  countryOfOrigin: "",
  beverageKind: "spirits",
};

function requestWithLabels(labels: unknown[]) {
  return new Request("http://localhost/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ application, labels }),
  });
}

describe("POST /api/verify", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalProvider = process.env.VISION_PROVIDER;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.VISION_PROVIDER;
  });

  afterEach(() => {
    if (originalApiKey) process.env.OPENAI_API_KEY = originalApiKey;
    else delete process.env.OPENAI_API_KEY;
    if (originalProvider) process.env.VISION_PROVIDER = originalProvider;
    else delete process.env.VISION_PROVIDER;
  });

  it("returns one result per submitted batch label", async () => {
    const response = await POST(
      requestWithLabels([
        {
          labelId: "front",
          fileName: "front.txt",
          text: `Old Cypress Distillery\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol.\n750 mL\nDistilled and bottled by Old Cypress Distillery, Louisville, KY\n${GOVERNMENT_WARNING_TEXT}`,
        },
        {
          labelId: "back",
          fileName: "back.txt",
          text: "Not an alcohol label",
        },
      ]),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.meta.count).toBe(2);
    expect(data.meta.requestId).toBeTruthy();
    expect(data.results).toHaveLength(2);
    expect(data.results.map((result: { labelId: string }) => result.labelId)).toEqual(["front", "back"]);
    expect(data.results[0].decision).toBe("approved");
    expect(data.results[1].decision).toBe("rejected");
  });

  it("uses per-label application facts for mixed application batches", async () => {
    const response = await POST(
      new Request("http://localhost/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application,
          labels: [
            {
              labelId: "old-cypress",
              fileName: "old-cypress.txt",
              application,
              text: `Old Cypress Distillery\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol.\n750 mL\nDistilled and bottled by Old Cypress Distillery, Louisville, KY\n${GOVERNMENT_WARNING_TEXT}`,
            },
            {
              labelId: "smoky-hollow",
              fileName: "02-mismatch-01.txt",
              application: {
                brandName: "Wrong Brand Name",
                classType: "Tennessee Whiskey",
                alcoholContent: "40% Alc./Vol.",
                netContents: "750 mL",
                bottlerAddress: "Smoky Hollow Distillery, Nashville, TN",
                countryOfOrigin: "United States",
                beverageKind: "spirits",
              },
              text: `Smoky Hollow\nTennessee Whiskey\n40% Alc./Vol.\n750 mL\nDistilled and bottled by Smoky Hollow Distillery, Nashville, TN\n${GOVERNMENT_WARNING_TEXT}`,
            },
          ],
        }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results).toHaveLength(2);
    expect(data.results[0].decision).toBe("approved");
    expect(data.results[1].decision).toBe("rejected");
    expect(data.results[1].checks.find((check: { id: string }) => check.id === "brand-name")).toMatchObject({ status: "fail" });
  });

  it("treats degraded review-photo warning uncertainty as needs review", async () => {
    const response = await POST(
      requestWithLabels([
        {
          labelId: "degraded",
          fileName: "bad__review__flash__rotate-p015.jpg",
          text: "Old Cypress Distillery\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol.\n750 mL\nDistilled and bottled by Old Cypress Distillery, Louisville, KY",
        },
      ]),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results[0].decision).toBe("needs_review");
    expect(data.results[0].checks.find((check: { id: string }) => check.id === "government-warning")).toMatchObject({
      status: "needs_review",
    });
  });

  it("does not clean-pass warning text from a crowded multi-label filename", async () => {
    const response = await POST(
      requestWithLabels([
        {
          labelId: "crowded",
          fileName: "nano-scene-crowded-counter-overlap.png",
          text: `Old Cypress Distillery\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol.\n750 mL\nDistilled and bottled by Old Cypress Distillery, Louisville, KY\n${GOVERNMENT_WARNING_TEXT}`,
        },
      ]),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results[0].decision).toBe("rejected");
    expect(data.results[0].checks.find((check: { id: string }) => check.id === "target-isolation")).toMatchObject({
      status: "fail",
    });
  });

  it("keeps a rejected review result when image extraction fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.VISION_PROVIDER = "openai";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("provider unavailable    with noisy whitespace");
    };

    try {
      const response = await POST(
        requestWithLabels([
          {
            labelId: "image-only",
            fileName: "front.jpg",
            mimeType: "image/jpeg",
            dataUrl: "data:image/jpeg;base64,test",
          },
        ]),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results[0].decision).toBe("rejected");
      expect(data.results[0].extraction.confidence).toBe(0);
      expect(data.results[0].extraction.notes[0]).toBe("Extraction failed for this label: provider unavailable with noisy whitespace");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects unsupported image MIME types before extraction", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.VISION_PROVIDER = "openai";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("fetch should not be called for invalid payloads");
    };

    try {
      const response = await POST(
        requestWithLabels([
          {
            labelId: "pdf",
            fileName: "front.pdf",
            mimeType: "application/pdf",
            dataUrl: "data:application/pdf;base64,dGVzdA==",
          },
        ]),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_ERROR");
      expect(data.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["labels", 0, "dataUrl"],
          message: expect.stringContaining("Unsupported image MIME type"),
        }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects oversized image data URLs before extraction", async () => {
    const response = await POST(
      requestWithLabels([
        {
          labelId: "too-large",
          fileName: "front.png",
          mimeType: "image/png",
          dataUrl: `data:image/png;base64,${"a".repeat(MAX_LABEL_DATA_URL_LENGTH)}`,
        },
      ]),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["labels", 0, "dataUrl"],
        message: expect.stringContaining("Image dataUrl must be"),
      }),
    );
  });

  it("rejects labels with no image or text evidence", async () => {
    const response = await POST(
      requestWithLabels([
        {
          labelId: "empty",
          fileName: "empty.txt",
        },
      ]),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["labels", 0, "dataUrl"],
        message: "Each label needs either image dataUrl evidence or text evidence.",
      }),
    );
  });

  it("accepts text-only fallback labels and keeps generated label ids stable", async () => {
    const response = await POST(
      requestWithLabels([
        {
          fileName: "typed-label.txt",
          mimeType: "text/plain",
          text: `Old Cypress Distillery\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol.\n750 mL\nDistilled and bottled by Old Cypress Distillery, Louisville, KY\n${GOVERNMENT_WARNING_TEXT}`,
        },
      ]),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results[0].labelId).toBe("1-typed-label.txt");
    expect(data.results[0].decision).toBe("approved");
  });

  it("rejects batches over the configured per-request label limit", async () => {
    const labels = Array.from({ length: 26 }, (_, index) => ({
      labelId: `label-${index}`,
      fileName: `label-${index}.txt`,
      text: "Old Cypress Distillery",
    }));

    const response = await POST(requestWithLabels(labels));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.requestId).toBeTruthy();
    expect(data.error.issues[0].path).toEqual(["labels"]);
  });

  it("serves the same contract through the v1 route", async () => {
    const response = await V1POST(
      requestWithLabels([
        {
          labelId: "front",
          fileName: "front.txt",
          text: `Old Cypress Distillery\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol.\n750 mL\nDistilled and bottled by Old Cypress Distillery, Louisville, KY\n${GOVERNMENT_WARNING_TEXT}`,
        },
      ]),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.meta.count).toBe(1);
    expect(data.results[0].labelId).toBe("front");
  });
});
