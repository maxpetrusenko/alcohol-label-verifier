import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  benchmarkDegradedFixtures,
  loadDegradedFixtures,
} from "./degradedFixtureBenchmark";

const reportPath = "/tmp/labelcheck-degraded-fixture-benchmark.json";

function hasMagick() {
  try {
    execFileSync("magick", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!hasMagick())("degraded generated fixture benchmark", () => {
  it("generates and benchmarks 500 degraded fixture photos without committing image artifacts", () => {
    const outDir = mkdtempSync(join(tmpdir(), "labelcheck-degraded-fixtures-"));

    try {
      execFileSync(process.execPath, ["scripts/generate-degraded-fixtures.mjs", "--count", "500", "--out", outDir], {
        stdio: "ignore",
      });

      const fixtures = loadDegradedFixtures(outDir);
      const report = benchmarkDegradedFixtures(fixtures);

      mkdirSync(dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

      console.log(`degraded fixture benchmark: ${report.matched}/${report.total} matched. report=${reportPath}`);

      expect(fixtures).toHaveLength(500);
      expect(report.total).toBe(500);
      expect(report.gaps).toEqual([]);
      expect(Object.keys(report.byVariant)).toEqual([
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
      ]);
      expect(report.results.some((result) => result.actualDecision === "approved")).toBe(true);
      expect(report.results.some((result) => result.actualDecision === "needs_review")).toBe(true);
      expect(report.results.some((result) => result.orientation === "upside-down")).toBe(true);

      for (const fixture of [fixtures[0], fixtures[49], fixtures[199], fixtures[499]]) {
        expect(existsSync(join(outDir, fixture.image.split("/").pop() ?? ""))).toBe(true);
        expect(readFileSync(join(outDir, `${fixture.id}.json`), "utf8")).toContain(fixture.imageHash);
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 180_000);
});
