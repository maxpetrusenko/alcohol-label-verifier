#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const sourceDownloadRoot = join(process.env.HOME, "Downloads", "labelcheck-wine-fixtures");
const outDir = "public/evals/fixtures/wine-rendered-canonical";

const GOVERNMENT_WARNING_TEXT =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

const fixtures = [
  {
    id: "wine-pass-01",
    title: "Silver Ridge Cellars",
    color: "#4f1f2c",
    expectedDecision: "approved",
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
    labelLines: [
      "BRAND NAME: SILVER RIDGE CELLARS",
      "Red Wine",
      "California",
      "Vintage 2023",
      "13.5% Alc./Vol.",
      "750 mL",
      "Contains sulfites.",
      "Produced and bottled by Silver Ridge Cellars, Sonoma, CA",
      GOVERNMENT_WARNING_TEXT,
    ],
    visualNote: "Deterministic synthetic wine label. Exact text rendered from JSON.",
  },
  {
    id: "wine-warning-01",
    title: "Harbor Glen Vineyards",
    color: "#5d2633",
    expectedDecision: "needs_review",
    expectedProblemChecks: ["image-quality"],
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
    labelLines: [
      "BRAND NAME: HARBOR GLEN VINEYARDS",
      "Table Wine",
      "Oregon",
      "Vintage 2022",
      "750 mL",
      "Contains sulfites.",
      "Produced and bottled by Harbor Glen Vineyards, Dundee, OR",
      GOVERNMENT_WARNING_TEXT,
      "Visual note: glare over the Government Warning makes exact statutory punctuation uncertain.",
    ],
    glare: true,
    visualNote: "Deterministic synthetic wine label with glare over the warning area.",
  },
  {
    id: "wine-fail-01",
    title: "Laurent Hill",
    color: "#d9c878",
    expectedDecision: "rejected",
    expectedProblemChecks: ["brand-name", "country-origin"],
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
    labelLines: [
      "BRAND NAME: LAURENT HILL",
      "White Wine",
      "Product of France",
      "Vintage 2023",
      "12.5% Alc./Vol.",
      "750 mL",
      "Contains sulfites.",
      "Imported by Northstar Imports, New York, NY",
      GOVERNMENT_WARNING_TEXT,
    ],
    visualNote: "Deterministic synthetic imported wine label intentionally mismatched against JSON.",
  },
];

function esc(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapText(text, maxChars) {
  const words = text.split(/\s+/u);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function labelText(fixture) {
  return fixture.labelLines.join("\n");
}

function svg(fixture) {
  const rows = [];
  let y = 0;
  for (const [index, line] of fixture.labelLines.entries()) {
    const max = index === fixture.labelLines.length - 1 ? 82 : 48;
    for (const wrapped of wrapText(line, max)) {
      rows.push({ text: wrapped, y, small: line.startsWith("GOVERNMENT WARNING") || line.startsWith("Visual note") });
      y += line.startsWith("GOVERNMENT WARNING") || line.startsWith("Visual note") ? 24 : 33;
    }
    y += 8;
  }

  const textSvg = rows
    .map(
      (row) =>
        `<text x="700" y="${605 + row.y}" text-anchor="middle" font-family="Georgia, serif" font-size="${row.small ? 22 : 31}" fill="#231f18">${esc(row.text)}</text>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1800" viewBox="0 0 1400 1800">
  <defs>
    <linearGradient id="glass" x1="0" x2="1">
      <stop offset="0" stop-color="#130b0e"/>
      <stop offset="0.22" stop-color="${fixture.color}"/>
      <stop offset="0.52" stop-color="#12090c"/>
      <stop offset="0.78" stop-color="${fixture.color}"/>
      <stop offset="1" stop-color="#090406"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" x2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="0.4" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="28" stdDeviation="24" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="1400" height="1800" fill="#f4f1eb"/>
  <ellipse cx="700" cy="1670" rx="285" ry="54" fill="#c9c1b4" opacity="0.45"/>
  <g filter="url(#softShadow)">
    <path d="M565 260 C565 220 835 220 835 260 L835 520 C835 610 930 690 930 880 L930 1580 C930 1655 470 1655 470 1580 L470 880 C470 690 565 610 565 520 Z" fill="url(#glass)"/>
    <rect x="585" y="90" width="230" height="300" rx="60" fill="url(#glass)"/>
    <rect x="570" y="90" width="260" height="76" rx="34" fill="#243829"/>
    <rect x="570" y="165" width="260" height="40" fill="#d1b76b"/>
    <path d="M556 345 C595 384 805 384 844 345 L844 425 C805 463 595 463 556 425 Z" fill="#18170f" opacity="0.55"/>
    <path d="M540 355 C578 392 822 392 860 355" fill="none" stroke="#cab276" stroke-width="9" opacity="0.8"/>
    <rect x="437" y="470" width="526" height="640" rx="26" fill="#f4ead5" stroke="#bda76a" stroke-width="7"/>
    <rect x="459" y="492" width="482" height="596" rx="16" fill="none" stroke="#d5c18a" stroke-width="3"/>
    <text x="700" y="535" text-anchor="middle" font-family="Georgia, serif" font-size="44" fill="#352716">${esc(fixture.title.toUpperCase())}</text>
    ${textSvg}
    ${fixture.glare ? '<path d="M380 710 C520 630 720 650 1030 560 L1030 770 C730 850 520 820 380 930 Z" fill="#fff" opacity="0.62"/>' : ""}
    <path d="M533 415 C495 590 510 1270 505 1540" stroke="url(#shine)" stroke-width="58" opacity="0.42"/>
    <path d="M805 420 C865 720 858 1260 844 1530" stroke="url(#shine)" stroke-width="42" opacity="0.28"/>
  </g>
</svg>`;
}

mkdirSync(outDir, { recursive: true });

const manifest = fixtures.map((fixture) => {
  const svgPath = join(outDir, `${fixture.id}.svg`);
  const pngPath = join(outDir, `${fixture.id}.png`);
  writeFileSync(svgPath, svg(fixture));
  execFileSync("qlmanage", ["-t", "-s", "1024", "-o", outDir, svgPath], { stdio: "ignore" });
  const quickLookPath = `${svgPath}.png`;
  if (existsSync(quickLookPath)) renameSync(quickLookPath, pngPath);
  const item = {
    id: fixture.id,
    title: fixture.title,
    image: pngPath,
    svg: svgPath,
    expectedDecision: fixture.expectedDecision,
    expectedProblemChecks: fixture.expectedProblemChecks ?? [],
    application: fixture.application,
    labelText: labelText(fixture),
    visualObservation: fixture.visualNote,
    sourceBaseDownloads: [
      join(sourceDownloadRoot, "downloaded-bases", "four-bottles-with-blank-labels.svg"),
      join(sourceDownloadRoot, "downloaded-bases", "draw-french-wine-bottle.png"),
      join(sourceDownloadRoot, "downloaded-bases", "mde-botella.png"),
    ],
  };
  writeFileSync(join(outDir, `${fixture.id}.json`), `${JSON.stringify(item, null, 2)}\n`);
  return item;
});

writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(
  join(outDir, "verify-payload.json"),
  `${JSON.stringify(
    {
      application: manifest[0].application,
      labels: manifest.map((item) => ({
        labelId: item.id,
        fileName: `${item.id}.png`,
        mimeType: "text/plain",
        text: item.labelText,
        application: item.application,
      })),
    },
    null,
    2,
  )}\n`,
);

console.log(`wrote ${manifest.length} rendered wine fixtures to ${outDir}`);
console.log(`wrote verify payload to ${join(outDir, "verify-payload.json")}`);
