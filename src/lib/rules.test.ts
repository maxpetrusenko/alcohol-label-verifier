import { describe, expect, it } from "vitest";
import { extractionFromPlainText, GOVERNMENT_WARNING_TEXT, normalizeForMatch, verifyLabel } from "./rules";
import type { ApplicationData } from "./types";

const application: ApplicationData = {
  brandName: "Stone's Throw",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  beverageKind: "spirits",
};

describe("label verification rules", () => {
  it("normalizes case and apostrophes for brand matching", () => {
    expect(normalizeForMatch("STONE'S THROW")).toBe(normalizeForMatch("Stone’s Throw"));
  });

  it("approves matching core fields and exact warning", () => {
    const extraction = extractionFromPlainText(`STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\n${GOVERNMENT_WARNING_TEXT}`);
    const result = verifyLabel(application, extraction, "test-label");
    expect(result.decision).toBe("approved");
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("rejects an ABV mismatch", () => {
    const extraction = extractionFromPlainText(`STONE'S THROW\nKentucky Straight Bourbon Whiskey\n40% Alc./Vol. (80 Proof)\n750 mL\n${GOVERNMENT_WARNING_TEXT}`);
    const result = verifyLabel(application, extraction, "bad-abv");
    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "alcohol-content")?.status).toBe("fail");
  });

  it("flags non-exact warning text for review or rejection", () => {
    const extraction = extractionFromPlainText("STONE'S THROW\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nGovernment Warning: drink responsibly");
    const result = verifyLabel(application, extraction, "bad-warning");
    expect(result.decision).toBe("rejected");
    expect(result.checks.find((check) => check.id === "government-warning")?.status).toBe("fail");
  });
});
