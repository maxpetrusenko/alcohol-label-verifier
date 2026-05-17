#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const DEFAULT_MODEL = "gemini-2.5-flash-image";
const OUT_REL = "public/evals/fixtures/wine-nano-fail-review";

const scenes = [
  {
    id: "wine-generated-review-01",
    title: "Generated wine review case",
    expectedDecision: "needs_review",
    expectedProblemChecks: ["alcohol-content", "net-contents", "bottler-address"],
    application: {
      brandName: "SILVER RIDGE CELLARS",
      classType: "Red Wine",
      alcoholContent: "13.5% Alc./Vol.",
      netContents: "750 mL",
      bottlerAddress: "Silver Ridge Cellars, Sonoma, CA",
      countryOfOrigin: "United States",
      beverageKind: "wine",
      imported: false,
    },
    prompt: `Generate a realistic studio photo of one isolated real glass wine bottle, front and back labels both visible, no real brands, no logos from existing wineries, no extra bottles, no hands, no shelf. Product should look like a premium California red wine.

The label text must be crisp, readable, and exactly consistent with this JSON application record. Do not add contradictory text.

Front label:
BRAND: SILVER RIDGE CELLARS
CLASS/TYPE: Red Wine
APPELLATION: California
VINTAGE: 2023

Back label:
Alc. 13.5% By Vol.
750 mL
Contains sulfites.
Produced and bottled by Silver Ridge Cellars, Sonoma, CA
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`,
    visualObservation: "AI-generated wine bottle with visibly garbled compliance text; expected reviewer attention, not approval.",
  },
  {
    id: "wine-generated-warning-fail-01",
    title: "Generated wine warning text fail",
    expectedDecision: "rejected",
    expectedProblemChecks: ["government-warning"],
    application: {
      brandName: "HARBOR GLEN VINEYARDS",
      classType: "Table Wine",
      alcoholContent: "",
      netContents: "750 mL",
      bottlerAddress: "Harbor Glen Vineyards, Dundee, OR",
      countryOfOrigin: "United States",
      beverageKind: "wine",
      imported: false,
    },
    prompt: `Generate a realistic photo of one isolated real glass wine bottle, slightly imperfect but usable reviewer photo. Single bottle only. No real brands. Back label has mild glare over part of the Government Warning and slight perspective angle, but most text remains readable. Do not add extra products.

Front label:
BRAND: HARBOR GLEN VINEYARDS
CLASS/TYPE: Table Wine
APPELLATION: Oregon
VINTAGE: 2022

Back label:
750 mL
Contains sulfites.
Produced and bottled by Harbor Glen Vineyards, Dundee, OR
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.

Important: Do not show a numeric alcohol content statement. This is intentional because Table Wine can stand in for 7-14% wine alcohol statement in this test, but the glare should make exact warning verification uncertain.`,
    visualObservation: "AI-generated wine bottle with materially incomplete or garbled Government Warning; expected rejection.",
  },
  {
    id: "wine-generated-fail-01",
    title: "Generated wine mismatch fail",
    expectedDecision: "rejected",
    expectedProblemChecks: ["brand-name", "bottler-address", "country-origin"],
    application: {
      brandName: "LANTERN HILL",
      classType: "White Wine",
      alcoholContent: "12.5% Alc./Vol.",
      netContents: "750 mL",
      bottlerAddress: "Northstar Imports, New York, NY",
      countryOfOrigin: "Italy",
      beverageKind: "wine",
      imported: true,
    },
    prompt: `Generate a realistic studio photo of one isolated imported wine bottle, front and back labels both visible, no real brands, no real appellation logos, no other bottles. The label should look like a French white wine imported into the United States.

Make the visible label intentionally conflict with the JSON application record.

Front label visible text:
BRAND: LAURENT HILL
CLASS/TYPE: White Wine
COUNTRY: Product of France
VINTAGE: 2023

Back label visible text:
Alc. 12.5% By Vol.
750 mL
Contains sulfites.
Imported by Northstar Imports, New York, NY
Product of France
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`,
    visualObservation: "AI-generated imported wine bottle with mismatched/garbled visible fields; expected rejection.",
  },
];

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").replace(/^["']|["']$/gu, "");
  }
}

function apiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY_MAX || process.env.GEMINI_API_KEY_TURKEY;
}

function responseParts(data) {
  return data?.candidates?.flatMap((candidate) => candidate?.content?.parts ?? []) ?? [];
}

function firstImagePart(data) {
  return responseParts(data).find((part) => part.inlineData?.data || part.inline_data?.data);
}

function textParts(data) {
  return responseParts(data)
    .map((part) => part.text)
    .filter(Boolean);
}

function extFromMime(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

async function generateScene({ scene, key, model, outDir }) {
  console.log(`generating ${scene.id} with ${model}`);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `${scene.prompt}

Generate one realistic image. This is for a compliance-review prototype fixture. Avoid real alcohol brands or logos. Do not depict minors. Do not include marketing slogans. Ensure all visible label text is large, crisp, and legible.`,
            },
          ],
        },
      ],
    }),
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : {};
  if (!response.ok) throw new Error(`Gemini image generation failed for ${scene.id}: ${response.status} ${raw.slice(0, 500)}`);

  const imagePart = firstImagePart(data);
  if (!imagePart) throw new Error(`Gemini did not return image for ${scene.id}. Text: ${textParts(data).join(" ").slice(0, 500)}`);

  const inlineData = imagePart.inlineData ?? imagePart.inline_data;
  const mimeType = inlineData.mimeType ?? inlineData.mime_type ?? "image/png";
  const buffer = Buffer.from(inlineData.data, "base64");
  const imagePath = join(outDir, `${scene.id}.${extFromMime(mimeType)}`);
  writeFileSync(imagePath, buffer);

  const item = {
    schemaVersion: 1,
    id: scene.id,
    title: scene.title,
    provider: "gemini",
    model,
    mimeType,
    image: `${OUT_REL}/${basename(imagePath)}`,
    imageHash: hashBuffer(buffer),
    expectedDecision: scene.expectedDecision,
    expectedProblemChecks: scene.expectedProblemChecks,
    application: scene.application,
    visualObservation: scene.visualObservation,
    prompt: scene.prompt,
    providerText: textParts(data),
    caveat: "AI-generated wine demo/eval visual. Verify text manually before treating as deterministic legal-text ground truth.",
  };
  writeFileSync(join(outDir, `${scene.id}.json`), `${JSON.stringify(item, null, 2)}\n`);
  return item;
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const key = apiKey();
  if (!key) throw new Error("Set GEMINI_API_KEY, GOOGLE_API_KEY, GEMINI_API_KEY_MAX, or GEMINI_API_KEY_TURKEY.");

  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;
  const outDir = resolve(process.cwd(), OUT_REL);
  mkdirSync(outDir, { recursive: true });

  const manifest = await Promise.all(scenes.map((scene) => generateScene({ scene, key, model, outDir })));
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${manifest.length} Nano Banana wine fixtures to ${outDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
