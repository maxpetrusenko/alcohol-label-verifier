import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateGeneratedFixture,
  evaluateGeneratedFixtures,
  labelTextFromImagePrompt,
  type GeneratedFixtureEvalCase,
  type GeneratedManifestFixture,
} from "./generatedFixtureEval";
import type { FsyedGeneratedFixtureJson } from "./fixtureCases";

const repoRoot = process.cwd();
const generatedDir = join(repoRoot, "public/evals/fixtures/generated");
const reportPath = "/tmp/labelcheck-fsyed-fixture-eval.json";

function readJson<T>(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadGeneratedFixtureCases(): GeneratedFixtureEvalCase[] {
  const manifest = readJson<GeneratedManifestFixture[]>(join(generatedDir, "manifest.json"));
  return manifest.map((item) => ({
    id: item.id,
    manifest: item,
    formData: readJson<FsyedGeneratedFixtureJson>(join(generatedDir, `${item.id}.json`)),
  }));
}

describe("fsyed generated fixture eval runner", () => {
  it("runs every copied generated fixture and writes a gap report", () => {
    const cases = loadGeneratedFixtureCases();
    const report = evaluateGeneratedFixtures(cases);

    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(`fsyed fixture eval: ${report.matched}/${report.total} matched. report=${reportPath}`);

    expect(cases).toHaveLength(60);
    expect(report.total).toBe(60);
    expect(report.results.every((result) => result.labelText.length > 0)).toBe(true);
    expect(existsSync(reportPath)).toBe(true);
  });

  it("approves the first clean pass fixture from its copied JSON and prompt text", () => {
    const clean = loadGeneratedFixtureCases().find((item) => item.id === "01-pass-01");
    expect(clean).toBeDefined();

    const result = evaluateGeneratedFixture(clean!);

    expect(result.expectedDecision).toBe("approved");
    expect(result.actualDecision).toBe("approved");
    expect(result.failedChecks).toEqual([]);
  });

  it("extracts label-visible text from upstream image prompts", () => {
    const clean = loadGeneratedFixtureCases().find((item) => item.id === "01-pass-01");
    expect(clean).toBeDefined();

    const labelText = labelTextFromImagePrompt(clean!.manifest.image_prompt);

    expect(labelText).toContain("Old Cypress Distillery");
    expect(labelText).toContain("Distilled and bottled by Old Cypress Distillery, Louisville, KY");
    expect(labelText).toContain("GOVERNMENT WARNING:");
  });
});
