import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applicationFromFsyedFixture, fixtureCases, fixtureCasesById, type FsyedGeneratedFixtureJson } from "./fixtureCases";

const repoRoot = process.cwd();

function publicFile(path: string) {
  return join(repoRoot, "public", path.replace(/^\//u, ""));
}

describe("fixture case index", () => {
  it("references copied public image and json files", () => {
    for (const fixture of fixtureCases) {
      expect(existsSync(publicFile(fixture.publicImagePath)), `${fixture.id} image exists`).toBe(true);
      expect(existsSync(publicFile(fixture.publicJsonPath)), `${fixture.id} json exists`).toBe(true);
    }
  });

  it("normalizes upstream form JSON into ApplicationData", () => {
    for (const fixture of fixtureCases) {
      const raw = JSON.parse(readFileSync(publicFile(fixture.publicJsonPath), "utf8")) as FsyedGeneratedFixtureJson;
      expect(fixture.application).toEqual(applicationFromFsyedFixture(raw));
    }
  });

  it("keeps a unique lookup by fixture id", () => {
    expect(Object.keys(fixtureCasesById)).toHaveLength(fixtureCases.length);
    for (const fixture of fixtureCases) {
      expect(fixtureCasesById[fixture.id]).toBe(fixture);
    }
  });
});
