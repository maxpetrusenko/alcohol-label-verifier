#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { extname, basename } from "node:path";

const DEFAULT_BASE_URL = process.env.LABELCHECK_BASE_URL || "http://localhost:3000";

const MIME_BY_EXT = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".txt", "text/plain"],
]);

function usage(exitCode = 0) {
  const output = `Usage:
  labelcheck health [--base-url URL]
  labelcheck verify input.json [--base-url URL]
  labelcheck extract label.png|label.txt|input.json [--base-url URL]
  labelcheck export result.json [--format json|csv] [--base-url URL]

Set LABELCHECK_BASE_URL to avoid repeating --base-url.
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
    positional.push(item);
  }

  if (!command || command === "--help" || command === "-h") usage();
  return { command, positional, options };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
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
    const body = await postJson(options.baseUrl, "/api/v1/verify", await readJson(inputPath));
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  if (command === "extract") {
    const payload = extname(inputPath).toLowerCase() === ".json" ? await readJson(inputPath) : { labels: [await labelPayload(inputPath)] };
    const body = await postJson(options.baseUrl, "/api/v1/extract", payload);
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
