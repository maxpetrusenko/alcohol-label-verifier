import { describe, expect, it } from "vitest";
import { batchLimitError, buildVerificationLabels, isImageLikeUpload, MAX_LABEL_BATCH } from "./labelPayload";

describe("buildVerificationLabels", () => {
  it("does not attach stale text fallback to uploaded images", () => {
    const labels = buildVerificationLabels(
      [{ fileName: "portal-screenshot.png", mimeType: "image/png", dataUrl: "data:image/png;base64,abc" }],
      "OLD TOM DISTILLERY",
    );

    expect(labels).toEqual([{ fileName: "portal-screenshot.png", mimeType: "image/png", dataUrl: "data:image/png;base64,abc" }]);
  });

  it("keeps every uploaded batch item distinct", () => {
    const labels = buildVerificationLabels(
      [
        { labelId: "a", fileName: "front.png", mimeType: "image/png", dataUrl: "data:image/png;base64,front" },
        { labelId: "b", fileName: "back.png", mimeType: "image/png", dataUrl: "data:image/png;base64,back" },
      ],
      "OLD TOM DISTILLERY",
    );

    expect(labels).toEqual([
      { labelId: "a", fileName: "front.png", mimeType: "image/png", dataUrl: "data:image/png;base64,front" },
      { labelId: "b", fileName: "back.png", mimeType: "image/png", dataUrl: "data:image/png;base64,back" },
    ]);
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

  it("creates a typed label when no uploaded labels exist", () => {
    const labels = buildVerificationLabels([], "Typed label text");

    expect(labels).toEqual([{ fileName: "typed-label", text: "Typed label text" }]);
  });

  it("does not preserve blank fallback text on text-only labels", () => {
    const labels = buildVerificationLabels([{ fileName: "blank.txt" }], "   ");

    expect(labels).toEqual([{ fileName: "blank.txt" }]);
  });

  it("documents the same 25 label batch limit used by the UI and API", () => {
    expect(MAX_LABEL_BATCH).toBe(25);
    expect(batchLimitError(25)).toBeNull();
    expect(batchLimitError(26)).toBe("Batch limit is 25 labels. Select 25 or fewer files.");
  });

  it("keeps drag and drop folder imports scoped to image files", () => {
    expect(isImageLikeUpload({ name: "label-front.png", type: "image/png" })).toBe(true);
    expect(isImageLikeUpload({ name: "phone-capture.HEIC", type: "" })).toBe(true);
    expect(isImageLikeUpload({ name: "source-record.pdf", type: "application/pdf" })).toBe(false);
  });
});
