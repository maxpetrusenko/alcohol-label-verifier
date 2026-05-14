import { describe, expect, it } from "vitest";
import { batchSummary, decisionCounts, issueTitle, needsReviewerAttention } from "./reviewPresentation";

describe("review presentation", () => {
  it("shows needs-review checks as reviewer issues", () => {
    expect(needsReviewerAttention("needs_review")).toBe(true);
    expect(issueTitle(3)).toBe("3 issues");
  });

  it("does not show clean pass checks as issues", () => {
    expect(needsReviewerAttention("pass")).toBe(false);
    expect(issueTitle(0)).toBe("No issues");
  });

  it("summarizes batch decisions for reviewers", () => {
    const counts = decisionCounts([
      { decision: "approved" },
      { decision: "needs_review" },
      { decision: "rejected" },
      { decision: "rejected" },
    ]);

    expect(counts).toEqual({ approved: 1, needs_review: 1, rejected: 2 });
    expect(batchSummary([{ decision: "approved" }, { decision: "needs_review" }])).toBe("1 approved, 1 review, 0 blocked");
  });
});
