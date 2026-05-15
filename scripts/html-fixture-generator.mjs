import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const GOVERNMENT_WARNING_TEXT =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

const OUTPUT_VERSION = 1;

const baseApplication = {
  brandName: "Frontier Glass",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  bottlerAddress: "Frontier Glass Distilling, Louisville, KY",
  beverageKind: "spirits",
  imported: false,
};

const cleanLabel = [
  "Frontier Glass",
  "Kentucky Straight Bourbon Whiskey",
  "Distilled in Kentucky",
  "45% Alc./Vol. (90 Proof)",
  "750 mL",
  "Bottled by Frontier Glass Distilling, Louisville, KY",
  GOVERNMENT_WARNING_TEXT,
].join("\n");

const importedApplication = {
  brandName: "Highland Crest",
  classType: "Scotch Whisky",
  alcoholContent: "40% Alc./Vol. (80 Proof)",
  netContents: "700 mL",
  bottlerAddress: "Highland Crest Imports, New York, NY",
  countryOfOrigin: "Scotland",
  beverageKind: "spirits",
  imported: true,
};

const importedLabel = [
  "Highland Crest",
  "Scotch Whisky",
  "40% Alc./Vol. (80 Proof)",
  "700 mL",
  "Imported by Highland Crest Imports, New York, NY",
  "Product of Scotland",
  GOVERNMENT_WARNING_TEXT,
].join("\n");

function defineCase(id, title, kind, overrides = {}) {
  return {
    id,
    title,
    kind,
    application: overrides.application ?? baseApplication,
    labelVisibleText: overrides.labelVisibleText ?? cleanLabel,
    visualObservation: overrides.visualObservation ?? "",
    expectedDecision: overrides.expectedDecision ?? "approved",
    expectedProblemChecks: overrides.expectedProblemChecks ?? [],
    extractionConfidence: overrides.extractionConfidence ?? 0.72,
    variant: overrides.variant ?? "clean",
  };
}

export const fixtureDefinitions = [
  defineCase("clean-pass", "Clean pass", "clean-pass"),
  defineCase("imported-spirits-pass", "Imported spirits pass", "imported-pass", {
    application: importedApplication,
    labelVisibleText: importedLabel,
  }),
  defineCase("imported-country-mismatch", "Imported spirits country mismatch", "imported-mismatch", {
    application: {
      ...importedApplication,
      countryOfOrigin: "Ireland",
    },
    labelVisibleText: importedLabel,
    expectedDecision: "rejected",
    expectedProblemChecks: ["country-origin"],
  }),
  defineCase("imported-importer-mismatch", "Imported spirits importer mismatch", "imported-mismatch", {
    application: {
      ...importedApplication,
      bottlerAddress: "Atlantic Beverage Imports, Boston, MA",
    },
    labelVisibleText: importedLabel,
    expectedDecision: "rejected",
    expectedProblemChecks: ["bottler-address"],
  }),
  defineCase("field-mismatch-brand", "Field mismatch: brand", "field-mismatch", {
    application: {
      ...baseApplication,
      brandName: "Copper Ridge",
    },
    expectedDecision: "rejected",
    expectedProblemChecks: ["brand-name"],
  }),
  defineCase("warning-wrong-text", "Wrong government warning text", "warning-wrong", {
    labelVisibleText: cleanLabel.replace(
      GOVERNMENT_WARNING_TEXT,
      "GOVERNMENT WARNING: Alcohol may impair judgment. Please drink responsibly.",
    ),
    expectedDecision: "rejected",
    expectedProblemChecks: ["government-warning"],
  }),
  defineCase("warning-title-case", "Title-case government warning prefix", "warning-title-case", {
    labelVisibleText: cleanLabel.replace("GOVERNMENT WARNING:", "Government Warning:"),
    expectedDecision: "rejected",
    expectedProblemChecks: ["government-warning"],
  }),
  defineCase("bad-photo-blur", "Bad photo: blur", "bad-photo", {
    variant: "blur",
    extractionConfidence: 0.44,
    expectedDecision: "needs_review",
    expectedProblemChecks: ["extraction-confidence"],
    visualObservation: "Visual note: label photo is blurred; automated OCR confidence is low.",
  }),
  defineCase("bad-photo-glare", "Bad photo: glare", "bad-photo", {
    variant: "glare",
    extractionConfidence: 0.48,
    expectedDecision: "needs_review",
    expectedProblemChecks: ["extraction-confidence"],
    visualObservation: "Visual note: label photo has glare over mandatory text; automated OCR confidence is low.",
  }),
  defineCase("bad-photo-low-light", "Bad photo: low light", "bad-photo", {
    variant: "low-light",
    extractionConfidence: 0.39,
    expectedDecision: "needs_review",
    expectedProblemChecks: ["extraction-confidence"],
    visualObservation: "Visual note: label photo is underexposed; automated OCR confidence is low.",
  }),
  defineCase("bad-photo-perspective", "Bad photo: perspective skew", "bad-photo", {
    variant: "perspective",
    extractionConfidence: 0.5,
    expectedDecision: "needs_review",
    expectedProblemChecks: ["extraction-confidence"],
    visualObservation: "Visual note: label photo is skewed by perspective; automated OCR confidence is low.",
  }),
  defineCase("bad-photo-tiny-warning", "Bad photo: tiny warning", "bad-photo", {
    variant: "tiny-warning",
    expectedDecision: "rejected",
    expectedProblemChecks: ["warning-legibility"],
    visualObservation: "Visual note: Government warning text is tiny and illegible.",
  }),
];

function escapeXml(value) {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

function hashContent(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function svgLines(text) {
  return text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

function variantFilter(variant) {
  if (variant === "blur") return 'filter="url(#blur)"';
  if (variant === "low-light") return 'filter="url(#lowLight)"';
  if (variant === "perspective") return 'transform="translate(58 10) skewX(-10) scale(.9 1)"';
  return "";
}

function glareOverlay(variant) {
  if (variant !== "glare") return "";
  return '<path d="M55 28 L370 92 L350 148 L35 82 Z" fill="#fff" opacity=".72"/>';
}

function labelTextElements(testCase) {
  const lines = svgLines(testCase.labelVisibleText);
  const warningIndex = lines.findIndex((line) => /government warning/i.test(line));
  return lines
    .map((line, index) => {
      const isBrand = index === 0;
      const isWarning = index === warningIndex;
      const fontSize = testCase.variant === "tiny-warning" && isWarning ? 4 : isBrand ? 28 : isWarning ? 8 : 14;
      const y = isWarning ? 230 : 56 + index * 25;
      const weight = isBrand ? 700 : isWarning ? 600 : 500;
      const content = isWarning ? line.match(/^.{1,118}/u)?.[0] ?? line : line;
      return `<text x="40" y="${y}" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="${weight}" fill="#21170f">${escapeXml(content)}</text>`;
    })
    .join("\n  ");
}

export function renderSvg(testCase) {
  const filter = variantFilter(testCase.variant);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="280" viewBox="0 0 420 280" role="img" aria-label="${escapeXml(testCase.title)}">
  <defs>
    <filter id="blur"><feGaussianBlur stdDeviation="2.4"/></filter>
    <filter id="lowLight"><feComponentTransfer><feFuncR type="linear" slope=".48"/><feFuncG type="linear" slope=".48"/><feFuncB type="linear" slope=".48"/></feComponentTransfer></filter>
  </defs>
  <rect width="420" height="280" fill="#f5efe2"/>
  <rect x="22" y="18" width="376" height="244" rx="14" fill="#fffaf0" stroke="#2c2118" stroke-width="3"/>
  <g ${filter}>
  <rect x="34" y="30" width="352" height="220" rx="10" fill="#f8efd9" stroke="#b38b50"/>
  ${labelTextElements(testCase)}
  </g>
  ${glareOverlay(testCase.variant)}
  <text x="40" y="270" font-family="Arial, sans-serif" font-size="9" fill="#6f6257">deterministic-fixture:${escapeXml(testCase.id)}</text>
</svg>
`;
}

export function renderHtml(testCase, svgFileName) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeXml(testCase.title)}</title>
  <meta name="labelcheck-fixture-id" content="${escapeXml(testCase.id)}">
  <meta name="labelcheck-expected-decision" content="${escapeXml(testCase.expectedDecision)}">
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #241b15; font-family: Georgia, serif; }
    main { width: min(92vw, 520px); color: #f8efd9; }
    img { width: 100%; height: auto; display: block; box-shadow: 0 20px 60px rgba(0, 0, 0, .35); }
    pre { white-space: pre-wrap; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; color: #f8efd9; }
  </style>
</head>
<body>
  <main>
    <img src="./${escapeXml(svgFileName)}" alt="${escapeXml(testCase.title)}">
    <pre>${escapeXml(testCase.visualObservation || "Visual note: clean synthetic label.")}</pre>
  </main>
</body>
</html>
`;
}

export function serializeCase(testCase, svg, html) {
  return {
    schemaVersion: OUTPUT_VERSION,
    id: testCase.id,
    title: testCase.title,
    kind: testCase.kind,
    variant: testCase.variant,
    expectedDecision: testCase.expectedDecision,
    expectedProblemChecks: testCase.expectedProblemChecks,
    extractionConfidence: testCase.extractionConfidence,
    application: testCase.application,
    labelVisibleText: testCase.labelVisibleText,
    visualObservation: testCase.visualObservation,
    artifacts: {
      svg: `${testCase.id}.svg`,
      html: `${testCase.id}.html`,
    },
    contentHash: hashContent(`${svg}\n${html}\n${JSON.stringify(testCase)}`),
  };
}

export function buildFixtureArtifacts(testCase) {
  const svg = renderSvg(testCase);
  const html = renderHtml(testCase, `${testCase.id}.svg`);
  return {
    svg,
    html,
    json: serializeCase(testCase, svg, html),
  };
}

export function writeFixtures(outDir) {
  mkdirSync(outDir, { recursive: true });
  const manifest = fixtureDefinitions.map((testCase) => {
    const artifacts = buildFixtureArtifacts(testCase);
    writeFileSync(join(outDir, `${testCase.id}.svg`), artifacts.svg);
    writeFileSync(join(outDir, `${testCase.id}.html`), artifacts.html);
    writeFileSync(join(outDir, `${testCase.id}.json`), `${JSON.stringify(artifacts.json, null, 2)}\n`);
    return artifacts.json;
  });
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
