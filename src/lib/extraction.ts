import { withBraintrustTrace } from "./braintrust";
export { buildExtractionGuidance } from "./extractionGuidance";
import { withLangSmithTrace, type VisionTraceInput } from "./langsmith";
import { extractionFromPlainText } from "./rules";
import type { LabelExtraction } from "./types";

export type ExtractableLabel = {
  fileName: string;
  mimeType?: string;
  dataUrl?: string;
  text?: string;
};

type VisionProvider = "gemini" | "openai";
type VisionCallResult = Awaited<ReturnType<typeof callGeminiVision>>;

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

function normalizeConfidence(value: number | undefined, fallback = 0.5): number {
  const confidence = value ?? fallback;
  if (!Number.isFinite(confidence)) return fallback;
  if (confidence > 1 && confidence <= 100) return confidence / 100;
  return Math.max(0, Math.min(1, confidence));
}

function cleanGovernmentWarning(value: string | undefined): string | undefined {
  return cleanOptional(value)
    ?.replace(/\bGOVERMMENT\s+WARNING\s*:/iu, "GOVERNMENT WARNING:")
    .replace(/\bGOVERNRNENT\s+WARNING\s*:/iu, "GOVERNMENT WARNING:")
    .replace(/\bGOVERNMENT\s+WARN(?:I|l)NG\s*:/iu, "GOVERNMENT WARNING:");
}

function visibleGovernmentWarning(labelText: string): string | undefined {
  return labelText.match(/government\s+warning:[\s\S]+?(?:health problems\.?|$)/iu)?.[0].trim();
}

function sanitizeProviderError(status: number, message: string): string {
  const compact = message.replace(/\s+/g, " ").trim();
  return `Vision extraction failed with provider status ${status}: ${compact.slice(0, 180)}`;
}

function normalizeEvidence(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9.%/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function plausibleFieldValue(fieldLabel: string, value: string): boolean {
  const normalized = normalizeEvidence(value);
  if (normalized.length < 2) return false;

  switch (fieldLabel) {
    case "class/type":
      return /\b(?:bourbon|whisk(?:e)?y|vodka|gin|rum|tequila|mezcal|brandy|cognac|liqueur|cordial|wine|beer|ale|lager|stout|porter|malt|cider|spirits?)\b/iu.test(value);
    case "alcohol content":
      return /\b\d+(?:\.\d+)?\s*(?:%\s*(?:alc\.?\s*\/\s*vol\.?|abv|alcohol\s+by\s+volume)?|proof)\b/iu.test(value);
    case "net contents":
      return /\b\d+(?:\.\d+)?\s*(?:ml|l|liter|litre|fl\.?\s*oz\.?|ounces?)\b/iu.test(value);
    case "government warning":
      return /\bGOVERNMENT\s+WARNING\s*:/iu.test(value) && /pregnancy|drive a car|operate machinery|health problems/iu.test(value);
    case "bottler/address":
      return normalized.length >= 8 && (value.includes(",") || /\b(?:bottled|distilled|produced|imported|by|inc|llc|co|company|distiller|distillery|winery|brewery)\b/iu.test(value));
    case "country of origin":
      return normalized.length >= 2 && /[a-z]/iu.test(value);
    case "brand name":
    default:
      return normalized.length >= 2 && /[a-z0-9]/iu.test(value);
  }
}

function groundedValue(labelText: string, fieldLabel: string, value: string | undefined, notes: string[]) {
  const cleaned = cleanOptional(value);
  if (!cleaned) return undefined;
  if (!plausibleFieldValue(fieldLabel, cleaned)) {
    notes.push(`Removed ${fieldLabel} because it was too incomplete to use as extracted label evidence.`);
    return undefined;
  }
  if (!labelText.trim()) return cleaned;
  if (normalizeEvidence(labelText).includes(normalizeEvidence(cleaned))) {
    if (fieldLabel === "government warning") return visibleGovernmentWarning(labelText) ?? cleaned;
    return cleaned;
  }
  notes.push(`Removed ${fieldLabel} because it was not present in raw extracted label text.`);
  return undefined;
}

function mergeExtraction(parsed: LabelExtraction, fallback?: LabelExtraction): LabelExtraction {
  const labelText = parsed.labelText || fallback?.labelText || "";
  const notes = parsed.notes?.length ? [...parsed.notes] : fallback?.notes ? [...fallback.notes] : ["Vision model returned structured fields."];

  return {
    labelText,
    brandName: groundedValue(labelText, "brand name", cleanOptional(parsed.brandName) || fallback?.brandName, notes),
    classType: groundedValue(labelText, "class/type", cleanOptional(parsed.classType) || fallback?.classType, notes),
    alcoholContent: groundedValue(labelText, "alcohol content", cleanOptional(parsed.alcoholContent) || fallback?.alcoholContent, notes),
    netContents: groundedValue(labelText, "net contents", cleanOptional(parsed.netContents) || fallback?.netContents, notes),
    governmentWarning: groundedValue(labelText, "government warning", cleanGovernmentWarning(parsed.governmentWarning) || fallback?.governmentWarning, notes),
    bottlerAddress: groundedValue(labelText, "bottler/address", cleanOptional(parsed.bottlerAddress), notes),
    countryOfOrigin: groundedValue(labelText, "country of origin", cleanOptional(parsed.countryOfOrigin), notes),
    confidence: normalizeConfidence(parsed.confidence, fallback?.confidence ?? 0.5),
    notes,
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

function readChatCompletionText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return "";
  const first = choices[0];
  if (typeof first !== "object" || first === null) return "";
  const message = (first as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return "";
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : "";
}

function readGeminiText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const candidates = (data as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return "";
  const first = candidates[0];
  if (typeof first !== "object" || first === null) return "";
  const content = (first as { content?: unknown }).content;
  if (typeof content !== "object" || content === null) return "";
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return "";
  for (const part of parts) {
    if (typeof part !== "object" || part === null) continue;
    const text = (part as { text?: unknown }).text;
    if (typeof text === "string" && text.trim()) return text;
  }
  return "";
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | undefined {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/u);
  if (!match) return undefined;
  return { mimeType: match[1], base64: match[2] };
}

function parseMaxOutputTokens() {
  const value = Number.parseInt(process.env.VISION_MAX_OUTPUT_TOKENS || process.env.OPENAI_VISION_MAX_OUTPUT_TOKENS || "450", 10);
  return Number.isFinite(value) && value > 0 ? value : 450;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePrimaryVisionTimeoutMs() {
  return parsePositiveInt(process.env.VISION_TIMEOUT_MS, 2500);
}

function parseFallbackVisionTimeoutMs() {
  return parsePositiveInt(process.env.VISION_FALLBACK_TIMEOUT_MS, 1500);
}

async function fetchWithVisionTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Vision extraction timed out after ${timeoutMs} ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function selectedVisionModel(provider: VisionProvider) {
  return provider === "gemini" ? process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash-lite" : process.env.OPENAI_VISION_MODEL || "gpt-4.1-nano";
}

function selectedVisionEndpoint(provider: VisionProvider) {
  return provider === "gemini" ? "generateContent" : process.env.OPENAI_VISION_ENDPOINT || "chat_completions";
}

async function callOpenAiVision(apiKey: string, prompt: string, dataUrl: string, timeoutMs = parsePrimaryVisionTimeoutMs()) {
  const model = selectedVisionModel("openai");
  const detail = process.env.OPENAI_IMAGE_DETAIL || "low";
  const maxOutputTokens = parseMaxOutputTokens();

  if (process.env.OPENAI_VISION_ENDPOINT === "responses") {
    const response = await fetchWithVisionTimeout("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_output_tokens: maxOutputTokens,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: dataUrl, detail },
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
    }, timeoutMs);

    return { response, readText: readResponseText };
  }

  const response = await fetchWithVisionTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxOutputTokens,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "label_extraction",
          strict: true,
          schema: extractionSchema,
        },
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl, detail } },
          ],
        },
      ],
    }),
  }, timeoutMs);

  return { response, readText: readChatCompletionText };
}

async function callGeminiVision(apiKey: string, prompt: string, dataUrl: string, timeoutMs = parsePrimaryVisionTimeoutMs()) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error("Gemini vision requires a base64 data URL.");
  const model = selectedVisionModel("gemini");
  const maxOutputTokens = parseMaxOutputTokens();
  const response = await fetchWithVisionTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: parsed.mimeType,
                data: parsed.base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: extractionSchema,
        maxOutputTokens,
        temperature: 0,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    }),
  }, timeoutMs);

  return { response, readText: readGeminiText };
}

function geminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY_MAX || process.env.GEMINI_API_KEY_TURKEY;
}

function providerApiKey(provider: VisionProvider): string | undefined {
  return provider === "gemini" ? geminiApiKey() : process.env.OPENAI_API_KEY;
}

function timeoutNote(error: unknown) {
  return error instanceof Error && /timed out after \d+ ms/u.test(error.message) ? error.message : undefined;
}

function fallbackProvider(provider: VisionProvider): VisionProvider {
  return provider === "gemini" ? "openai" : "gemini";
}

function traceInputForLabel(label: ExtractableLabel, provider: VisionProvider): VisionTraceInput {
  return {
    provider,
    model: selectedVisionModel(provider),
    endpoint: selectedVisionEndpoint(provider),
    fileName: label.fileName,
    mimeType: label.mimeType,
    hasImage: Boolean(label.dataUrl),
    hasFallbackText: Boolean(label.text),
    fallbackTextLength: label.text?.length ?? 0,
  };
}

async function callVisionWithTrace(provider: VisionProvider, apiKey: string, label: ExtractableLabel, prompt: string, dataUrl: string, timeoutMs: number) {
  return withLangSmithTrace(
    traceInputForLabel(label, provider),
    () =>
      withBraintrustTrace(
        traceInputForLabel(label, provider),
        () => (provider === "gemini" ? callGeminiVision(apiKey, prompt, dataUrl, timeoutMs) : callOpenAiVision(apiKey, prompt, dataUrl, timeoutMs)),
        ({ response }) => ({
          provider,
          model: selectedVisionModel(provider),
          endpoint: selectedVisionEndpoint(provider),
          status: response.status,
          ok: response.ok,
        }),
      ),
    ({ response }) => ({
      provider,
      model: selectedVisionModel(provider),
      endpoint: selectedVisionEndpoint(provider),
      status: response.status,
      ok: response.ok,
    }),
  );
}

async function callVisionWithTimeoutFallback(provider: VisionProvider, label: ExtractableLabel, prompt: string, dataUrl: string) {
  const apiKey = providerApiKey(provider);
  if (!apiKey) return { result: undefined, notes: [] };

  const notes: string[] = [];
  try {
    return {
      result: await callVisionWithTrace(provider, apiKey, label, prompt, dataUrl, parsePrimaryVisionTimeoutMs()),
      notes,
    };
  } catch (error) {
    const note = timeoutNote(error);
    const backupProvider = fallbackProvider(provider);
    const backupApiKey = providerApiKey(backupProvider);
    if (!note || !backupApiKey) throw error;

    notes.push(`${provider} ${note}; retried with ${backupProvider}.`);
    try {
      return {
        result: await callVisionWithTrace(backupProvider, backupApiKey, label, prompt, dataUrl, parseFallbackVisionTimeoutMs()),
        notes,
      };
    } catch (fallbackError) {
      const fallbackNote = timeoutNote(fallbackError);
      if (!fallbackNote) throw fallbackError;
      notes.push(`${backupProvider} ${fallbackNote}.`);
      throw new Error(notes.join(" "));
    }
  }
}

export async function extractLabel(label: ExtractableLabel): Promise<LabelExtraction> {
  const provider: VisionProvider = process.env.VISION_PROVIDER === "openai" ? "openai" : "gemini";
  const fallback = label.text ? extractionFromPlainText(label.text) : undefined;
  if (!providerApiKey(provider) || !label.dataUrl) {
    return fallback ?? extractionFromPlainText("");
  }
  const dataUrl = label.dataUrl;

  const prompt = `You are a careful TTB alcohol-label extraction assistant.
Extract only text and fields visible on the submitted label image. Do not decide compliance.
Return strict JSON with labelText, brandName, classType, alcoholContent, netContents, governmentWarning, bottlerAddress, countryOfOrigin, confidence, notes. Keep labelText to required snippets only, max 600 characters.
First assess whether the image contains exactly one isolated product label/bottle. If multiple bottles, multiple readable labels, a shelf/rack, a crowded counter, or no clear target product is visible, do not guess which product to verify. Leave fields empty unless a single target label is clearly isolated, set confidence low, and include the exact note "target label not isolated: multiple bottles or labels visible".
Do not infer from bottle shape, common container sizes, common warning text, or product category. If a value is not readable in the image, leave that field empty and explain the visibility problem in notes.
Every non-empty structured field must be copied from visible text also present in labelText. Do not return 750 mL, ABV/proof, government warning text, bottler address, or country of origin unless those characters are legible.
Do not shorten or generalize class/type wording; preserve the full visible designation line when legible.
Set governmentWarning only to the exact visible warning statement, including the leading "GOVERNMENT WARNING:" prefix when present. Preserve warning capitalization and punctuation when legible.`;

  const { result, notes } = await callVisionWithTimeoutFallback(provider, label, prompt, dataUrl);
  if (!result) return fallback ?? extractionFromPlainText("");
  const { response, readText } = result as VisionCallResult;

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
    const extraction = mergeExtraction(JSON.parse(readText(data) || "{}") as LabelExtraction, fallback);
    return notes.length ? { ...extraction, notes: [...notes, ...extraction.notes] } : extraction;
  } catch (error) {
    return {
      ...(fallback ?? extractionFromPlainText("")),
      confidence: fallback?.confidence ?? 0,
      notes: [...notes, `Vision extraction returned unreadable JSON: ${error instanceof Error ? error.message : "unknown parse error"}`],
    };
  }
}
