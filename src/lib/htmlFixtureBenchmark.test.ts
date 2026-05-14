import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  benchmarkHtmlGeneratedFixture,
  benchmarkHtmlGeneratedFixtures,
  htmlGeneratedFixtureDir,
  loadHtmlGeneratedFixtures,
} from "./htmlFixtureBenchmark";

const reportPath = "/tmp/labelcheck-html-fixture-benchmark.json";

describe("deterministic HTML/SVG fixture benchmark", () => {
  it("runs verifier rules over generated fixture ground truth without a model API", () => {
    const fixtures = loadHtmlGeneratedFixtures();
    const report = benchmarkHtmlGeneratedFixtures(fixtures);

    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(`html fixture benchmark: ${report.matched}/${report.total} matched. report=${reportPath}`);

    expect(fixtures).toHaveLength(9);
    expect(report.total).toBe(9);
    expect(report.gaps).toEqual([]);
  });

  it("covers clean pass, mismatch, warning, and bad-photo outcomes", () => {
    const byId = Object.fromEntries(loadHtmlGeneratedFixtures().map((fixture) => [fixture.id, fixture]));

    expect(benchmarkHtmlGeneratedFixture(byId["clean-pass"]).actualDecision).toBe("approved");
    expect(benchmarkHtmlGeneratedFixture(byId["field-mismatch-brand"]).problemChecks).toContain("brand-name");
    expect(benchmarkHtmlGeneratedFixture(byId["warning-title-case"]).problemChecks).toContain("government-warning");
    expect(benchmarkHtmlGeneratedFixture(byId["bad-photo-blur"]).problemChecks).toContain("extraction-confidence");
    expect(benchmarkHtmlGeneratedFixture(byId["bad-photo-tiny-warning"]).problemChecks).toContain("warning-legibility");
  });

  it("has committed artifact files for every manifest row", () => {
    for (const fixture of loadHtmlGeneratedFixtures()) {
      expect(readFileSync(join(htmlGeneratedFixtureDir, fixture.artifacts.svg), "utf8")).toContain(fixture.id);
      expect(readFileSync(join(htmlGeneratedFixtureDir, fixture.artifacts.html), "utf8")).toContain(fixture.expectedDecision);
      expect(readFileSync(join(htmlGeneratedFixtureDir, `${fixture.id}.json`), "utf8")).toContain(fixture.contentHash);
    }
  });
});
