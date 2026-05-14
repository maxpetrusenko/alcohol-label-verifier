#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";

const GENERATED_DIR = "public/evals/fixtures/generated";
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

async function extractImage(dataUrl) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Extract only text and fields visible on this alcohol label image. Do not decide compliance. Preserve exact visible wording where legible.",
            },
            { type: "input_image", image_url: dataUrl, detail: "high" },
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
    return { error: `provider status ${response.status}: ${(await response.text()).slice(0, 240)}` };
  }

  try {
    return JSON.parse(readResponseText(await response.json()) || "{}");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "unreadable model JSON" };
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
    },
    observed: extraction,
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for live vision eval. Deterministic tests intentionally avoid model calls.");
  }

  const root = process.cwd();
  const limit = Number(argValue("--limit", String(DEFAULT_LIMIT)));
  const out = argValue("--out", DEFAULT_OUT);
  const manifest = JSON.parse(readFileSync(join(root, GENERATED_DIR, "manifest.json"), "utf8"));
  const fixtures = manifest.filter((fixture) => existsSync(join(root, GENERATED_DIR, `${fixture.id}.png`))).slice(0, limit);

  const results = [];
  for (const fixture of fixtures) {
    const extraction = await extractImage(imageDataUrl(join(root, GENERATED_DIR, `${fixture.id}.png`)));
    results.push(scoreFixture(fixture, extraction));
  }

  const fieldTotals = results.reduce(
    (acc, result) => {
      acc.matched += result.matched;
      acc.total += result.total;
      return acc;
    },
    { matched: 0, total: 0 },
  );
  const report = {
    model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
    total: results.length,
    allMatched: results.filter((result) => result.allMatched).length,
    fieldAccuracy: fieldTotals.total ? fieldTotals.matched / fieldTotals.total : 0,
    results,
  };

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`vision eval: ${report.allMatched}/${report.total} full matches, field accuracy ${Math.round(report.fieldAccuracy * 100)}%. report=${out}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
