import { describe, expect, it } from "vitest";
import {
  batchLimitError,
  buildVerificationLabels,
  chunkVerificationLabels,
  isImageLikeUpload,
  MAX_LABEL_BATCH,
  VERIFY_REQUEST_LABEL_LIMIT,
} from "./labelPayload";

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

  it("documents the UI batch limit and per-request API chunk size", () => {
    expect(MAX_LABEL_BATCH).toBe(300);
    expect(VERIFY_REQUEST_LABEL_LIMIT).toBe(25);
    expect(batchLimitError(300)).toBeNull();
    expect(batchLimitError(301)).toBe("Batch limit is 300 labels. Select 300 or fewer files.");
  });

  it("chunks large browser batches into API-sized verify requests", () => {
    const labels = Array.from({ length: 60 }, (_, index) => ({ fileName: `label-${index}.png` }));
    const chunks = chunkVerificationLabels(labels);

    expect(chunks).toHaveLength(3);
    expect(chunks.map((chunk) => chunk.length)).toEqual([25, 25, 10]);
    expect(chunks[2][9]).toEqual({ fileName: "label-59.png" });
  });

  it("keeps drag and drop folder imports scoped to image files", () => {
    expect(isImageLikeUpload({ name: "label-front.png", type: "image/png" })).toBe(true);
    expect(isImageLikeUpload({ name: "phone-capture.HEIC", type: "" })).toBe(true);
    expect(isImageLikeUpload({ name: "source-record.pdf", type: "application/pdf" })).toBe(false);
  });
});
