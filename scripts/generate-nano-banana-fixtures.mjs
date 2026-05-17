#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const DEFAULT_MODEL = "gemini-2.5-flash-image";
const DEFAULT_OUT_DIR = "public/evals/fixtures/stress-nano-scenes";

const SCENES = [
  {
    id: "nano-scene-many-bottles-storage",
    title: "Many distilled liquor bottles in storage",
    expectedDecision: "needs_review",
    prompt:
      "Photorealistic product photo in a liquor storage room: many distilled spirits bottles on wooden shelves, labels facing different directions, some labels partly readable, one bourbon bottle in front but not clearly isolated. Warm cellar lighting, realistic glass reflections, no real brand names, no people. The scene should make it ambiguous which one bottle should be verified.",
    visualObservation:
      "AI-generated scene: many alcohol bottles are visible in one storage photo, so the target label is not isolated enough for automated comparison.",
  },
  {
    id: "nano-scene-covered-pouring-label",
    title: "Pouring bottle with hand covering label",
    expectedDecision: "needs_review",
    prompt:
      "Photorealistic close-up of an adult hand pouring amber distilled liquor from a bottle into a tasting glass on a kitchen counter. The hand and pouring angle cover most of the bottle label; only a small blank cream label edge is visible. No real brand names. Natural window light, shallow depth of field, realistic glass and liquid.",
    visualObservation:
      "AI-generated scene: a foreground hand and pouring angle cover the bottle label, so required label facts cannot be verified from this photo.",
  },
  {
    id: "nano-scene-top-down-glare",
    title: "Top-down bottle angle with glare",
    expectedDecision: "needs_review",
    prompt:
      "Photorealistic phone photo of a single distilled spirits bottle photographed from directly above and slightly toward the neck, so the front label is foreshortened and angled away from camera. The bottle lies on a bright bar counter with strong sun glare crossing the label, and label text is partly washed out. No real brand names, no people. High realism.",
    visualObservation:
      "AI-generated scene: top-down viewpoint and sun glare obscure the front label, so the reviewer should request a clearer isolated label image.",
  },
  {
    id: "nano-scene-dark-low-light-shelf",
    title: "Dark shelf photo with multiple bottles",
    expectedDecision: "needs_review",
    prompt:
      "Photorealistic low-light phone photo inside a dim bar shelf: several whiskey and gin bottles, dark shadows, reflections, one target-looking bottle near center with label too dark to read completely. No real brand names, no readable trademarked labels. Realistic camera noise and underexposure.",
    visualObservation:
      "AI-generated scene: low light plus multiple bottles makes the target and required label text uncertain.",
  },
  {
    id: "nano-scene-crowded-counter-overlap",
    title: "Crowded counter with overlapping bottles",
    expectedDecision: "needs_review",
    prompt:
      "Photorealistic crowded tasting counter with four distilled spirits bottles overlapping each other, some labels blocked by bottle shoulders, a small tasting glass and corks nearby, mixed glare on glass. No real brand names, no people, no faces, no hands. The photo should look like a casual phone snapshot rather than a clean product shot.",
    visualObservation:
      "AI-generated scene: multiple overlapping bottles and glare mean the app should ask the reviewer to isolate the product or split the photo into separate labels.",
  },
  {
    id: "nano-single-clean-distilled-spirits",
    title: "Clean single distilled spirits bottle",
    expectedDecision: "needs_review",
    prompt:
      "Photorealistic clean product photo of one distilled spirits bottle, centered, straight-on, no hand, no other bottles, label large and visible. Use a fictional brand only, avoid real brands. Label should include generic bourbon styling, 45% Alc./Vol., 750 mL, and a government warning block, but do not use any trademarked text.",
    visualObservation:
      "AI-generated clean single-bottle control. Use as demo visual only because generated label text may not be legally exact.",
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

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function geminiApiKey() {
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

async function generateScene({ apiKey, model, scene }) {
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
            {
              text: `${scene.prompt}

Generate one realistic image. This is for a compliance-review prototype fixture. Avoid real alcohol brands or logos. Do not depict minors. Do not include marketing slogans.`,
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json().catch(async () => ({ errorText: await response.text() }));
  if (!response.ok) {
    throw new Error(`Gemini image generation failed for ${scene.id}: ${response.status} ${JSON.stringify(data).slice(0, 500)}`);
  }

  const imagePart = firstImagePart(data);
  if (!imagePart) {
    throw new Error(`Gemini did not return an image for ${scene.id}. Text: ${textParts(data).join(" ").slice(0, 500)}`);
  }

  const inlineData = imagePart.inlineData ?? imagePart.inline_data;
  const mimeType = inlineData.mimeType ?? inlineData.mime_type ?? "image/png";
  const buffer = Buffer.from(inlineData.data, "base64");
  return { buffer, mimeType, providerText: textParts(data) };
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const apiKey = geminiApiKey();
  if (!apiKey) throw new Error("Set GEMINI_API_KEY, GOOGLE_API_KEY, GEMINI_API_KEY_MAX, or GEMINI_API_KEY_TURKEY.");

  const model = argValue("--model", process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL);
  const outDir = resolve(process.cwd(), argValue("--out", DEFAULT_OUT_DIR));
  const limit = Number(argValue("--limit", String(SCENES.length)));
  const selected = SCENES.slice(0, limit);
  mkdirSync(outDir, { recursive: true });

  const manifest = [];
  for (const scene of selected) {
    console.log(`generating ${scene.id} with ${model}`);
    const generated = await generateScene({ apiKey, model, scene });
    const extension = extFromMime(generated.mimeType);
    const fileName = `${scene.id}.${extension}`;
    const imagePath = join(outDir, fileName);
    writeFileSync(imagePath, generated.buffer);

    const item = {
      schemaVersion: 1,
      id: scene.id,
      title: scene.title,
      provider: "gemini",
      model,
      mimeType: generated.mimeType,
      image: `${DEFAULT_OUT_DIR}/${basename(imagePath)}`,
      imageHash: hashBuffer(generated.buffer),
      expectedDecision: scene.expectedDecision,
      expectedProblemChecks: ["image-quality"],
      visualObservation: scene.visualObservation,
      prompt: scene.prompt,
      providerText: generated.providerText,
      caveat: "AI-generated demo/eval visual. Do not use as deterministic legal-text ground truth; generated label text may be inaccurate.",
    };
    writeFileSync(join(outDir, `${scene.id}.json`), `${JSON.stringify(item, null, 2)}\n`);
    manifest.push(item);
  }

  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${manifest.length} Nano Banana fixtures to ${outDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
