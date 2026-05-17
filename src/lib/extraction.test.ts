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
  const originalVisionTimeout = process.env.VISION_TIMEOUT_MS;
  const originalVisionFallbackTimeout = process.env.VISION_FALLBACK_TIMEOUT_MS;
  const originalLangSmithKey = process.env.LANGSMITH_API_KEY;
  const originalLangSmithEndpoint = process.env.LANGSMITH_ENDPOINT;
  const originalLangSmithProject = process.env.LANGSMITH_PROJECT;
  const originalLangSmithTracing = process.env.LANGSMITH_TRACING;
  const originalLangChainKey = process.env.LANGCHAIN_API_KEY;
  const originalLangChainProject = process.env.LANGCHAIN_PROJECT;
  const originalLangChainTracing = process.env.LANGCHAIN_TRACING_V2;
  const originalAppLangSmithKey = process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY;
  const originalAppLangSmithEndpoint = process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_ENDPOINT;
  const originalAppLangSmithProject = process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT;
  const originalAppLangSmithTracing = process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING;
  const originalBraintrustKey = process.env.BRAINTRUST_API_KEY;
  const originalBraintrustProject = process.env.BRAINTRUST_PROJECT;
  const originalBraintrustTracing = process.env.BRAINTRUST_TRACING;
  const originalAppBraintrustKey = process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_API_KEY;
  const originalAppBraintrustAppUrl = process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_APP_URL;
  const originalAppBraintrustProject = process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_PROJECT;
  const originalAppBraintrustTracing = process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_TRACING;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_VISION_ENDPOINT = "chat_completions";
    process.env.VISION_PROVIDER = "openai";
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_MAX;
    delete process.env.GEMINI_API_KEY_TURKEY;
    delete process.env.VISION_TIMEOUT_MS;
    delete process.env.VISION_FALLBACK_TIMEOUT_MS;
    delete process.env.LANGSMITH_API_KEY;
    delete process.env.LANGSMITH_ENDPOINT;
    delete process.env.LANGSMITH_PROJECT;
    delete process.env.LANGSMITH_TRACING;
    delete process.env.LANGCHAIN_API_KEY;
    delete process.env.LANGCHAIN_PROJECT;
    delete process.env.LANGCHAIN_TRACING_V2;
    delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY;
    delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_ENDPOINT;
    delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT;
    delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING;
    delete process.env.BRAINTRUST_API_KEY;
    delete process.env.BRAINTRUST_PROJECT;
    delete process.env.BRAINTRUST_TRACING;
    delete process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_API_KEY;
    delete process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_APP_URL;
    delete process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_PROJECT;
    delete process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_TRACING;
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
    if (originalVisionTimeout) process.env.VISION_TIMEOUT_MS = originalVisionTimeout;
    else delete process.env.VISION_TIMEOUT_MS;
    if (originalVisionFallbackTimeout) process.env.VISION_FALLBACK_TIMEOUT_MS = originalVisionFallbackTimeout;
    else delete process.env.VISION_FALLBACK_TIMEOUT_MS;
    if (originalLangSmithKey) process.env.LANGSMITH_API_KEY = originalLangSmithKey;
    else delete process.env.LANGSMITH_API_KEY;
    if (originalLangSmithEndpoint) process.env.LANGSMITH_ENDPOINT = originalLangSmithEndpoint;
    else delete process.env.LANGSMITH_ENDPOINT;
    if (originalLangSmithProject) process.env.LANGSMITH_PROJECT = originalLangSmithProject;
    else delete process.env.LANGSMITH_PROJECT;
    if (originalLangSmithTracing) process.env.LANGSMITH_TRACING = originalLangSmithTracing;
    else delete process.env.LANGSMITH_TRACING;
    if (originalLangChainKey) process.env.LANGCHAIN_API_KEY = originalLangChainKey;
    else delete process.env.LANGCHAIN_API_KEY;
    if (originalLangChainProject) process.env.LANGCHAIN_PROJECT = originalLangChainProject;
    else delete process.env.LANGCHAIN_PROJECT;
    if (originalLangChainTracing) process.env.LANGCHAIN_TRACING_V2 = originalLangChainTracing;
    else delete process.env.LANGCHAIN_TRACING_V2;
    if (originalAppLangSmithKey) process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY = originalAppLangSmithKey;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY;
    if (originalAppLangSmithEndpoint) process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_ENDPOINT = originalAppLangSmithEndpoint;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_ENDPOINT;
    if (originalAppLangSmithProject) process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT = originalAppLangSmithProject;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT;
    if (originalAppLangSmithTracing) process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING = originalAppLangSmithTracing;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING;
    if (originalBraintrustKey) process.env.BRAINTRUST_API_KEY = originalBraintrustKey;
    else delete process.env.BRAINTRUST_API_KEY;
    if (originalBraintrustProject) process.env.BRAINTRUST_PROJECT = originalBraintrustProject;
    else delete process.env.BRAINTRUST_PROJECT;
    if (originalBraintrustTracing) process.env.BRAINTRUST_TRACING = originalBraintrustTracing;
    else delete process.env.BRAINTRUST_TRACING;
    if (originalAppBraintrustKey) process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_API_KEY = originalAppBraintrustKey;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_API_KEY;
    if (originalAppBraintrustAppUrl) process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_APP_URL = originalAppBraintrustAppUrl;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_APP_URL;
    if (originalAppBraintrustProject) process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_PROJECT = originalAppBraintrustProject;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_PROJECT;
    if (originalAppBraintrustTracing) process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_TRACING = originalAppBraintrustTracing;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_TRACING;
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

  it("can use the OpenAI responses endpoint", async () => {
    process.env.OPENAI_VISION_ENDPOINT = "responses";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.text.format.name).toBe("label_extraction");
      expect(body.input[0].content[1].type).toBe("input_image");
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            labelText: `Responses Cellars\nRed Wine\n13.5% Alc./Vol.\n750 mL\n${GOVERNMENT_WARNING_TEXT}`,
            brandName: "Responses Cellars",
            classType: "Red Wine",
            alcoholContent: "13.5% Alc./Vol.",
            netContents: "750 mL",
            governmentWarning: GOVERNMENT_WARNING_TEXT,
            bottlerAddress: "",
            countryOfOrigin: "",
            confidence: 0.83,
            notes: [],
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const extraction = await extractLabel({
      fileName: "responses-label.jpg",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,test",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/responses");
    expect(extraction.brandName).toBe("Responses Cellars");
    expect(extraction.classType).toBe("Red Wine");
  });

  it("returns fallback evidence when the provider rejects the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate limit exceeded", { status: 429 })),
    );

    const extraction = await extractLabel({
      fileName: "provider-error.txt",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,test",
      text: "Fallback Brand\nVodka\n40% Alc./Vol.\n750 mL",
    });

    expect(extraction.brandName).toBe("Fallback Brand");
    expect(extraction.confidence).toBeGreaterThan(0);
    expect(extraction.notes).toEqual(["Vision extraction failed with provider status 429: rate limit exceeded"]);
  });

  it("keeps fallback evidence when provider JSON cannot be parsed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "not-json" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const extraction = await extractLabel({
      fileName: "bad-json.txt",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,test",
      text: "Fallback Brand\nVodka\n40% Alc./Vol.\n750 mL",
    });

    expect(extraction.brandName).toBe("Fallback Brand");
    expect(extraction.confidence).toBeGreaterThan(0);
    expect(extraction.notes[0]).toMatch(/^Vision extraction returned unreadable JSON:/u);
  });

  it("preserves visible warning capitalization from raw label evidence", async () => {
    const titleCaseWarning = GOVERNMENT_WARNING_TEXT.replace("GOVERNMENT WARNING:", "Government Warning:");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    labelText: `Copper Fox\nBourbon Whiskey\n40% Alc./Vol.\n750 mL\nFox Distillers, Lexington, KY\n${titleCaseWarning}`,
                    brandName: "Copper Fox",
                    classType: "Bourbon Whiskey",
                    alcoholContent: "40% Alc./Vol.",
                    netContents: "750 mL",
                    governmentWarning: GOVERNMENT_WARNING_TEXT,
                    bottlerAddress: "Fox Distillers, Lexington, KY",
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
      fileName: "warning-title-case.jpg",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,test",
    });

    expect(extraction.governmentWarning).toBe(titleCaseWarning);
  });

  it("wraps provider vision calls in a LangSmith trace when tracing is enabled", async () => {
    process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY = "lsv2-test-secret";
    process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT = "alcohol-label-verifier-test";
    process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING = "true";
    process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_API_KEY = "bt-test-secret";
    process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_APP_URL = "https://braintrust-app.test";
    process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_PROJECT = "alcohol-label-verifier-test";
    process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_TRACING = "true";
    process.env.LANGSMITH_ENDPOINT = "https://langsmith.test";

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (href.startsWith("https://langsmith.test")) {
        return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (href.endsWith("/api/apikey/login")) {
        return new Response(
          JSON.stringify({ org_info: [{ id: "org-id", name: "org-name", api_url: "https://braintrust-api.test" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (href.endsWith("/api/project/register")) {
        return new Response(
          JSON.stringify({ project: { id: "project-id", name: "alcohol-label-verifier-test" }, project_url: "https://braintrust-app.test/app/org-name/p/project-id" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (href.startsWith("https://braintrust-app.test") || href.startsWith("https://braintrust-api.test")) {
        return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response(
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
                  governmentWarning: GOVERNMENT_WARNING_TEXT,
                  bottlerAddress: "Old Cypress Distillery, Louisville, KY",
                  countryOfOrigin: "",
                  confidence: 0.95,
                  notes: [],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await extractLabel({
      fileName: "traced-label.jpg",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,test",
    });

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("api.openai.com/v1/chat/completions"))).toBe(true);
    await vi.waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => (typeof url === "string" ? url : url instanceof URL ? url.href : url.url));
      expect(calls.some((url) => url.startsWith("https://langsmith.test/runs"))).toBe(true);
      expect(calls.some((url) => url.startsWith("https://braintrust-api.test/logs3"))).toBe(true);
    });
    expect(process.env.LANGSMITH_API_KEY).toBe("lsv2-test-secret");
    expect(process.env.LANGCHAIN_API_KEY).toBe("lsv2-test-secret");
    expect(process.env.LANGSMITH_PROJECT).toBe("alcohol-label-verifier-test");
    expect(process.env.LANGCHAIN_PROJECT).toBe("alcohol-label-verifier-test");
    expect(process.env.BRAINTRUST_API_KEY).toBe("bt-test-secret");
    expect(process.env.BRAINTRUST_PROJECT).toBe("alcohol-label-verifier-test");
  });

  it("can call the Gemini vision provider when configured", async () => {
    process.env.VISION_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-key";
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.contents[0].parts[1].inline_data.mime_type).toBe("image/jpeg");
      expect(body.generationConfig.responseMimeType).toBe("application/json");
      expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
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

  it("falls back to OpenAI when Gemini times out", async () => {
    process.env.VISION_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.VISION_TIMEOUT_MS = "1";
    process.env.VISION_FALLBACK_TIMEOUT_MS = "100";
    process.env.OPENAI_API_KEY = "openai-key";
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("generativelanguage.googleapis.com")) {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    labelText: "Backup Brand",
                    brandName: "Backup Brand",
                    classType: "",
                    alcoholContent: "",
                    netContents: "",
                    governmentWarning: "",
                    bottlerAddress: "",
                    countryOfOrigin: "",
                    confidence: 0.7,
                    notes: [],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const extraction = await extractLabel({
      fileName: "slow-label.jpg",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,test",
    });

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining("generativelanguage.googleapis.com"),
      expect.stringContaining("api.openai.com/v1/chat/completions"),
    ]);
    expect(extraction.brandName).toBe("Backup Brand");
    expect(extraction.notes[0]).toBe("gemini Vision extraction timed out after 1 ms.; retried with openai.");
  });

  it("reports both provider timeouts when primary and fallback fail", async () => {
    process.env.VISION_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.VISION_TIMEOUT_MS = "1";
    process.env.VISION_FALLBACK_TIMEOUT_MS = "1";
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    await expect(
      extractLabel({
        fileName: "all-timeout.jpg",
        mimeType: "image/jpeg",
        dataUrl: "data:image/jpeg;base64,test",
      }),
    ).rejects.toThrow("gemini Vision extraction timed out after 1 ms.; retried with openai. openai Vision extraction timed out after 1 ms.");
  });

  it("fails fast when the vision provider exceeds the configured timeout without fallback", async () => {
    process.env.VISION_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-key";
    delete process.env.OPENAI_API_KEY;
    process.env.VISION_TIMEOUT_MS = "1";
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    await expect(
      extractLabel({
        fileName: "slow-label.jpg",
        mimeType: "image/jpeg",
        dataUrl: "data:image/jpeg;base64,test",
      }),
    ).rejects.toThrow("Vision extraction timed out after 1 ms.");
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
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () =>
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
