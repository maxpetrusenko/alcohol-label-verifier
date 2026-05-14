import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { POST as V1POST } from "../v1/verify/route";
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

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalApiKey) process.env.OPENAI_API_KEY = originalApiKey;
    else delete process.env.OPENAI_API_KEY;
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

  it("rejects batches over the configured 25 label limit", async () => {
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
