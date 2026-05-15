import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractLabel } from "./extraction";
import { GOVERNMENT_WARNING_TEXT } from "./rules";

describe("extractLabel", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalEndpoint = process.env.OPENAI_VISION_ENDPOINT;
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalGeminiMaxKey = process.env.GEMINI_API_KEY_MAX;
  const originalGeminiTurkeyKey = process.env.GEMINI_API_KEY_TURKEY;
  const originalProvider = process.env.VISION_PROVIDER;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_VISION_ENDPOINT = "chat_completions";
    process.env.VISION_PROVIDER = "openai";
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_MAX;
    delete process.env.GEMINI_API_KEY_TURKEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey) process.env.OPENAI_API_KEY = originalApiKey;
    else delete process.env.OPENAI_API_KEY;
    if (originalEndpoint) process.env.OPENAI_VISION_ENDPOINT = originalEndpoint;
    else delete process.env.OPENAI_VISION_ENDPOINT;
    if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;
    else delete process.env.GEMINI_API_KEY;
    if (originalGeminiMaxKey) process.env.GEMINI_API_KEY_MAX = originalGeminiMaxKey;
    else delete process.env.GEMINI_API_KEY_MAX;
    if (originalGeminiTurkeyKey) process.env.GEMINI_API_KEY_TURKEY = originalGeminiTurkeyKey;
    else delete process.env.GEMINI_API_KEY_TURKEY;
    if (originalProvider) process.env.VISION_PROVIDER = originalProvider;
    else delete process.env.VISION_PROVIDER;
  });

  it("normalizes provider confidence and common warning OCR typos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    labelText: `Old Cypress Distillery\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol.\n750 mL\nOld Cypress Distillery, Louisville, KY\n${GOVERNMENT_WARNING_TEXT}`,
                    brandName: "Old Cypress Distillery",
                    classType: "Kentucky Straight Bourbon Whiskey",
                    alcoholContent: "45% Alc./Vol.",
                    netContents: "750 mL",
                    governmentWarning: GOVERNMENT_WARNING_TEXT.replace("GOVERNMENT WARNING:", "GOVERMMENT WARNING:"),
                    bottlerAddress: "Old Cypress Distillery, Louisville, KY",
                    countryOfOrigin: "",
                    confidence: 95,
                    notes: [],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const extraction = await extractLabel({
      fileName: "label.jpg",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,test",
    });

    expect(extraction.confidence).toBe(0.95);
    expect(extraction.governmentWarning).toBe(GOVERNMENT_WARNING_TEXT);
  });

  it("can call the Gemini vision provider when configured", async () => {
    process.env.VISION_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-key";
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.contents[0].parts[1].inline_data.mime_type).toBe("image/jpeg");
      expect(body.generationConfig.responseMimeType).toBe("application/json");
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      labelText: "Old Cypress Distillery",
                      brandName: "Old Cypress Distillery",
                      classType: "",
                      alcoholContent: "",
                      netContents: "",
                      governmentWarning: "",
                      bottlerAddress: "",
                      countryOfOrigin: "",
                      confidence: 0.64,
                      notes: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const extraction = await extractLabel({
      fileName: "label.jpg",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,test",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toContain("generativelanguage.googleapis.com");
    expect(extraction.brandName).toBe("Old Cypress Distillery");
    expect(extraction.confidence).toBe(0.64);
  });

  it("removes structured fields that are not present in raw extracted text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    labelText: "KENTUCKY LEGACY",
                    brandName: "KENTUCKY LEGACY",
                    classType: "STRAIGHT BOURBON WHISKEY",
                    alcoholContent: "45% ALC/VOL 80 PROOF",
                    netContents: "750 ML",
                    governmentWarning: GOVERNMENT_WARNING_TEXT,
                    bottlerAddress: "BOTTLED BY KENTUCKY DISTILLERS, INC. FRANKFORT, KY",
                    countryOfOrigin: "",
                    confidence: 0.98,
                    notes: [],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const extraction = await extractLabel({
      fileName: "many-bottles.jpg",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,test",
    });

    expect(extraction.brandName).toBe("KENTUCKY LEGACY");
    expect(extraction.alcoholContent).toBeUndefined();
    expect(extraction.netContents).toBeUndefined();
    expect(extraction.governmentWarning).toBeUndefined();
    expect(extraction.notes).toContain("Removed net contents because it was not present in raw extracted label text.");
  });

  it("removes one-letter structured garbage even when raw OCR contains it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    labelText: "C",
                    brandName: "C",
                    classType: "C",
                    alcoholContent: "C",
                    netContents: "C",
                    governmentWarning: "C",
                    bottlerAddress: "C",
                    countryOfOrigin: "C",
                    confidence: 0,
                    notes: ["target label not isolated: multiple bottles or labels visible"],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const extraction = await extractLabel({
      fileName: "covered-pouring-label.jpg",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,test",
    });

    expect(extraction.labelText).toBe("C");
    expect(extraction.brandName).toBeUndefined();
    expect(extraction.classType).toBeUndefined();
    expect(extraction.alcoholContent).toBeUndefined();
    expect(extraction.netContents).toBeUndefined();
    expect(extraction.governmentWarning).toBeUndefined();
    expect(extraction.notes).toContain("Removed class/type because it was too incomplete to use as extracted label evidence.");
  });

  it("uses named Gemini keys when the generic key is absent", async () => {
    process.env.VISION_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY_MAX = "named-gemini-key";
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      labelText: "",
                      brandName: "",
                      classType: "",
                      alcoholContent: "",
                      netContents: "",
                      governmentWarning: "",
                      bottlerAddress: "",
                      countryOfOrigin: "",
                      confidence: 0,
                      notes: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await extractLabel({
      fileName: "label.jpg",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,test",
    });

    expect((fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>)["x-goog-api-key"]).toBe("named-gemini-key");
  });
});
