import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalVisionModel = process.env.OPENAI_VISION_MODEL;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_VISION_MODEL;
  });

  afterEach(() => {
    if (originalApiKey) process.env.OPENAI_API_KEY = originalApiKey;
    else delete process.env.OPENAI_API_KEY;

    if (originalVisionModel) process.env.OPENAI_VISION_MODEL = originalVisionModel;
    else delete process.env.OPENAI_VISION_MODEL;
  });

  it("reports text-only mode when no OpenAI key is configured", async () => {
    const data = await GET().json();

    expect(data.vision).toEqual({
      configured: false,
      mode: "text-only-demo",
      model: "gpt-4.1-mini",
    });
  });

  it("reports configured vision mode without exposing the key", async () => {
    process.env.OPENAI_API_KEY = "sk-test-secret";
    process.env.OPENAI_VISION_MODEL = "gpt-4.1-mini";

    const data = await GET().json();

    expect(data.vision).toEqual({
      configured: true,
      mode: "vision+rules",
      model: "gpt-4.1-mini",
    });
    expect(JSON.stringify(data)).not.toContain("sk-test-secret");
  });
});
