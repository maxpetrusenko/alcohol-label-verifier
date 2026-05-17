#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const GENERATED_DIR = "public/evals/fixtures/spirits-generated-canonical";
const OUT_DIR = "public/evals/fixtures/stress-degraded-generated";
const DEFAULT_SEED = 20260514;

const DEGRADATION_FAMILIES = [
  "defocus-blur",
  "motion-blur",
  "low-light",
  "overexposed",
  "flash-glare",
  "blue-cast",
  "jpeg-noise",
  "distance-downsample",
  "crop-occlusion",
  "perspective-skew",
  "viewpoint-top",
  "viewpoint-bottom",
  "viewpoint-inward",
  "viewpoint-outward",
];

const SEVERITY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const CAMERA_ORIENTATIONS = [
  { name: "upright", angleDegrees: 0 },
  { name: "tilt-left", angleDegrees: -15 },
  { name: "tilt-right", angleDegrees: 15 },
  { name: "sideways", angleDegrees: 90 },
  { name: "upside-down", angleDegrees: 180 },
];

const DEFAULT_COUNT = DEGRADATION_FAMILIES.length * SEVERITY_LEVELS.length * CAMERA_ORIENTATIONS.length;
const INCONSISTENT_SOURCE_IDS = new Set([
  // Copied JSON says Glasgow bottler, image prompt says New York importer.
  // Keep this fixture for source-corpus coverage, but do not use it as degraded-photo ground truth.
  "01-pass-02",
  // Source corpus marks 1500 mL spirits as non-compliant, but current 27 CFR 5.203 includes 1.5 L.
  "04-noncompliant-04",
]);

const VARIANT_SMOKE_ROWS = [
  { family: "defocus-blur", severityLevel: 1, name: "upright", angleDegrees: 0 },
  { family: "motion-blur", severityLevel: 9, name: "upright", angleDegrees: 0 },
  { family: "low-light", severityLevel: 7, name: "tilt-left", angleDegrees: -15 },
  { family: "overexposed", severityLevel: 7, name: "tilt-right", angleDegrees: 15 },
  { family: "flash-glare", severityLevel: 6, name: "sideways", angleDegrees: 90 },
  { family: "blue-cast", severityLevel: 7, name: "upright", angleDegrees: 0 },
  { family: "jpeg-noise", severityLevel: 1, name: "upside-down", angleDegrees: 180 },
  { family: "distance-downsample", severityLevel: 6, name: "tilt-left", angleDegrees: -15 },
  { family: "crop-occlusion", severityLevel: 6, name: "tilt-right", angleDegrees: 15 },
  { family: "perspective-skew", severityLevel: 6, name: "upright", angleDegrees: 0 },
  { family: "viewpoint-top", severityLevel: 7, name: "upright", angleDegrees: 0 },
  { family: "viewpoint-bottom", severityLevel: 7, name: "upright", angleDegrees: 0 },
  { family: "viewpoint-inward", severityLevel: 7, name: "tilt-left", angleDegrees: -15 },
  { family: "viewpoint-outward", severityLevel: 7, name: "tilt-right", angleDegrees: 15 },
];

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function usage() {
  console.log(`Usage:
  npm run fixtures:degrade
  node scripts/generate-degraded-fixtures.mjs --count 500 --seed 20260514
  node scripts/generate-degraded-fixtures.mjs --variants-smoke --out /tmp/degraded-smoke
  node scripts/generate-degraded-fixtures.mjs --random

Generates a matrix of degradation family x severity level x camera orientation.
Requires ImageMagick's "magick" command locally. Generated files are committed artifacts, not runtime dependencies.`);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) usage();

function hasMagick() {
  try {
    execFileSync("magick", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function expectedDecisionFromBehavior(expectedBehavior) {
  const normalized = expectedBehavior.toLowerCase();
  if (/\boverall\s+pass\b|\bpass\b/u.test(normalized) && !/\bfail\b/u.test(normalized)) return "approved";
  if (/\breview\b/u.test(normalized)) return "needs_review";
  return "rejected";
}

function readManifest(root) {
  return JSON.parse(readFileSync(join(root, GENERATED_DIR, "manifest.json"), "utf8"));
}

function sourceCasesWithImages(root) {
  return readManifest(root).filter((item) => !INCONSISTENT_SOURCE_IDS.has(item.id) && existsSync(join(root, GENERATED_DIR, `${item.id}.png`)));
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
}

function requiresQualityReview(family, level, orientationName) {
  if (orientationName === "upside-down") return true;
  if (orientationName === "sideways" && level >= 4) return true;
  if (
    [
      "motion-blur",
      "flash-glare",
      "crop-occlusion",
      "perspective-skew",
      "distance-downsample",
      "viewpoint-top",
      "viewpoint-bottom",
      "viewpoint-inward",
      "viewpoint-outward",
    ].includes(family)
  ) {
    return level >= 6;
  }
  return level >= 7;
}

function expectedConfidence(baseDecision, reviewRequired, level, orientationName) {
  if (baseDecision !== "approved") return Math.max(0.58, 0.84 - level * 0.02);
  if (!reviewRequired) return Math.max(0.62, 0.86 - level * 0.02);
  const orientationPenalty = orientationName === "upside-down" ? 0.18 : orientationName === "sideways" ? 0.1 : 0;
  return Math.max(0.32, 0.66 - level * 0.035 - orientationPenalty);
}

function qualityNote(family, level, angleDegrees, orientationName, reviewRequired) {
  if (!reviewRequired) {
    const labels = {
      "defocus-blur": "Readable photo: focus is slightly soft but label text remains legible.",
      "motion-blur": "Readable photo: minor camera shake but label text remains legible.",
      "low-light": "Readable photo: lighting is imperfect but label text remains legible.",
      "overexposed": "Readable photo: bright lighting but label text remains legible.",
      "flash-glare": "Readable photo: small highlight outside critical label text.",
      "blue-cast": "Readable photo: cool phone-camera color balance but label text remains legible.",
      "jpeg-noise": "Readable photo: minor compression texture but label text remains legible.",
      "distance-downsample": "Readable photo: label is smaller in frame but text remains legible.",
      "crop-occlusion": "Readable photo: full mandatory panel remains visible.",
      "perspective-skew": "Readable photo: label is slightly off-square but text remains legible.",
      "viewpoint-top": "Readable photo: bottle is photographed from above but label text remains legible.",
      "viewpoint-bottom": "Readable photo: bottle is photographed from below but label text remains legible.",
      "viewpoint-inward": "Readable photo: label plane rotates inward but text remains legible.",
      "viewpoint-outward": "Readable photo: label plane rotates outward but text remains legible.",
    };
    return `${labels[family] ?? "Readable photo: label text remains legible."} Camera orientation is ${orientationName} (${angleDegrees} degrees).`;
  }

  const intensity = level <= 3 ? "mild" : level <= 7 ? "moderate" : "severe";
  const labels = {
    "defocus-blur": `Visual note: label photo has ${intensity} defocus blur.`,
    "motion-blur": `Visual note: label photo has ${intensity} motion blur from camera shake.`,
    "low-light": `Visual note: label photo is ${intensity} underexposed and noisy.`,
    "overexposed": `Visual note: label photo is ${intensity} overexposed and washed out.`,
    "flash-glare": `Visual note: label photo has ${intensity} flash glare over label text.`,
    "blue-cast": `Visual note: label photo has a ${intensity} blue phone-camera color cast.`,
    "jpeg-noise": `Visual note: label photo has ${intensity} compression artifacts and sensor noise.`,
    "distance-downsample": `Visual note: label was photographed from too far away with ${intensity} downsampling.`,
    "crop-occlusion": `Visual note: label photo has ${intensity} cropping or partial occlusion.`,
    "perspective-skew": `Visual note: label photo has ${intensity} perspective skew.`,
    "viewpoint-top": `Visual note: label photo is taken from ${intensity} top-down viewpoint.`,
    "viewpoint-bottom": `Visual note: label photo is taken from ${intensity} bottom-up viewpoint.`,
    "viewpoint-inward": `Visual note: label plane has ${intensity} inward rotation toward the bottle center.`,
    "viewpoint-outward": `Visual note: label plane has ${intensity} outward rotation away from the bottle center.`,
  };
  const orientationProblem =
    orientationName === "upside-down"
      ? " The photo is upside down and needs rotation before automated approval."
      : orientationName === "sideways"
        ? " The photo is sideways and may need rotation before automated approval."
        : "";
  return `${labels[family] ?? "Visual note: label photo quality is degraded."} Camera orientation is ${orientationName} (${angleDegrees} degrees).${orientationProblem}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angleToken(angleDegrees) {
  if (angleDegrees === 0) return "rotate-000";
  return `rotate-${angleDegrees < 0 ? "m" : "p"}${String(Math.abs(angleDegrees)).padStart(3, "0")}`;
}

function decisionToken(decision) {
  if (decision === "approved") return "pass";
  if (decision === "needs_review") return "review";
  return "fail";
}

function familyToken(family) {
  const tokens = {
    "defocus-blur": "defocus",
    "motion-blur": "motion",
    "low-light": "dark",
    "overexposed": "bright",
    "flash-glare": "flash",
    "blue-cast": "blue",
    "jpeg-noise": "jpeg",
    "distance-downsample": "far",
    "crop-occlusion": "crop",
    "perspective-skew": "skew",
    "viewpoint-top": "top",
    "viewpoint-bottom": "bottom",
    "viewpoint-inward": "inward",
    "viewpoint-outward": "outward",
  };
  return tokens[family] ?? family;
}

function perspectiveArgs(args, points) {
  return [
    ...args,
    "-virtual-pixel",
    "background",
    "+distort",
    "Perspective",
    points,
    "-gravity",
    "center",
    "-extent",
    "640x640",
  ];
}

function applyCameraAngle(args, angleDegrees) {
  if (angleDegrees === 0) return args;
  return [
    ...args,
    "-background",
    "#f2eadc",
    "-rotate",
    String(angleDegrees),
    "-gravity",
    "center",
    "-extent",
    "640x640",
  ];
}

function commandForDegradation(input, output, family, level, angleDegrees, rand) {
  const jitter = rand() - 0.5;
  const quality = String(clamp(Math.round(78 - level * 4 + jitter * 8), 24, 88));
  const base = [input, "-auto-orient", "-resize", "640x640>", "-background", "#f2eadc", "-gravity", "center", "-extent", "640x640"];
  let args = [...base];

  if (family === "defocus-blur") {
    args = [...args, "-blur", `0x${(0.25 + level * 0.18).toFixed(2)}`];
  } else if (family === "motion-blur") {
    args = [...args, "-motion-blur", `0x${Math.round(2 + level * 0.9)}+${Math.round(8 + level * 5 + jitter * 8)}`];
  } else if (family === "low-light") {
    args = [
      ...args,
      "-modulate",
      `${clamp(94 - level * 5, 38, 92)},${clamp(96 - level * 2, 62, 96)},100`,
      "-brightness-contrast",
      `${-level * 2}x${Math.round(level * 0.8)}`,
      "-attenuate",
      `${(0.01 + level * 0.008).toFixed(3)}`,
      "+noise",
      "Gaussian",
    ];
  } else if (family === "overexposed") {
    args = [
      ...args,
      "-modulate",
      `${clamp(102 + level * 6, 108, 162)},${clamp(96 - level * 2, 70, 94)},100`,
      "-brightness-contrast",
      `${level * 2}x${-Math.round(level * 0.7)}`,
    ];
  } else if (family === "flash-glare") {
    const alpha = (0.16 + level * 0.045).toFixed(2);
    const y = Math.round(80 + level * 11 + jitter * 30);
    args = [
      ...args,
      "-fill",
      `rgba(255,255,255,${alpha})`,
      "-draw",
      `polygon 32,${y} 620,${y + 48} 596,${y + 128} 18,${y + 78}`,
      "-fill",
      `rgba(255,255,255,${Math.min(0.88, Number(alpha) + 0.12).toFixed(2)})`,
      "-draw",
      `circle ${Math.round(250 + jitter * 220)},${Math.round(y + 42)} ${Math.round(294 + jitter * 220)},${Math.round(y + 86)}`,
    ];
  } else if (family === "blue-cast") {
    const redMultiplier = (1 - level * 0.025).toFixed(2);
    const greenMultiplier = (1 - level * 0.012).toFixed(2);
    const blueMultiplier = (1 + level * 0.035).toFixed(2);
    args = [
      ...args,
      "-channel",
      "R",
      "-evaluate",
      "multiply",
      redMultiplier,
      "-channel",
      "G",
      "-evaluate",
      "multiply",
      greenMultiplier,
      "-channel",
      "B",
      "-evaluate",
      "multiply",
      blueMultiplier,
      "+channel",
      "-modulate",
      `${clamp(101 - level, 88, 100)},${clamp(102 + level, 104, 114)},100`,
    ];
  } else if (family === "jpeg-noise") {
    args = [
      ...args,
      "-attenuate",
      `${(0.015 + level * 0.012).toFixed(3)}`,
      "+noise",
      "Multiplicative",
      "-quality",
      String(clamp(62 - level * 4, 18, 58)),
    ];
  } else if (family === "distance-downsample") {
    const smallSize = String(clamp(600 - level * 42, 180, 560));
    args = [...args, "-resize", `${smallSize}x${smallSize}`, "-resize", "640x640"];
  } else if (family === "crop-occlusion") {
    const inset = Math.round(7 + level * 5);
    args = [
      ...args,
      "-crop",
      `${640 - inset}x${640 - inset}+${Math.round(inset * 0.55)}+${Math.round(inset * 0.42)}`,
      "-resize",
      "640x640",
      "-fill",
      `rgba(245,238,222,${(0.12 + level * 0.045).toFixed(2)})`,
      "-draw",
      `polygon ${640 - inset * 2},0 640,0 640,${inset * 3}`,
    ];
  } else if (family === "perspective-skew") {
    const skew = Math.round(4 + level * 4);
    args = perspectiveArgs(
      args,
      `0,0 ${skew},${Math.round(skew * 0.5)} 640,0 ${640 - skew},${skew} 0,640 ${Math.round(skew * 0.6)},${640 - skew} 640,640 ${640 - Math.round(skew * 0.7)},${640 - Math.round(skew * 0.4)}`,
    );
  } else if (family === "viewpoint-top") {
    const depth = Math.round(12 + level * 6);
    args = perspectiveArgs(
      args,
      `0,0 0,0 640,0 640,0 0,640 ${depth},${640 - Math.round(depth * 0.25)} 640,640 ${640 - depth},${640 - Math.round(depth * 0.25)}`,
    );
  } else if (family === "viewpoint-bottom") {
    const depth = Math.round(12 + level * 6);
    args = perspectiveArgs(
      args,
      `0,0 ${depth},${Math.round(depth * 0.25)} 640,0 ${640 - depth},${Math.round(depth * 0.25)} 0,640 0,640 640,640 640,640`,
    );
  } else if (family === "viewpoint-inward") {
    const depth = Math.round(10 + level * 5);
    args = perspectiveArgs(
      args,
      `0,0 ${depth},${Math.round(depth * 0.4)} 640,0 ${640 - Math.round(depth * 0.35)},0 0,640 ${depth},${640 - Math.round(depth * 0.4)} 640,640 ${640 - Math.round(depth * 0.35)},640`,
    );
  } else if (family === "viewpoint-outward") {
    const depth = Math.round(10 + level * 5);
    args = perspectiveArgs(
      args,
      `0,0 ${Math.round(depth * 0.35)},0 640,0 ${640 - depth},${Math.round(depth * 0.4)} 0,640 ${Math.round(depth * 0.35)},640 640,640 ${640 - depth},${640 - Math.round(depth * 0.4)}`,
    );
  }

  const withAngle = applyCameraAngle(args, angleDegrees);
  return [...withAngle, "-quality", quality, output];
}

function generate() {
  const root = process.cwd();
  const outDir = resolve(root, argValue("--out", OUT_DIR));
  const variantsSmoke = process.argv.includes("--variants-smoke");
  const count = Number(argValue("--count", variantsSmoke ? String(VARIANT_SMOKE_ROWS.length) : String(DEFAULT_COUNT)));
  const seed = process.argv.includes("--random") ? Date.now() : Number(argValue("--seed", String(DEFAULT_SEED)));
  const rand = mulberry32(seed);

  if (!hasMagick()) {
    throw new Error('ImageMagick "magick" is required to generate degraded image fixtures.');
  }

  const sources = sourceCasesWithImages(root);
  if (!sources.length) throw new Error(`No source PNG fixtures found in ${GENERATED_DIR}`);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  let generatedRows = VARIANT_SMOKE_ROWS;
  if (!variantsSmoke) {
    generatedRows = [];
    for (const family of DEGRADATION_FAMILIES) {
      for (const severityLevel of SEVERITY_LEVELS) {
        for (const orientation of CAMERA_ORIENTATIONS) {
          generatedRows.push({ family, severityLevel, ...orientation });
        }
      }
    }
  }

  const manifest = [];
  for (let index = 0; index < count; index += 1) {
    const source = sources[index % sources.length];
    const row = generatedRows[index % generatedRows.length];
    const baseDecision = expectedDecisionFromBehavior(source.expected_behavior);
    const reviewRequired = requiresQualityReview(row.family, row.severityLevel, row.name);
    const photoQuality = reviewRequired ? "bad" : "good";
    const extractionConfidence = expectedConfidence(baseDecision, reviewRequired, row.severityLevel, row.name);
    const expectedDecision = baseDecision === "approved" && reviewRequired ? "needs_review" : baseDecision;
    const expectedProblemChecks = [];
    if (baseDecision === "approved" && reviewRequired) expectedProblemChecks.push("image-quality");
    if (extractionConfidence < 0.55) expectedProblemChecks.push("extraction-confidence");
    const id = `${photoQuality}__${decisionToken(expectedDecision)}__${familyToken(row.family)}__l${String(row.severityLevel).padStart(2, "0")}__${angleToken(row.angleDegrees)}__src-${source.id}__${String(index + 1).padStart(3, "0")}`;
    const fileName = `${id}.jpg`;
    const sourcePath = join(root, GENERATED_DIR, `${source.id}.png`);
    const outputPath = join(outDir, fileName);

    mkdirSync(outDir, { recursive: true });
    execFileSync("magick", commandForDegradation(sourcePath, outputPath, row.family, row.severityLevel, row.angleDegrees, rand), { stdio: "pipe" });

    const item = {
      schemaVersion: 1,
      id,
      sourceId: source.id,
      title: `${source.description} (${row.family}, level ${row.severityLevel}, ${row.name})`,
      photoQuality,
      variant: row.family,
      degradationFamily: row.family,
      severityLevel: row.severityLevel,
      orientation: row.name,
      angleDegrees: row.angleDegrees,
      sourceImage: `${GENERATED_DIR}/${basename(sourcePath)}`,
      image: `${OUT_DIR}/${fileName}`,
      imageHash: hashFile(outputPath),
      form_data: source.form_data,
      image_prompt: source.image_prompt,
      expectedSourceBehavior: source.expected_behavior,
      expectedDecision,
      expectedProblemChecks,
      extractionConfidence,
      visualObservation: qualityNote(row.family, row.severityLevel, row.angleDegrees, row.name, reviewRequired),
    };

    manifest.push(item);
    writeFileSync(join(outDir, `${id}.json`), `${JSON.stringify(item, null, 2)}\n`);
  }

  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${manifest.length} degraded fixtures to ${outDir} with seed ${seed}`);
}

generate();
