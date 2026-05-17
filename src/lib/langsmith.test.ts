import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { langSmithProject, withLangSmithTrace, type VisionTraceInput } from "./langsmith";

const traceInput: VisionTraceInput = {
  provider: "openai",
  model: "gpt-4.1-nano",
  endpoint: "chat_completions",
  fileName: "label.jpg",
  mimeType: "image/jpeg",
  hasImage: true,
  hasFallbackText: false,
  fallbackTextLength: 0,
};

describe("LangSmith tracing", () => {
  const originalApiKey = process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY;
  const originalEndpoint = process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_ENDPOINT;
  const originalProject = process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT;
  const originalTracing = process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING;

  beforeEach(() => {
    process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY = "lsv2-test";
    process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_ENDPOINT = "https://langsmith.test";
    process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT = "labelcheck-test";
    process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING = "true";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey) process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY = originalApiKey;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY;
    if (originalEndpoint) process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_ENDPOINT = originalEndpoint;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_ENDPOINT;
    if (originalProject) process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT = originalProject;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT;
    if (originalTracing) process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING = originalTracing;
    else delete process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING;
  });

  it("records failed traced runs without swallowing the model error", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      withLangSmithTrace(
        traceInput,
        async () => {
          throw new Error("model failed");
        },
        () => ({ ok: true }),
      ),
    ).rejects.toThrow("model failed");

    expect(langSmithProject()).toBe("labelcheck-test");
    await vi.waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("https://langsmith.test/runs"))).toBe(true);
    });
  });

});
