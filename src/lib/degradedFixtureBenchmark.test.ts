import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  benchmarkDegradedFixtures,
  loadDegradedFixtures,
} from "./degradedFixtureBenchmark";

const reportPath = "/tmp/labelcheck-degraded-fixture-benchmark.json";
const expectedVariants = [
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

function hasMagick() {
  try {
    execFileSync("magick", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!hasMagick())("degraded generated fixture benchmark", () => {
  it("generates and benchmarks one representative photo per degradation variant", () => {
    const outDir = mkdtempSync(join(tmpdir(), "labelcheck-degraded-fixtures-"));

    try {
      execFileSync(process.execPath, ["scripts/generate-degraded-fixtures.mjs", "--variants-smoke", "--out", outDir], {
        stdio: "ignore",
      });

      const fixtures = loadDegradedFixtures(outDir);
      const report = benchmarkDegradedFixtures(fixtures);

      mkdirSync(dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

      console.log(`degraded fixture benchmark: ${report.matched}/${report.total} matched. report=${reportPath}`);

      expect(fixtures).toHaveLength(expectedVariants.length);
      expect(report.total).toBe(expectedVariants.length);
      expect(report.gaps).toEqual([]);
      expect(Object.keys(report.byVariant)).toEqual(expectedVariants);
      expect(Object.values(report.byVariant).every((variant) => variant.total === 1 && variant.matched === 1)).toBe(true);
      expect(report.results.some((result) => result.actualDecision === "approved")).toBe(true);
      expect(report.results.some((result) => result.actualDecision === "needs_review")).toBe(true);
      expect(report.results.some((result) => result.orientation === "upside-down")).toBe(true);

      for (const fixture of fixtures) {
        const imagePath = join(outDir, fixture.image.split("/").pop() ?? "");

        expect(existsSync(imagePath)).toBe(true);
        const imageHash = createHash("sha256").update(readFileSync(imagePath)).digest("hex").slice(0, 16);
        expect(imageHash).toBe(fixture.imageHash);
        expect(readFileSync(join(outDir, `${fixture.id}.json`), "utf8")).toContain(fixture.imageHash);
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 30_000);
});
