import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReviewRow } from "@/lib/reviewRows";
import { issueTitle } from "@/lib/reviewPresentation";
import type { VerificationCheck, VerificationResult } from "@/lib/types";
import {
  type Adjudication,
  type AdjudicationUpdate,
  decisionIcon,
  dispositionNeedsReason,
  labelEvidenceContent,
  reasonCodeLabel,
  rowReason,
  rowStatusLabel,
  reviewerReasonOptions,
} from "./pageSupport";

type ResultsPanelProps = {
  activeResult: VerificationResult;
  attentionChecks: VerificationCheck[];
  activeAdjudication?: Adjudication;
  exportStatus: string | null;
  isVerifying: boolean;
  activeReviewRows: ReviewRow[];
  scoredReviewRows: ReviewRow[];
  activeSupplementalRows: ReviewRow[];
  nextSteps: string[];
  onReviewerDecision: (update: AdjudicationUpdate) => void;
  onExportReviewPacket: (format: "json" | "csv") => void;
  onCopyReviewSummary: () => void;
  onClearExportStatus: () => void;
};

function LabelEvidence({ row }: { row: ReviewRow }) {
  return <>{labelEvidenceContent(row)}</>;
}

function extractionAlert(result: VerificationResult) {
  const notes = Array.isArray(result.extraction.notes) ? result.extraction.notes : [];
  const note = notes.find((item) => /(?:vision extraction failed|timed out|provider status|unreadable json|extraction failed|verification request failed)/iu.test(item));
  if (!note) return null;
  return {
    title: /used supplied text evidence/iu.test(note) ? "Vision timed out; using supplied text evidence" : "Vision extraction issue",
    detail: note,
    severe: result.extraction.confidence === 0,
  };
}

export function ResultsPanel({
  activeResult,
  attentionChecks,
  activeAdjudication,
  exportStatus,
  isVerifying,
  activeReviewRows,
  scoredReviewRows,
  activeSupplementalRows,
  nextSteps,
  onReviewerDecision,
  onExportReviewPacket,
  onCopyReviewSummary,
  onClearExportStatus,
}: ResultsPanelProps) {
  const alert = extractionAlert(activeResult);
  const extractionNotes = Array.isArray(activeResult.extraction.notes) ? activeResult.extraction.notes : [];
  const extractionConfidence = typeof activeResult.extraction.confidence === "number" ? activeResult.extraction.confidence : 0;
  const needsDispositionDetail = dispositionNeedsReason(activeAdjudication?.disposition);
  const needsReviewerFields = Boolean(activeAdjudication && (activeAdjudication.reviewerDecision === "rejected" || needsDispositionDetail));
  const approvalSelected = activeAdjudication?.reviewerDecision === "approved";
  const rejectionSelected = activeAdjudication?.reviewerDecision === "rejected";
  const reviewerStatus = activeAdjudication ? (activeAdjudication.isComplete ? "Decision saved" : "Needs reason and note") : undefined;

  return (
    <section className="guidance-panel" aria-label="Issues and next steps">
      <div className="field-comparison-header">
        <div className="section-title review-title">
          {decisionIcon(activeResult.decision)}
          <div>
            <h2>Field comparison</h2>
            <p>{`${issueTitle(attentionChecks.length)} · ${activeResult.elapsedMs} ms`}</p>
          </div>
        </div>
        <div className="field-comparison-actions">
          <div className={`score-row decision-${activeResult.decision}`}>
            <span>{activeResult.decision.replace("_", " ")}</span>
            <strong>{activeResult.score}%</strong>
          </div>
        </div>
      </div>

      <div className="comparison-stack">
        <div className="comparison-meta">
          <span>{Math.round(extractionConfidence * 100)}% extraction confidence</span>
          <span>{scoredReviewRows.filter((row) => row.status === "pass").length}/{scoredReviewRows.length} requirement rows pass</span>
        </div>

        <div className="review-decision-actions" aria-label="Reviewer decision actions">
          <div className="review-decision-primary">
            <button
              type="button"
              className={`review-decision-button approve ${approvalSelected ? "selected" : ""}`}
              disabled={isVerifying}
              onClick={() =>
                onReviewerDecision({
                  disposition: activeResult.decision === "approved" ? "accept_recommendation" : "override",
                  reviewerDecision: "approved",
                  reasonCode: "",
                  note: "",
                })
              }
            >
              Approve
            </button>
            <button
              type="button"
              className={`review-decision-button reject ${rejectionSelected ? "selected" : ""}`}
              disabled={isVerifying}
              onClick={() =>
                onReviewerDecision({
                  disposition: "override",
                  reviewerDecision: "rejected",
                })
              }
            >
              Reject
            </button>
          </div>
          <div className="review-output-actions" aria-label="Review packet actions">
            <button type="button" disabled={isVerifying} onClick={() => onExportReviewPacket("json")}>
              Export packet
            </button>
            <button type="button" disabled={isVerifying} onClick={() => onExportReviewPacket("csv")}>
              Export CSV
            </button>
            <button type="button" disabled={isVerifying} onClick={onCopyReviewSummary}>
              Copy summary
            </button>
            {reviewerStatus ? <span>{reviewerStatus}</span> : null}
          </div>
        </div>

        {exportStatus ? (
          <div className="review-toast" role="status">
            <span>{exportStatus}</span>
            <button type="button" onClick={onClearExportStatus} aria-label="Close notification">
              Close
            </button>
          </div>
        ) : null}

        {needsReviewerFields && activeAdjudication ? (
          <div className="reviewer-disposition" aria-label="Reviewer decision details">
              <div className="disposition-fields">
                {activeAdjudication.disposition === "override" ? (
                  <label>
                    <span>Reviewer outcome</span>
                    <select
                      aria-label="Reviewer outcome"
                      value={activeAdjudication.reviewerDecision ?? ""}
                      disabled={isVerifying}
                      onChange={(event) => onReviewerDecision({ reviewerDecision: event.currentTarget.value as Adjudication["reviewerDecision"] })}
                    >
                      <option value="approved">Approve</option>
                      <option value="needs_review">Needs review</option>
                      <option value="rejected">Reject</option>
                    </select>
                  </label>
                ) : null}
                <label>
                  <span>{needsDispositionDetail ? "Reason code required" : "Reason code"}</span>
                  <select
                    aria-label="Reason code"
                    value={activeAdjudication.reasonCode}
                    disabled={isVerifying}
                    aria-required={needsDispositionDetail}
                    onChange={(event) => onReviewerDecision({ reasonCode: event.currentTarget.value as Adjudication["reasonCode"] })}
                  >
                    <option value="">Select reason</option>
                    {reviewerReasonOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="disposition-note">
                  <span>{needsDispositionDetail ? "Note required" : "Note"}</span>
                  <textarea
                    aria-label="Reviewer note"
                    value={activeAdjudication.note}
                    disabled={isVerifying}
                    aria-required={needsDispositionDetail}
                    rows={2}
                    placeholder={needsDispositionDetail ? "Add reviewer rationale before export." : "Optional reviewer note."}
                    onChange={(event) => onReviewerDecision({ note: event.currentTarget.value })}
                  />
                </label>
                {activeAdjudication.reasonCode ? <p>{reasonCodeLabel(activeAdjudication.reasonCode)}</p> : null}
              </div>
          </div>
        ) : null}

        {alert ? (
          <div className={`extraction-alert ${alert.severe ? "extraction-alert-severe" : ""}`} role="status">
            <AlertCircle aria-hidden />
            <div>
              <strong>{alert.title}</strong>
              <p>{alert.detail}</p>
            </div>
          </div>
        ) : null}

        <div className="comparison-table" aria-label="Expected and detected label values">
          <div className="comparison-head" aria-hidden>
            <span>Requirement</span>
            <span>Application</span>
            <span>Label evidence</span>
            <span>Status</span>
          </div>
          {activeReviewRows.map((row) => (
            <article className={`comparison-row comparison-${row.status}`} key={row.id}>
              <div className="comparison-name">
                <strong>{row.label}</strong>
              </div>
              <p>{row.expected || "Not supplied"}</p>
              <p>
                <LabelEvidence row={row} />
              </p>
              <span>{rowStatusLabel(row)}</span>
              {rowReason(row) ? <small className="comparison-reason">{rowReason(row)}</small> : null}
            </article>
          ))}
        </div>

        {activeSupplementalRows.length ? (
          <details className="advisory-drawer">
            <summary>Additional advisories ({activeSupplementalRows.length})</summary>
            <div className="advisory-list">
              {activeSupplementalRows.map((row) => (
                <article className={`comparison-row comparison-${row.status}`} key={row.id}>
                  <div className="comparison-name">
                    <strong>{row.label}</strong>
                  </div>
                  <p>{row.expected || "Not supplied"}</p>
                  <p>
                    <LabelEvidence row={row} />
                  </p>
                  <span>{rowStatusLabel(row)}</span>
                  {rowReason(row) ? <small className="comparison-reason">{rowReason(row)}</small> : null}
                </article>
              ))}
            </div>
          </details>
        ) : null}

        <details className="extraction-evidence">
          <summary>Additional details: extracted text evidence</summary>
          <pre>{activeResult.extraction.labelText || "No raw label text returned."}</pre>
          {extractionNotes.length ? (
            <ul>
              {extractionNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </details>

        <details className="next-card">
          <summary>{activeResult.decision === "approved" ? "Ready" : "Next action"}</summary>
          {activeResult.missingApplicationFacts?.length ? (
            <div className="missing-facts">
              <strong>Missing facts</strong>
              {activeResult.missingApplicationFacts.map((fact) => (
                <span key={fact.field}>{fact.label}</span>
              ))}
            </div>
          ) : null}
          <ul>
            {(nextSteps.length ? nextSteps : extractionNotes.length ? extractionNotes : ["Ready to save."])
              .slice(0, 3)
              .map((step) => (
                <li key={step}>
                  <CheckCircle2 aria-hidden />
                  <span>{step}</span>
                </li>
              ))}
          </ul>
        </details>
      </div>
    </section>
  );
}
