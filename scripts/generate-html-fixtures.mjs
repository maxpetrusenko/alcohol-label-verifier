#!/usr/bin/env node
import { resolve } from "node:path";
import { writeFixtures } from "./html-fixture-generator.mjs";

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

const outDir = resolve(argValue("--out", "public/evals/fixtures/html-generated"));
const manifest = writeFixtures(outDir);

console.log(`wrote ${manifest.length} deterministic fixtures to ${outDir}`);
