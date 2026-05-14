export type PendingLabel = {
  labelId?: string;
  fileName: string;
  mimeType?: string;
  dataUrl?: string;
  text?: string;
};

export const MAX_LABEL_BATCH = 25;

export function batchLimitError(count: number) {
  return count > MAX_LABEL_BATCH ? `Batch limit is ${MAX_LABEL_BATCH} labels. Select ${MAX_LABEL_BATCH} or fewer files.` : null;
}

export function isImageLikeUpload(file: { name: string; type: string }) {
  return file.type.startsWith("image/") || /\.(avif|gif|heic|jpe?g|png|webp)$/iu.test(file.name);
}

function withOptionalText(label: PendingLabel, text?: string): PendingLabel {
  if (!text) {
    const rest = { ...label };
    delete rest.text;
    return rest;
  }

  return { ...label, text };
}

export function buildVerificationLabels(labels: PendingLabel[], fallbackText: string): PendingLabel[] {
  const fallback = fallbackText.trim();

  if (!labels.length) {
    return [{ fileName: "typed-label", text: fallback }];
  }

  return labels.map((label) => {
    const explicitText = label.text?.trim();
    const text = explicitText || (!label.dataUrl ? fallback : undefined);
    return withOptionalText(label, text);
  });
}
