import { extractionFromPlainText } from "./rules";
import type { LabelExtraction } from "./types";

export type ExtractableLabel = {
  fileName: string;
  mimeType?: string;
  dataUrl?: string;
  text?: string;
};

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    labelText: { type: "string" },
    brandName: { type: "string" },
    classType: { type: "string" },
    alcoholContent: { type: "string" },
    netContents: { type: "string" },
    governmentWarning: { type: "string" },
    bottlerAddress: { type: "string" },
    countryOfOrigin: { type: "string" },
    confidence: { type: "number" },
    notes: { type: "array", items: { type: "string" } },
  },
  required: [
    "labelText",
    "brandName",
    "classType",
    "alcoholContent",
    "netContents",
    "governmentWarning",
    "bottlerAddress",
    "countryOfOrigin",
    "confidence",
    "notes",
  ],
};

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizeProviderError(status: number, message: string): string {
  const compact = message.replace(/\s+/g, " ").trim();
  return `Vision extraction failed with provider status ${status}: ${compact.slice(0, 180)}`;
}

function mergeExtraction(parsed: LabelExtraction, fallback?: LabelExtraction): LabelExtraction {
  return {
    labelText: parsed.labelText || fallback?.labelText || "",
    brandName: cleanOptional(parsed.brandName) || fallback?.brandName,
    classType: cleanOptional(parsed.classType) || fallback?.classType,
    alcoholContent: cleanOptional(parsed.alcoholContent) || fallback?.alcoholContent,
    netContents: cleanOptional(parsed.netContents) || fallback?.netContents,
    governmentWarning: cleanOptional(parsed.governmentWarning) || fallback?.governmentWarning,
    bottlerAddress: cleanOptional(parsed.bottlerAddress),
    countryOfOrigin: cleanOptional(parsed.countryOfOrigin),
    confidence: parsed.confidence ?? fallback?.confidence ?? 0.5,
    notes: parsed.notes?.length ? parsed.notes : fallback?.notes ?? ["Vision model returned structured fields."],
  };
}

function readResponseText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const direct = (data as { output_text?: unknown }).output_text;
  if (typeof direct === "string") return direct;

  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";

  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) return text;
    }
  }

  return "";
}

export async function extractLabel(label: ExtractableLabel): Promise<LabelExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  const fallback = label.text ? extractionFromPlainText(label.text) : undefined;
  if (!apiKey || !label.dataUrl) {
    return fallback ?? extractionFromPlainText("");
  }

  const prompt = `You are a careful TTB alcohol-label extraction assistant.
Extract only text and fields visible on the submitted label image. Do not decide compliance.
Return strict JSON with labelText, brandName, classType, alcoholContent, netContents, governmentWarning, bottlerAddress, countryOfOrigin, confidence, notes.
Do not invent missing text. Preserve exact government warning capitalization and punctuation when legible.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: label.dataUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "label_extraction",
          strict: true,
          schema: extractionSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    return {
      ...(fallback ?? extractionFromPlainText("")),
      confidence: fallback?.confidence ?? 0,
      notes: [sanitizeProviderError(response.status, message)],
    };
  }

  try {
    const data = await response.json();
    return mergeExtraction(JSON.parse(readResponseText(data) || "{}") as LabelExtraction, fallback);
  } catch (error) {
    return {
      ...(fallback ?? extractionFromPlainText("")),
      confidence: fallback?.confidence ?? 0,
      notes: [`Vision extraction returned unreadable JSON: ${error instanceof Error ? error.message : "unknown parse error"}`],
    };
  }
}

export function buildExtractionGuidance(extraction: LabelExtraction) {
  const found = [
    extraction.brandName && "brand",
    extraction.classType && "class/type",
    extraction.alcoholContent && "ABV/proof",
    extraction.netContents && "net contents",
    extraction.governmentWarning && "government warning",
  ].filter(Boolean);

  const missing = [
    !extraction.brandName && "brand",
    !extraction.classType && "class/type",
    !extraction.alcoholContent && "ABV/proof",
    !extraction.netContents && "net contents",
    !extraction.governmentWarning && "government warning",
  ].filter(Boolean);

  return {
    title: missing.length ? "Photo read, but more evidence is needed" : "Photo read and ready to compare",
    found,
    missing,
    nextSteps: [
      "Confirm or import the COLA application facts for the same SKU.",
      missing.length ? `Retake or add another panel if these fields are on the package: ${missing.join(", ")}.` : "Run comparison against the application record.",
      "Use the rule results as a review aid; the human reviewer keeps final disposition.",
    ],
  };
}
