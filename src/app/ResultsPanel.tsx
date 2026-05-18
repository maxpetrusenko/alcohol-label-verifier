import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReviewRow } from "@/lib/reviewRows";
import { issueTitle } from "@/lib/reviewPresentation";
import type { VerificationCheck, VerificationResult } from "@/lib/types";
import {
  type Adjudication,
  type AdjudicationUpdate,
  defaultReviewerDecision,
  decisionIcon,
  dispositionNeedsReason,
  labelEvidenceContent,
  reasonCodeLabel,
  rowReason,
  rowStatusLabel,
  reviewerDispositionOptions,
  reviewerReasonOptions,
} from "./pageSupport";

type ResultsPanelProps = {
  activeResult: VerificationResult;
  attentionChecks: VerificationCheck[];
  activeAdjudication?: Adjudication;
  adjudicationCount: number;
  exportStatus: string | null;
  isVerifying: boolean;
  activeReviewRows: ReviewRow[];
  scoredReviewRows: ReviewRow[];
  activeSupplementalRows: ReviewRow[];
  nextSteps: string[];
  onReviewerDecision: (update: AdjudicationUpdate) => void;
  onExportReviewPacket: (format: "json" | "csv") => void;
  onCopyReviewSummary: () => void;
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
  adjudicationCount,
  exportStatus,
  isVerifying,
  activeReviewRows,
  scoredReviewRows,
  activeSupplementalRows,
  nextSteps,
  onReviewerDecision,
  onExportReviewPacket,
  onCopyReviewSummary,
}: ResultsPanelProps) {
  const alert = extractionAlert(activeResult);
  const extractionNotes = Array.isArray(activeResult.extraction.notes) ? activeResult.extraction.notes : [];
  const extractionConfidence = typeof activeResult.extraction.confidence === "number" ? activeResult.extraction.confidence : 0;
  const needsDispositionDetail = dispositionNeedsReason(activeAdjudication?.disposition);
  const dispositionStatus = activeAdjudication ? (activeAdjudication.isComplete ? "Draft ready" : "Needs reason and note") : "No reviewer draft";

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

        <div className="reviewer-disposition" aria-label="Reviewer disposition">
          <div className="reviewer-disposition-head">
            <strong>Reviewer disposition</strong>
            <span className={activeAdjudication?.isComplete ? "disposition-ready" : "disposition-open"}>{dispositionStatus}</span>
          </div>
          <div className="disposition-actions">
            {reviewerDispositionOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`disposition-action ${activeAdjudication?.disposition === option.value ? "selected" : ""}`}
                disabled={isVerifying}
                onClick={() =>
                  onReviewerDecision({
                    disposition: option.value,
                    reviewerDecision: defaultReviewerDecision(option.value, activeResult.decision),
                  })
                }
              >
                <span>{option.label}</span>
                <small>{option.hint}</small>
              </button>
            ))}
          </div>
          {activeAdjudication ? (
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
          ) : null}
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
            <span>{exportStatus ?? `${adjudicationCount} reviewer draft${adjudicationCount === 1 ? "" : "s"}`}</span>
          </div>
        </div>

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
