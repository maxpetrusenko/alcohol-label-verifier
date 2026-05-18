import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReviewRow } from "@/lib/reviewRows";
import { issueTitle } from "@/lib/reviewPresentation";
import type { VerificationCheck, VerificationResult } from "@/lib/types";
import {
  type Adjudication,
  decisionIcon,
  dispositionLabel,
  type ReviewerDisposition,
  labelEvidenceContent,
  rowReason,
  rowStatusLabel,
} from "./pageSupport";

type ResultsPanelProps = {
  activeResult: VerificationResult;
  attentionChecks: VerificationCheck[];
  activeAdjudication?: Adjudication;
  isVerifying: boolean;
  activeReviewRows: ReviewRow[];
  scoredReviewRows: ReviewRow[];
  activeSupplementalRows: ReviewRow[];
  nextSteps: string[];
  onReviewerDecision: (decision: ReviewerDisposition) => void;
};

function LabelEvidence({ row }: { row: ReviewRow }) {
  return <>{labelEvidenceContent(row)}</>;
}

function extractionAlert(result: VerificationResult) {
  const note = result.extraction.notes.find((item) => /(?:vision extraction failed|timed out|provider status|unreadable json|extraction failed)/iu.test(item));
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
  isVerifying,
  activeReviewRows,
  scoredReviewRows,
  activeSupplementalRows,
  nextSteps,
  onReviewerDecision,
}: ResultsPanelProps) {
  const alert = extractionAlert(activeResult);

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
          <div className="decision-actions inline-decision-actions" aria-label="Reviewer final decision">
            {(["approved", "rejected"] as const).map((decision) => (
              <button
                key={decision}
                type="button"
                className={`decision-action ${activeAdjudication?.decision === decision ? "selected" : ""} decision-action-${decision}`}
                disabled={isVerifying}
                onClick={() => onReviewerDecision(decision)}
              >
                {dispositionLabel(decision)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="comparison-stack">
        <div className="comparison-meta">
          <span>{Math.round(activeResult.extraction.confidence * 100)}% extraction confidence</span>
          <span>{scoredReviewRows.filter((row) => row.status === "pass").length}/{scoredReviewRows.length} requirement rows pass</span>
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
          {activeResult.extraction.notes.length ? (
            <ul>
              {activeResult.extraction.notes.map((note) => (
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
            {(nextSteps.length ? nextSteps : activeResult.extraction.notes.length ? activeResult.extraction.notes : ["Ready to save."])
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
