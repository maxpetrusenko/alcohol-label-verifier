import { describe, expect, it } from "vitest";
import { issueTitle, needsReviewerAttention } from "./reviewPresentation";

describe("review presentation", () => {
  it("shows needs-review checks as reviewer issues", () => {
    expect(needsReviewerAttention("needs_review")).toBe(true);
    expect(issueTitle(3)).toBe("3 issues");
  });

  it("does not show clean pass checks as issues", () => {
    expect(needsReviewerAttention("pass")).toBe(false);
    expect(issueTitle(0)).toBe("No issues");
  });
});
