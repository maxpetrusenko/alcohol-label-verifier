#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";

const GENERATED_DIR = "public/evals/fixtures/spirits-generated-canonical";
const DEFAULT_LIMIT = 10;
const DEFAULT_OUT = "/tmp/labelcheck-vision-model-eval.json";

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

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function normalize(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
}

function fieldMatch(expected = "", observed = "") {
  const expectedNorm = normalize(expected);
  const observedNorm = normalize(observed);
  if (!expectedNorm) return true;
  if (!observedNorm) return false;
  return observedNorm.includes(expectedNorm) || expectedNorm.includes(observedNorm);
}

function imageDataUrl(path) {
  const ext = extname(path).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${readFileSync(path).toString("base64")}`;
}

function readResponseText(data) {
  if (typeof data !== "object" || data === null) return "";
  if (typeof data.output_text === "string") return data.output_text;
  if (!Array.isArray(data.output)) return "";

  for (const item of data.output) {
    if (!item || typeof item !== "object" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part && typeof part === "object" && typeof part.text === "string" && part.text.trim()) return part.text;
    }
  }

  return "";
}

function readChatCompletionText(data) {
  if (typeof data !== "object" || data === null) return "";
  if (!Array.isArray(data.choices)) return "";
  const content = data.choices[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

function readGeminiText(data) {
  if (typeof data !== "object" || data === null) return "";
  const parts = data.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  for (const part of parts) {
    if (typeof part?.text === "string" && part.text.trim()) return part.text;
  }
  return "";
}

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/u);
  if (!match) return undefined;
  return { mimeType: match[1], base64: match[2] };
}

function maxOutputTokens() {
  const parsed = Number.parseInt(process.env.VISION_MAX_OUTPUT_TOKENS || process.env.OPENAI_VISION_MAX_OUTPUT_TOKENS || "450", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 450;
}

function geminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY_MAX || process.env.GEMINI_API_KEY_TURKEY;
}

function providerConfig() {
  const provider = process.env.VISION_PROVIDER === "openai" ? "openai" : "gemini";
  if (provider === "openai") {
    return {
      provider,
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-nano",
      apiKey: process.env.OPENAI_API_KEY,
    };
  }
  return {
    provider,
    model: process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash-lite",
    apiKey: geminiApiKey(),
  };
}

async function callOpenAiVision(apiKey, prompt, dataUrl) {
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-nano";
  const detail = process.env.OPENAI_IMAGE_DETAIL || "low";
  const tokens = maxOutputTokens();

  if (process.env.OPENAI_VISION_ENDPOINT === "responses") {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_output_tokens: tokens,
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
    });
    return { response, readText: readResponseText };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: tokens,
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
            {
              type: "text",
              text: prompt,
            },
            { type: "image_url", image_url: { url: dataUrl, detail } },
          ],
        },
      ],
    }),
  });

  return { response, readText: readChatCompletionText };
}

async function callGeminiVision(apiKey, prompt, dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error("Gemini vision requires a base64 data URL.");
  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash-lite";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
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
        maxOutputTokens: maxOutputTokens(),
        temperature: 0,
      },
    }),
  });

  return { response, readText: readGeminiText };
}

async function extractImage(dataUrl, config) {
  const prompt = "Extract only text and fields visible on this alcohol label image. Do not decide compliance. Preserve exact visible wording where legible.";
  const started = Date.now();
  const { response, readText } =
    config.provider === "openai" ? await callOpenAiVision(config.apiKey, prompt, dataUrl) : await callGeminiVision(config.apiKey, prompt, dataUrl);
  const latencyMs = Date.now() - started;

  if (!response.ok) {
    return { latencyMs, extraction: { error: `provider status ${response.status}: ${(await response.text()).slice(0, 240)}` } };
  }

  try {
    return { latencyMs, extraction: JSON.parse(readText(await response.json()) || "{}") };
  } catch (error) {
    return { latencyMs, extraction: { error: error instanceof Error ? error.message : "unreadable model JSON" } };
  }
}

function scoreFixture(fixture, extraction) {
  const expected = fixture.form_data;
  const fieldResults = {
    brandName: fieldMatch(expected.brand_name, extraction.brandName),
    classType: fieldMatch(expected.class_type, extraction.classType),
    alcoholContent: fieldMatch(expected.abv, extraction.alcoholContent),
    netContents: fieldMatch(expected.net_contents, extraction.netContents),
    bottlerAddress: fieldMatch([expected.bottler_name, expected.bottler_address].filter(Boolean).join(" "), extraction.bottlerAddress),
    countryOfOrigin: fieldMatch(expected.country_of_origin, extraction.countryOfOrigin),
  };
  const matched = Object.values(fieldResults).filter(Boolean).length;

  return {
    id: fixture.id,
    description: fixture.description,
    matched,
    total: Object.keys(fieldResults).length,
    allMatched: matched === Object.keys(fieldResults).length,
    fieldResults,
    expected: {
      brandName: expected.brand_name,
      classType: expected.class_type,
      alcoholContent: expected.abv,
      netContents: expected.net_contents,
      bottlerAddress: [expected.bottler_name, expected.bottler_address].filter(Boolean).join(", "),
      countryOfOrigin: expected.country_of_origin,
    },
    observed: extraction,
  };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

async function main() {
  const config = providerConfig();
  if (!config.apiKey) {
    throw new Error(`${config.provider} API key is required for live vision eval. Deterministic tests intentionally avoid model calls.`);
  }

  const root = process.cwd();
  const limit = Number(argValue("--limit", String(DEFAULT_LIMIT)));
  const out = argValue("--out", DEFAULT_OUT);
  const manifest = JSON.parse(readFileSync(join(root, GENERATED_DIR, "manifest.json"), "utf8"));
  const fixtures = manifest.filter((fixture) => existsSync(join(root, GENERATED_DIR, `${fixture.id}.png`))).slice(0, limit);

  const results = [];
  for (const fixture of fixtures) {
    const { latencyMs, extraction } = await extractImage(imageDataUrl(join(root, GENERATED_DIR, `${fixture.id}.png`)), config);
    results.push({ ...scoreFixture(fixture, extraction), latencyMs });
  }

  const latencies = results.map((result) => result.latencyMs).filter((value) => Number.isFinite(value));
  const fieldTotals = results.reduce(
    (acc, result) => {
      acc.matched += result.matched;
      acc.total += result.total;
      return acc;
    },
    { matched: 0, total: 0 },
  );
  const report = {
    provider: config.provider,
    model: config.model,
    total: results.length,
    allMatched: results.filter((result) => result.allMatched).length,
    fieldAccuracy: fieldTotals.total ? fieldTotals.matched / fieldTotals.total : 0,
    speed: {
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95),
      maxMs: latencies.length ? Math.max(...latencies) : 0,
      underFiveSeconds: results.filter((result) => result.latencyMs <= 5000).length,
    },
    results,
  };

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `vision eval: ${config.provider}/${config.model}: ${report.allMatched}/${report.total} full matches, field accuracy ${Math.round(
      report.fieldAccuracy * 100,
    )}%, p95 ${report.speed.p95Ms}ms. report=${out}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
