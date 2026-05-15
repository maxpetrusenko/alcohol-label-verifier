#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const GENERATED_DIR = "public/evals/fixtures/generated";
const OUT_DIR = "public/evals/fixtures/degraded-samples";
const SCENE_SIZE = "1024x683";

function hasMagick() {
  try {
    execFileSync("magick", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadSource(root, id) {
  const manifest = readJson(join(root, GENERATED_DIR, "manifest.json"));
  const manifestItem = manifest.find((item) => item.id === id);
  return {
    id,
    imagePath: join(root, GENERATED_DIR, `${id}.png`),
    form_data: readJson(join(root, GENERATED_DIR, `${id}.json`)),
    image_prompt: manifestItem?.image_prompt ?? "",
    expected_behavior: manifestItem?.expected_behavior ?? manifestItem?.expectedBehavior ?? "Scene sample needs reviewer isolation.",
  };
}

function makeThumb(tempDir, source, name, width, height, rotate = 0) {
  const out = join(tempDir, `${name}.png`);
  execFileSync("magick", [
    source.imagePath,
    "-resize",
    `${width}x${height}^`,
    "-gravity",
    "center",
    "-extent",
    `${width}x${height}`,
    "-background",
    "none",
    "-rotate",
    String(rotate),
    out,
  ]);
  return out;
}

function compositeScene(baseArgs, overlays, outputPath) {
  const args = [...baseArgs];
  for (const overlay of overlays) {
    args.push(overlay.path, "-geometry", `+${overlay.x}+${overlay.y}`, "-composite");
  }
  args.push("-quality", "82", outputPath);
  execFileSync("magick", args, { stdio: "pipe" });
}

function sceneItem({ id, source, title, variant, imageHash, visualObservation }) {
  const fileName = `${id}.jpg`;
  return {
    schemaVersion: 1,
    id,
    sourceId: source.id,
    title,
    photoQuality: "bad",
    variant,
    degradationFamily: variant,
    severityLevel: 8,
    orientation: "scene",
    angleDegrees: 0,
    sourceImage: `${GENERATED_DIR}/${source.id}.png`,
    image: `${OUT_DIR}/${fileName}`,
    imageHash,
    form_data: source.form_data,
    image_prompt: source.image_prompt,
    expectedSourceBehavior: source.expected_behavior,
    expectedDecision: "needs_review",
    expectedProblemChecks: ["image-quality"],
    extractionConfidence: 0.38,
    visualObservation,
  };
}

function writeScene(root, outDir, tempDir, scene) {
  const outputPath = join(root, outDir, `${scene.id}.jpg`);
  scene.draw(outputPath);
  const item = sceneItem({
    id: scene.id,
    source: scene.source,
    title: scene.title,
    variant: scene.variant,
    imageHash: hashFile(outputPath),
    visualObservation: scene.visualObservation,
  });
  writeFileSync(join(root, outDir, `${scene.id}.json`), `${JSON.stringify(item, null, 2)}\n`);
  return item;
}

function main() {
  if (!hasMagick()) throw new Error('ImageMagick "magick" is required to generate scene samples.');

  const root = process.cwd();
  const outDir = OUT_DIR;
  const tempDir = mkdtempSync(join(tmpdir(), "labelcheck-scenes-"));
  mkdirSync(join(root, outDir), { recursive: true });

  const sources = ["01-pass-01", "01-pass-02", "02-mismatch-01", "02-mismatch-02", "03-noncompliant-03", "03-noncompliant-04"].map((id) =>
    loadSource(root, id),
  );
  for (const source of sources) {
    if (!existsSync(source.imagePath)) throw new Error(`Missing source image ${source.imagePath}`);
  }

  const thumbs = sources.map((source, index) => makeThumb(tempDir, source, `bottle-${index}`, 136, 220, index % 2 ? -5 : 5));
  const tall = sources.map((source, index) => makeThumb(tempDir, source, `tall-${index}`, 190, 300, index % 2 ? -12 : 10));
  const pourBottle = makeThumb(tempDir, sources[0], "pour-bottle", 360, 210, -64);

  const scenes = [
    {
      id: "bad__review__scene-many-bottles-storage__src-01-pass-01__001",
      source: sources[0],
      title: "Many bottles in storage shelf",
      variant: "scene-many-bottles",
      visualObservation: "Visual note: many alcohol bottles are visible in one storage photo. The target label is not isolated enough for automated comparison.",
      draw(outputPath) {
        const overlays = [];
        let i = 0;
        for (const y of [72, 258, 444]) {
          for (const x of [52, 202, 352, 502, 652, 802]) {
            overlays.push({ path: thumbs[i % thumbs.length], x, y });
            i += 1;
          }
        }
        compositeScene(
          [
            "-size",
            SCENE_SIZE,
            "gradient:#2a1c12-#0b0806",
            "-fill",
            "rgba(105,72,44,0.60)",
            "-draw",
            "rectangle 0,246 1024,270 rectangle 0,432 1024,456 rectangle 0,618 1024,642",
            "-fill",
            "rgba(255,224,160,0.10)",
            "-draw",
            "rectangle 0,0 1024,110",
          ],
          overlays,
          outputPath,
        );
      },
    },
    {
      id: "bad__review__scene-oblique-storage-angle__src-01-pass-02__002",
      source: sources[1],
      title: "Oblique storage row with receding bottles",
      variant: "scene-oblique-storage",
      visualObservation: "Visual note: bottles are photographed at a strong oblique storage angle with multiple visible products and no isolated label panel.",
      draw(outputPath) {
        const overlays = tall.map((path, index) => ({ path, x: 30 + index * 150, y: 170 - index * 16 }));
        const raw = join(tempDir, "oblique-raw.jpg");
        compositeScene(
          [
            "-size",
            SCENE_SIZE,
            "gradient:#18110c-#5a3f2b",
            "-fill",
            "rgba(92,58,31,0.75)",
            "-draw",
            "polygon 0,480 1024,340 1024,430 0,650",
          ],
          overlays,
          raw,
        );
        execFileSync("magick", [
          raw,
          "-virtual-pixel",
          "background",
          "+distort",
          "Perspective",
          "0,0 70,30 1024,0 1000,10 0,683 0,683 1024,683 930,604",
          "-gravity",
          "center",
          "-extent",
          SCENE_SIZE,
          "-quality",
          "82",
          outputPath,
        ]);
      },
    },
    {
      id: "bad__review__scene-crowded-counter__src-02-mismatch-01__003",
      source: sources[2],
      title: "Crowded counter with overlapping bottles",
      variant: "scene-crowded-counter",
      visualObservation: "Visual note: multiple bottles overlap on a counter with glare and mixed labels. The reviewer must isolate the product before comparison.",
      draw(outputPath) {
        compositeScene(
          [
            "-size",
            SCENE_SIZE,
            "gradient:#5c4635-#17120e",
            "-fill",
            "rgba(232,211,170,0.35)",
            "-draw",
            "rectangle 0,475 1024,683",
            "-fill",
            "rgba(255,255,255,0.20)",
            "-draw",
            "circle 790,105 845,160 polygon 120,90 920,50 870,120 96,160",
          ],
          [
            { path: tall[2], x: 82, y: 185 },
            { path: tall[3], x: 235, y: 145 },
            { path: tall[4], x: 402, y: 188 },
            { path: tall[5], x: 570, y: 130 },
            { path: tall[0], x: 720, y: 205 },
          ],
          outputPath,
        );
      },
    },
    {
      id: "bad__review__foreground-covered-pour__src-01-pass-01__004",
      source: sources[0],
      title: "Pouring bottle with label covered by hand",
      variant: "foreground-covered-label",
      visualObservation: "Visual note: a foreground hand and pouring angle cover the bottle label, so required label facts cannot be verified from this photo.",
      draw(outputPath) {
        compositeScene(
          [
            "-size",
            SCENE_SIZE,
            "gradient:#d6c5aa-#70583f",
            "-fill",
            "rgba(44,62,81,0.72)",
            "-draw",
            "rectangle 0,0 270,683",
            "-fill",
            "rgba(255,255,255,0.25)",
            "-draw",
            "ellipse 650,315 80,115 -20,300",
          ],
          [{ path: pourBottle, x: 60, y: 195 }],
          outputPath,
        );
        execFileSync("magick", [
          outputPath,
          "-fill",
          "rgba(178,112,76,0.92)",
          "-draw",
          "roundrectangle 55,270 290,395 45,45 ellipse 252,323 34,72 0,360",
          "-fill",
          "rgba(128,62,42,0.50)",
          "-draw",
          "ellipse 185,333 74,38 0,360",
          "-quality",
          "82",
          outputPath,
        ]);
      },
    },
  ];

  try {
    const generated = scenes.map((scene) => writeScene(root, outDir, tempDir, scene));
    const manifestPath = join(root, outDir, "manifest.json");
    const existing = existsSync(manifestPath) ? readJson(manifestPath) : [];
    const byId = new Map(existing.map((item) => [item.id, item]));
    for (const item of generated) byId.set(item.id, item);
    const merged = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
    writeFileSync(manifestPath, `${JSON.stringify(merged, null, 2)}\n`);
    console.log(`wrote ${generated.length} scene samples to ${outDir}; manifest now ${merged.length}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
