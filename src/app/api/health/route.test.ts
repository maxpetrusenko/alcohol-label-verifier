import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalVisionModel = process.env.OPENAI_VISION_MODEL;
  const originalVisionEndpoint = process.env.OPENAI_VISION_ENDPOINT;
  const originalImageDetail = process.env.OPENAI_IMAGE_DETAIL;
  const originalProvider = process.env.VISION_PROVIDER;
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalGeminiMaxKey = process.env.GEMINI_API_KEY_MAX;
  const originalGeminiTurkeyKey = process.env.GEMINI_API_KEY_TURKEY;
  const originalGeminiModel = process.env.GEMINI_VISION_MODEL;
  const originalLangSmithKey = process.env.LANGSMITH_API_KEY;
  const originalLangSmithProject = process.env.LANGSMITH_PROJECT;
  const originalLangSmithTracing = process.env.LANGSMITH_TRACING;
  const originalAppLangSmithKey = process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY;
  const originalAppLangSmithProject = process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT;
  const originalAppLangSmithTracing = process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_VISION_MODEL;
    delete process.env.OPENAI_VISION_ENDPOINT;
    delete process.env.OPENAI_IMAGE_DETAIL;
    delete process.env.VISION_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_MAX;
    delete process.env.GEMINI_API_KEY_TURKEY;
    delete process.env.GEMINI_VISION_MODEL;
    delete process.env.LANGSMITH_API_KEY;
    delete process.env.LANGSMITH_PROJECT;
    delete process.env.LANGSMITH_TRACING;
    delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY;
    delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT;
    delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING;
  });

  afterEach(() => {
    if (originalApiKey) process.env.OPENAI_API_KEY = originalApiKey;
    else delete process.env.OPENAI_API_KEY;

    if (originalVisionModel) process.env.OPENAI_VISION_MODEL = originalVisionModel;
    else delete process.env.OPENAI_VISION_MODEL;

    if (originalVisionEndpoint) process.env.OPENAI_VISION_ENDPOINT = originalVisionEndpoint;
    else delete process.env.OPENAI_VISION_ENDPOINT;

    if (originalImageDetail) process.env.OPENAI_IMAGE_DETAIL = originalImageDetail;
    else delete process.env.OPENAI_IMAGE_DETAIL;

    if (originalProvider) process.env.VISION_PROVIDER = originalProvider;
    else delete process.env.VISION_PROVIDER;

    if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;
    else delete process.env.GEMINI_API_KEY;

    if (originalGeminiMaxKey) process.env.GEMINI_API_KEY_MAX = originalGeminiMaxKey;
    else delete process.env.GEMINI_API_KEY_MAX;

    if (originalGeminiTurkeyKey) process.env.GEMINI_API_KEY_TURKEY = originalGeminiTurkeyKey;
    else delete process.env.GEMINI_API_KEY_TURKEY;

    if (originalGeminiModel) process.env.GEMINI_VISION_MODEL = originalGeminiModel;
    else delete process.env.GEMINI_VISION_MODEL;

    if (originalLangSmithKey) process.env.LANGSMITH_API_KEY = originalLangSmithKey;
    else delete process.env.LANGSMITH_API_KEY;

    if (originalLangSmithProject) process.env.LANGSMITH_PROJECT = originalLangSmithProject;
    else delete process.env.LANGSMITH_PROJECT;

    if (originalLangSmithTracing) process.env.LANGSMITH_TRACING = originalLangSmithTracing;
    else delete process.env.LANGSMITH_TRACING;

    if (originalAppLangSmithKey) process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY = originalAppLangSmithKey;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY;

    if (originalAppLangSmithProject) process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT = originalAppLangSmithProject;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT;

    if (originalAppLangSmithTracing) process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING = originalAppLangSmithTracing;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING;
  });

  it("reports text-only mode when no default provider key is configured", async () => {
    const data = await GET().json();

    expect(data.vision).toEqual({
      configured: false,
      mode: "text-only-demo",
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      endpoint: "generateContent",
      imageDetail: "low",
    });
    expect(data.langsmith).toEqual({
      configured: false,
      tracingEnabled: false,
      project: "alcohol-label-verifier",
    });
  });

  it("reports configured vision mode without exposing the key", async () => {
    process.env.VISION_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test-secret";
    process.env.OPENAI_VISION_MODEL = "gpt-4.1-mini";
    process.env.OPENAI_VISION_ENDPOINT = "responses";
    process.env.OPENAI_IMAGE_DETAIL = "high";

    const data = await GET().json();

    expect(data.vision).toEqual({
      configured: true,
      mode: "vision+rules",
      provider: "openai",
      model: "gpt-4.1-mini",
      endpoint: "responses",
      imageDetail: "high",
    });
    expect(JSON.stringify(data)).not.toContain("sk-test-secret");
  });

  it("reports Gemini provider configuration without exposing the key", async () => {
    process.env.VISION_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-secret";
    process.env.GEMINI_VISION_MODEL = "gemini-2.5-flash-lite";

    const data = await GET().json();

    expect(data.vision).toEqual({
      configured: true,
      mode: "vision+rules",
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      endpoint: "generateContent",
      imageDetail: "low",
    });
    expect(JSON.stringify(data)).not.toContain("gemini-secret");
  });

  it("reports Gemini configured when only a named key is present", async () => {
    process.env.VISION_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY_MAX = "named-gemini-secret";

    const data = await GET().json();

    expect(data.vision.configured).toBe(true);
    expect(data.vision.provider).toBe("gemini");
    expect(JSON.stringify(data)).not.toContain("named-gemini-secret");
  });

  it("reports LangSmith configuration without exposing the key", async () => {
    process.env.LANGSMITH_API_KEY = "shared-lsv2-test-secret";
    process.env.LANGSMITH_PROJECT = "shared-project";
    process.env.LANGSMITH_TRACING = "false";
    process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY = "app-lsv2-test-secret";
    process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT = "labelcheck-local";
    process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING = "true";

    const data = await GET().json();

    expect(data.langsmith).toEqual({
      configured: true,
      tracingEnabled: true,
      project: "labelcheck-local",
    });
    expect(JSON.stringify(data)).not.toContain("app-lsv2-test-secret");
    expect(JSON.stringify(data)).not.toContain("shared-lsv2-test-secret");
  });
});
