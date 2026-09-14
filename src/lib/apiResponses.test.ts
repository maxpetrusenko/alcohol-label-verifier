import { describe, expect, it } from "vitest";
import { apiError, makeRequestId } from "./apiResponses";

describe("apiResponses", () => {
  it("formats non-validation errors with fallback status and request ids", async () => {
    const response = apiError(new Error("provider failed"), "fallback message", "EXPORT_ERROR", 502);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error).toMatchObject({
      code: "EXPORT_ERROR",
      message: "provider failed",
    });
    expect(data.error.requestId).toBeTruthy();
  });

  it("generates a request id even when randomUUID is unavailable", () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });

    try {
      expect(makeRequestId()).toMatch(/^req_\d+$/u);
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: originalCrypto, configurable: true });
    }
  });
});
