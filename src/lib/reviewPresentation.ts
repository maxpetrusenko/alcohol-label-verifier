import type { CheckStatus, VerificationDecision, VerificationResult } from "./types";

export function needsReviewerAttention(status: CheckStatus): boolean {
  return status === "fail" || status === "warning" || status === "needs_review";
}

export function issueTitle(issueCount: number): string {
  if (issueCount === 0) return "No issues";
  return issueCount === 1 ? "1 issue" : `${issueCount} issues`;
}

export function decisionCounts(results: Pick<VerificationResult, "decision">[]) {
  return results.reduce(
    (counts, result) => {
      counts[result.decision] += 1;
      return counts;
    },
    { approved: 0, needs_review: 0, rejected: 0 } satisfies Record<VerificationDecision, number>,
  );
}

export function batchSummary(results: Pick<VerificationResult, "decision">[]) {
  const counts = decisionCounts(results);
  return `${counts.approved} approved, ${counts.needs_review} review, ${counts.rejected} blocked`;
}
