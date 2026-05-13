import { describe, expect, it } from "vitest";
import { buildVerificationLabels } from "./labelPayload";

describe("buildVerificationLabels", () => {
  it("does not attach stale text fallback to uploaded images", () => {
    const labels = buildVerificationLabels(
      [{ fileName: "portal-screenshot.png", mimeType: "image/png", dataUrl: "data:image/png;base64,abc" }],
      "OLD TOM DISTILLERY",
    );

    expect(labels).toEqual([{ fileName: "portal-screenshot.png", mimeType: "image/png", dataUrl: "data:image/png;base64,abc" }]);
  });

  it("keeps explicit fixture text when an image intentionally supplies it", () => {
    const labels = buildVerificationLabels(
      [{ fileName: "fixture.png", mimeType: "image/png", dataUrl: "data:image/png;base64,abc", text: "Fixture label text" }],
      "OLD TOM DISTILLERY",
    );

    expect(labels[0]?.text).toBe("Fixture label text");
  });

  it("uses fallback text for typed text-only review", () => {
    const labels = buildVerificationLabels([{ fileName: "typed-label" }], "Typed label text");

    expect(labels).toEqual([{ fileName: "typed-label", text: "Typed label text" }]);
  });
});
