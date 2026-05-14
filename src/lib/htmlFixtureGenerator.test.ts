import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { HtmlGeneratedFixture } from "./htmlFixtureBenchmark";

function runGenerator(outDir: string) {
  execFileSync(process.execPath, ["scripts/generate-html-fixtures.mjs", "--out", outDir], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
}

function readManifest(outDir: string) {
  return JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8")) as HtmlGeneratedFixture[];
}

describe("deterministic HTML/SVG fixture generator", () => {
  it("writes the required local fixture cases without image-generation dependencies", () => {
    const outDir = mkdtempSync(join(tmpdir(), "labelcheck-fixtures-"));

    runGenerator(outDir);
    const manifest = readManifest(outDir);

    expect(manifest.map((fixture) => fixture.id)).toEqual([
      "clean-pass",
      "field-mismatch-brand",
      "warning-wrong-text",
      "warning-title-case",
      "bad-photo-blur",
      "bad-photo-glare",
      "bad-photo-low-light",
      "bad-photo-perspective",
      "bad-photo-tiny-warning",
    ]);
    expect(manifest.every((fixture) => existsSync(join(outDir, fixture.artifacts.svg)))).toBe(true);
    expect(manifest.every((fixture) => existsSync(join(outDir, fixture.artifacts.html)))).toBe(true);
    expect(manifest.every((fixture) => existsSync(join(outDir, `${fixture.id}.json`)))).toBe(true);
  });

  it("is deterministic across repeated runs", () => {
    const firstDir = mkdtempSync(join(tmpdir(), "labelcheck-fixtures-a-"));
    const secondDir = mkdtempSync(join(tmpdir(), "labelcheck-fixtures-b-"));

    runGenerator(firstDir);
    runGenerator(secondDir);

    const first = readManifest(firstDir);
    const second = readManifest(secondDir);

    expect(second.map((fixture) => fixture.contentHash)).toEqual(first.map((fixture) => fixture.contentHash));
    expect(readFileSync(join(secondDir, "clean-pass.svg"), "utf8")).toBe(readFileSync(join(firstDir, "clean-pass.svg"), "utf8"));
  });
});
