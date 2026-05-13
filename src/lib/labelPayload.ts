export type PendingLabel = {
  fileName: string;
  mimeType?: string;
  dataUrl?: string;
  text?: string;
};

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
