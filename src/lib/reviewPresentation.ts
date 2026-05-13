import type { CheckStatus } from "./types";

export function needsReviewerAttention(status: CheckStatus): boolean {
  return status === "fail" || status === "warning" || status === "needs_review";
}

export function issueTitle(issueCount: number): string {
  if (issueCount === 0) return "No issues";
  return issueCount === 1 ? "1 issue" : `${issueCount} issues`;
}
