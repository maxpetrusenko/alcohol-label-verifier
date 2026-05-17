export type VisionTraceInput = {
  provider: "gemini" | "openai";
  model: string;
  endpoint: string;
  fileName: string;
  mimeType?: string;
  hasImage: boolean;
  hasFallbackText: boolean;
  fallbackTextLength: number;
};
