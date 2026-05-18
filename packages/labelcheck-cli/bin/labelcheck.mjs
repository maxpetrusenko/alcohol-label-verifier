#!/usr/bin/env node
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, basename, join } from "node:path";

const DEFAULT_BASE_URL = process.env.LABELCHECK_BASE_URL || "https://cola.maxpetrusenko.com";
const VERIFY_CHUNK_SIZE = 25;
const MAX_IMAGE_BATCH = 300;

const MIME_BY_EXT = new Map([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".heic", "image/heic"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".txt", "text/plain"],
]);

function usage(exitCode = 0) {
  const output = `Usage:
  labelcheck health [--base-url URL]
  labelcheck verify label.png|labels/|input.json --facts application.json|applications.csv [--base-url URL]
  labelcheck extract label.png|labels/|label.txt|input.json [--base-url URL]
  labelcheck export result.json [--format json|csv] [--base-url URL]

Examples:
  labelcheck verify ./front.png --facts ./application.json
  labelcheck verify ./label-photos --facts ./applications.csv
  labelcheck extract ./label-photos

Defaults to https://cola.maxpetrusenko.com. Set LABELCHECK_BASE_URL for local or private servers.
`;
  (exitCode === 0 ? console.log : console.error)(output);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  const options = { baseUrl: DEFAULT_BASE_URL, format: "json" };
  const positional = [];

  while (args.length) {
    const item = args.shift();
    if (item === "--help" || item === "-h") usage();
    if (item === "--base-url") {
      options.baseUrl = args.shift();
      continue;
    }
    if (item === "--format") {
      options.format = args.shift();
      continue;
    }
    if (item === "--facts" || item === "--application") {
      options.factsPath = args.shift();
      continue;
    }
    positional.push(item);
  }

  if (!command || command === "--help" || command === "-h") usage();
  return { command, positional, options };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function isImagePath(path) {
  return MIME_BY_EXT.get(extname(path).toLowerCase())?.startsWith("image/") ?? false;
}

async function inputPaths(path) {
  const entry = await stat(path);
  if (!entry.isDirectory()) return [path];

  const files = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    files.map((file) => {
      const child = join(path, file.name);
      if (file.isDirectory()) return inputPaths(child);
      if (file.isFile() && isImagePath(child)) return [child];
      return [];
    }),
  );
  return nested.flat().sort((a, b) => a.localeCompare(b));
}

async function labelPayload(path) {
  const ext = extname(path).toLowerCase();
  const mimeType = MIME_BY_EXT.get(ext) || "application/octet-stream";
  if (mimeType === "text/plain" || ext === ".json") {
    return {
      fileName: basename(path),
      mimeType,
      text: await readFile(path, "utf8"),
    };
  }

  const bytes = await readFile(path);
  return {
    fileName: basename(path),
    mimeType,
    dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
  };
}

async function labelsFromInput(path) {
  const paths = await inputPaths(path);
  const imagePaths = paths.filter(isImagePath);
  const nonJsonSingleFile = paths.length === 1 && extname(paths[0]).toLowerCase() !== ".json";
  if (nonJsonSingleFile && !imagePaths.length && extname(paths[0]).toLowerCase() !== ".txt") {
    throw new Error(`Unsupported label file "${paths[0]}". Use PNG, JPG, WEBP, HEIC, GIF, AVIF, TXT, or JSON payload input.`);
  }
  if (paths.length > 1 && imagePaths.length !== paths.length) {
    throw new Error("Folder verification only accepts image files. Remove non-image files or pass a prepared JSON payload.");
  }
  if (imagePaths.length > MAX_IMAGE_BATCH) {
    throw new Error(`Batch limit is ${MAX_IMAGE_BATCH} images. Split this folder into smaller batches.`);
  }
  if (!imagePaths.length) return [await labelPayload(path)];
  return Promise.all(
    imagePaths.map(async (imagePath, index) => ({
      labelId: `${index + 1}-${basename(imagePath)}`,
      ...(await labelPayload(imagePath)),
    })),
  );
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function firstString(record, keys) {
  const lowerKeys = new Map(Object.keys(record).map((key) => [key.toLowerCase().trim(), key]));
  for (const key of keys) {
    const direct = stringValue(record[key]);
    if (direct) return direct;
    const matchedKey = lowerKeys.get(key.toLowerCase());
    const matched = matchedKey ? stringValue(record[matchedKey]) : "";
    if (matched) return matched;
  }
  return "";
}

function beverageKindFromClassType(classType) {
  const normalized = classType.toLowerCase();
  if (/\b(beer|lager|ale|stout|porter)\b/u.test(normalized)) return "beer";
  if (/\b(wine|cider|mead|sake)\b/u.test(normalized)) return "wine";
  if (/\b(whiskey|whisky|bourbon|rye|vodka|gin|rum|tequila|mezcal|liqueur|cordial|amaretto|schnapps|absinthe|cognac|brandy|scotch|spirits?)\b/u.test(normalized)) return "spirits";
  return "spirits";
}

function applicationFromRecord(record, sourceName, rowNumber) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const nested = record.application || record.form_data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) return applicationFromRecord(nested, sourceName, rowNumber);

  const brandName = firstString(record, ["brandName", "brand_name", "brand", "brand name"]);
  const classType = firstString(record, ["classType", "class_type", "class", "type", "class/type", "class or type"]);
  const alcoholContent = firstString(record, ["alcoholContent", "alcohol_content", "abv", "alcohol", "alcohol by volume"]);
  const netContents = firstString(record, ["netContents", "net_contents", "contents", "net contents", "size"]);
  const bottlerName = firstString(record, ["bottler_name", "bottlerName", "bottler", "producer", "importer", "name"]);
  const bottlerAddress = firstString(record, ["bottlerAddress", "bottler_address", "address", "producer address", "importer address"]);
  const countryOfOrigin = firstString(record, ["countryOfOrigin", "country_of_origin", "country", "origin"]) || "United States";
  const beverageKind = firstString(record, ["beverageKind", "beverage_kind", "beverage", "profile"]) || beverageKindFromClassType(classType);
  const importedText = firstString(record, ["imported", "is_import", "is import"]);
  const fileName = firstString(record, ["fileName", "file_name", "filename", "label_file", "labelFile", "image", "image_file"]);
  const agedYearsText = firstString(record, ["agedYears", "aged_years", "ageYears", "age_years", "age"]);
  const agedYears = agedYearsText ? Number(agedYearsText) : undefined;

  if (!brandName && !classType && !netContents) return null;
  if (!brandName || !classType || !netContents) {
    const where = rowNumber ? `${sourceName} row ${rowNumber}` : sourceName;
    throw new Error(`Application facts in ${where} need brand, class/type, and net contents.`);
  }

  return {
    sourceName,
    ...(rowNumber ? { rowNumber } : {}),
    ...(fileName ? { fileName } : {}),
    application: {
      brandName,
      classType,
      alcoholContent,
      netContents,
      bottlerAddress: [bottlerName, bottlerAddress].filter(Boolean).join(", "),
      countryOfOrigin,
      beverageKind: ["spirits", "wine", "beer", "other"].includes(beverageKind) ? beverageKind : beverageKindFromClassType(classType),
      imported: /^(true|yes|y|1)$/iu.test(importedText),
      ...(Number.isFinite(agedYears) ? { agedYears } : {}),
    },
  };
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

async function readApplications(path) {
  const ext = extname(path).toLowerCase();
  if (ext === ".csv") {
    return parseCsvRows(await readFile(path, "utf8")).map((record, index) => applicationFromRecord(record, basename(path), index + 2)).filter(Boolean);
  }
  const value = await readJson(path);
  const records = Array.isArray(value) ? value : [value.rows, value.applications, value.records, value.items, value.labels].find(Array.isArray) || [value];
  return records.map((record, index) => applicationFromRecord(record, basename(path), Array.isArray(value) ? index + 1 : undefined)).filter(Boolean);
}

function applicationForLabel(label, applications) {
  if (applications.length === 1) return applications[0].application;
  const matched = applications.find((item) => item.fileName && (item.fileName === label.fileName || basename(item.fileName) === label.fileName));
  if (matched) return matched.application;
  throw new Error(`No application facts matched "${label.fileName}". With multiple facts rows, add a fileName/file_name column matching each image filename.`);
}

function chunks(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

async function postJson(baseUrl, path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === "object" && body?.error?.message ? body.error.message : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return body;
}

async function verifyInput(inputPath, options) {
  if (extname(inputPath).toLowerCase() === ".json" && !options.factsPath) {
    return postJson(options.baseUrl, "/api/v1/verify", await readJson(inputPath));
  }

  if (!options.factsPath) {
    throw new Error(`Image verification needs application facts. Use: labelcheck verify ${inputPath} --facts application.json. For image-only OCR, use: labelcheck extract ${inputPath}`);
  }

  const labels = await labelsFromInput(inputPath);
  const applications = await readApplications(options.factsPath);
  if (!applications.length) throw new Error(`No application facts found in ${options.factsPath}. Use JSON or CSV with brand, class/type, and net contents.`);

  const labelsWithApplications = labels.map((label) => ({ ...label, application: applicationForLabel(label, applications) }));
  const results = [];
  const startedAt = Date.now();
  for (const chunk of chunks(labelsWithApplications, VERIFY_CHUNK_SIZE)) {
    const body = await postJson(options.baseUrl, "/api/v1/verify", {
      application: chunk[0].application,
      labels: chunk,
      options: { maxConcurrency: 3 },
    });
    results.push(...body.results);
  }
  return {
    results,
    meta: {
      count: results.length,
      elapsedMs: Date.now() - startedAt,
      mode: "cli-folder",
      chunks: Math.ceil(labelsWithApplications.length / VERIFY_CHUNK_SIZE),
    },
  };
}

async function extractInput(inputPath, options) {
  if (extname(inputPath).toLowerCase() === ".json") return postJson(options.baseUrl, "/api/v1/extract", await readJson(inputPath));
  const labels = await labelsFromInput(inputPath);
  const results = [];
  const startedAt = Date.now();
  for (const chunk of chunks(labels, 10)) {
    const body = await postJson(options.baseUrl, "/api/v1/extract", { labels: chunk, options: { maxConcurrency: 3 } });
    results.push(...body.results);
  }
  return {
    results,
    meta: {
      count: results.length,
      elapsedMs: Date.now() - startedAt,
      mode: "cli-extract",
      chunks: Math.ceil(labels.length / 10),
    },
  };
}

async function main() {
  const { command, positional, options } = parseArgs(process.argv.slice(2));
  if (!options.baseUrl) throw new Error("--base-url cannot be empty");

  if (command === "health") {
    const response = await fetch(`${options.baseUrl}/api/v1/health`);
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message || `Health check failed with status ${response.status}`);
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  const inputPath = positional[0];
  if (!inputPath) usage(1);

  if (command === "verify") {
    const body = await verifyInput(inputPath, options);
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  if (command === "extract") {
    const body = await extractInput(inputPath, options);
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  if (command === "export") {
    const body = await postJson(options.baseUrl, "/api/v1/export", {
      batch: await readJson(inputPath),
      format: options.format,
    });
    console.log(typeof body === "string" ? body : JSON.stringify(body, null, 2));
    return;
  }

  usage(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
