#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_BASE_URL = process.env.LABELCHECK_BASE_URL || "http://localhost:3100";
const DEFAULT_CASES = ["clean-pass", "field-mismatch-brand", "bad-photo-blur"];
const LOCAL_DISCOVERY_URLS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://localhost:3005",
  "http://localhost:3100",
];

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function health(baseUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`${baseUrl}/api/v1/health`, { signal: controller.signal });
    const body = await response.json();
    return response.ok && body?.service === "alcohol-label-verifier" ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function commandText(command, args, env = {}) {
  const prefix = env.LABELCHECK_BASE_URL ? `LABELCHECK_BASE_URL=${env.LABELCHECK_BASE_URL} ` : "";
  return `${prefix}${[command, ...args].join(" ")}`;
}

async function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const code = await new Promise((resolve) => {
    child.on("close", resolve);
  });

  if (code !== 0) {
    throw new Error(`${commandText(command, args, options.env)} failed with exit ${code}\n${stderr || stdout}`);
  }

  return { stdout, stderr };
}

async function startServer(baseUrl) {
  const url = new URL(baseUrl);
  const port = url.port || (url.protocol === "https:" ? "443" : "3000");
  const hostname = url.hostname === "localhost" ? "127.0.0.1" : url.hostname;
  const logPath = join(tmpdir(), "labelcheck-cli-demo-next.log");
  const child = spawn("npm", ["run", "dev", "--", "--hostname", hostname, "--port", port], {
    cwd: repoRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let log = "";
  child.stdout.on("data", (chunk) => {
    log += chunk;
  });
  child.stderr.on("data", (chunk) => {
    log += chunk;
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await health(baseUrl)) {
      await writeFile(logPath, log);
      return { child, logPath };
    }
    await sleep(500);
  }

  child.kill("SIGTERM");
  await writeFile(logPath, log);
  throw new Error(`Local server did not become healthy at ${baseUrl}. Dev log: ${logPath}`);
}

async function discoverBaseUrl(preferredBaseUrl) {
  if (await health(preferredBaseUrl)) return preferredBaseUrl;
  for (const candidate of LOCAL_DISCOVERY_URLS) {
    if (candidate !== preferredBaseUrl && (await health(candidate))) return candidate;
  }
  return preferredBaseUrl;
}

async function loadFixtures(caseIds) {
  const manifestPath = join(repoRoot, "public/evals/fixtures/spirits-rendered-regression/manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const byId = new Map(manifest.map((fixture) => [fixture.id, fixture]));
  return caseIds.map((id) => {
    const fixture = byId.get(id);
    if (!fixture) throw new Error(`Missing fixture ${id} in ${manifestPath}`);
    return fixture;
  });
}

function buildVerifyPayload(fixtures) {
  return {
    application: fixtures[0].application,
    labels: fixtures.map((fixture) => ({
      labelId: fixture.id,
      fileName: `${fixture.id}.txt`,
      mimeType: "text/plain",
      text: [fixture.labelVisibleText, fixture.visualObservation].filter(Boolean).join("\n"),
      application: fixture.application,
    })),
    options: {
      maxConcurrency: 3,
    },
  };
}

function decisionCounts(results) {
  return results.reduce((counts, result) => {
    counts[result.decision] = (counts[result.decision] ?? 0) + 1;
    return counts;
  }, {});
}

async function main() {
  const explicitBaseUrl = process.argv.includes("--base-url") || Boolean(process.env.LABELCHECK_BASE_URL);
  let baseUrl = argValue("--base-url", DEFAULT_BASE_URL);
  const caseIds = argValue("--cases", DEFAULT_CASES.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const outDir = argValue("--out-dir", join(tmpdir(), "labelcheck-cli-demo"));

  await mkdir(outDir, { recursive: true });

  let server;
  try {
    if (!explicitBaseUrl) {
      const discoveredBaseUrl = await discoverBaseUrl(baseUrl);
      if (discoveredBaseUrl !== baseUrl) {
        console.log(`Using existing LabelCheck server at ${discoveredBaseUrl}`);
        baseUrl = discoveredBaseUrl;
      }
    }

    if (!(await health(baseUrl))) {
      if (hasFlag("--no-start")) {
        throw new Error(`No healthy LabelCheck server at ${baseUrl}. Start it with npm run dev, or remove --no-start.`);
      }
      console.log(`Starting local LabelCheck server at ${baseUrl}`);
      server = await startServer(baseUrl);
    }

    const env = { LABELCHECK_BASE_URL: baseUrl };
    const fixtures = await loadFixtures(caseIds);
    const verifyInputPath = join(outDir, "verify-input.json");
    const verifyOutputPath = join(outDir, "verify-output.json");
    const exportCsvPath = join(outDir, "review-packet.csv");
    await writeFile(verifyInputPath, `${JSON.stringify(buildVerifyPayload(fixtures), null, 2)}\n`);

    console.log(commandText(process.execPath, ["bin/labelcheck.mjs", "health"], env));
    const healthResult = await run(process.execPath, ["bin/labelcheck.mjs", "health"], { env });
    const healthBody = JSON.parse(healthResult.stdout);
    console.log(`health ok=${healthBody.ok} vision=${healthBody.vision?.mode ?? "unknown"}`);

    console.log(commandText(process.execPath, ["bin/labelcheck.mjs", "verify", verifyInputPath], env));
    const verifyResult = await run(process.execPath, ["bin/labelcheck.mjs", "verify", verifyInputPath], { env });
    await writeFile(verifyOutputPath, verifyResult.stdout);
    const verifyBody = JSON.parse(verifyResult.stdout);

    console.log(commandText(process.execPath, ["bin/labelcheck.mjs", "export", verifyOutputPath, "--format", "csv"], env));
    const exportResult = await run(process.execPath, ["bin/labelcheck.mjs", "export", verifyOutputPath, "--format", "csv"], { env });
    await writeFile(exportCsvPath, exportResult.stdout);

    const expectedById = new Map(fixtures.map((fixture) => [fixture.id, fixture.expectedDecision]));
    const mismatches = verifyBody.results.filter((result) => result.decision !== expectedById.get(result.labelId));
    console.log(`decisions ${JSON.stringify(decisionCounts(verifyBody.results))}`);
    console.log(`wrote ${basename(verifyInputPath)}, ${basename(verifyOutputPath)}, ${basename(exportCsvPath)} in ${outDir}`);

    if (server?.logPath) console.log(`server log ${server.logPath}`);
    if (mismatches.length > 0) {
      for (const result of mismatches) {
        console.error(`decision mismatch ${result.labelId}: expected ${expectedById.get(result.labelId)} got ${result.decision}`);
      }
      process.exitCode = 1;
    }
  } finally {
    if (server?.child && !server.child.killed) server.child.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
