"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Bot,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileImage,
  Loader2,
  Scale,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { fixtureCases, type FixtureCase } from "@/lib/fixtureCases";
import { buildVerificationLabels, type PendingLabel } from "@/lib/labelPayload";
import type { ApplicationData, CheckStatus, VerificationResult } from "@/lib/types";

const demoText = `OLD TOM DISTILLERY
Kentucky Straight Bourbon Whiskey
45% Alc./Vol. (90 Proof)
750 mL
Bottled by Old Tom Distillery, Frankfort, KY
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`;

const demoApplication: ApplicationData = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  bottlerAddress: "Old Tom Distillery, Frankfort, KY",
  countryOfOrigin: "",
  beverageKind: "spirits",
};

const fixtureCategoryLabel: Record<FixtureCase["category"], string> = {
  pass: "Pass",
  mismatch: "Mismatch",
  label_noncompliant: "Label rule",
  matching_noncompliant: "Rule gap",
  warning_bad: "Warning",
  warning_sneaky: "Warning",
};

const fields = [
  ["brandName", "Brand"],
  ["classType", "Class or type"],
  ["alcoholContent", "Alcohol"],
  ["netContents", "Contents"],
  ["bottlerAddress", "Bottler"],
  ["countryOfOrigin", "Origin"],
] as const;

function statusClass(status: CheckStatus) {
  return `check check-${status}`;
}

function decisionIcon(decision?: VerificationResult["decision"]) {
  if (decision === "approved") return <BadgeCheck aria-hidden className="decision-icon pass" />;
  if (decision === "rejected") return <XCircle aria-hidden className="decision-icon fail" />;
  return <AlertTriangle aria-hidden className="decision-icon review" />;
}

function decisionCopy(result?: VerificationResult) {
  if (!result) {
    return {
      title: "Ready",
      body: "Add label and facts.",
      tone: "idle",
    };
  }

  if (result.decision === "approved") {
    return {
      title: "Approved",
      body: "Label matches application.",
      tone: "pass",
    };
  }

  if (result.decision === "rejected") {
    return {
      title: "Blocked",
      body: "Fix label or facts.",
      tone: "fail",
    };
  }

  return {
    title: "Review",
    body: "Check warnings.",
    tone: "review",
  };
}

export default function Home() {
  const [application, setApplication] = useState<ApplicationData>(demoApplication);
  const [labels, setLabels] = useState<PendingLabel[]>([{ fileName: "demo-label.txt", text: demoText }]);
  const [labelText, setLabelText] = useState(demoText);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeLabel = labels[0];
  const activeResult = results[0];
  const resultCopy = decisionCopy(activeResult);
  const nextSteps = activeResult?.nextSteps?.length ? activeResult.nextSteps : activeResult?.workflow?.nextSteps ?? [];
  const blockingIssues = useMemo(
    () => activeResult?.checks.filter((check) => check.status === "fail" || check.status === "warning") ?? [],
    [activeResult],
  );

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;

    const next = await Promise.all(
      [...files].map(
        (file) =>
          new Promise<PendingLabel>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                fileName: file.name,
                mimeType: file.type,
                dataUrl: String(reader.result),
              });
            };
            reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
            reader.readAsDataURL(file);
          }),
      ),
    );

    setLabels(next);
    setResults([]);
  }

  function loadDemo() {
    setApplication(demoApplication);
    setLabelText(demoText);
    setLabels([{ fileName: "demo-label.txt", text: demoText }]);
    setResults([]);
    setError(null);
  }

  async function loadFixture(fixture: FixtureCase) {
    setError(null);
    setResults([]);
    setApplication(fixture.application);
    setLabelText(fixture.labelText ?? "");

    try {
      const response = await fetch(fixture.publicImagePath);
      if (!response.ok) throw new Error(`Could not load ${fixture.id} image`);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error(`Could not read ${fixture.id} image`));
        reader.readAsDataURL(blob);
      });
      setLabels([{ fileName: `${fixture.id}.png`, mimeType: blob.type || "image/png", dataUrl, text: fixture.labelText }]);
    } catch (err) {
      setLabels([{ fileName: `${fixture.id}.png`, text: fixture.labelText }]);
      setError(err instanceof Error ? err.message : "Fixture image load failed; text fallback is loaded.");
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsVerifying(true);
    setError(null);
    setResults([]);

    const payloadLabels = buildVerificationLabels(labels, labelText);

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application, labels: payloadLabels }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Verification failed");
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <main className="app-shell">
      <form onSubmit={verify} className="verifier-screen">
        <section className="hero-panel" aria-label="Label photo and verification status">
          <div className="topbar">
            <div>
              <p className="eyebrow">TTB COLA Label Verifier</p>
              <h1>LabelCheck</h1>
            </div>
            <div className="workflow" aria-label="Review flow">
              <span>Photo</span>
              <span>Facts</span>
              <span>Compare</span>
            </div>
          </div>

          <div className="label-stage">
            <div className="label-preview" aria-label="Full label preview">
              {activeLabel?.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeLabel.dataUrl} alt={`Uploaded label preview for ${activeLabel.fileName}`} />
              ) : (
                <div className="mock-label">
                  <span className="seal">COLA</span>
                  <strong>OLD TOM DISTILLERY</strong>
                  <p>Kentucky Straight Bourbon Whiskey</p>
                  <p>45% Alc./Vol.  90 Proof</p>
                  <p>750 mL</p>
                  <small>Bottled by Old Tom Distillery, Frankfort, KY</small>
                  <small className="warning-line">Government warning present</small>
                </div>
              )}
            </div>

            <div className="photo-dock">
              <label className="tool-button">
                <UploadCloud aria-hidden />
                <span>Upload</span>
                <input className="file-input" type="file" accept="image/*" multiple onChange={(event) => onFiles(event.target.files)} />
              </label>
              <label className="tool-button">
                <Camera aria-hidden />
                <span>Camera</span>
                <input
                  className="file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => onFiles(event.target.files)}
                />
              </label>
              <button type="button" className="ghost-button" onClick={loadDemo}>
                Demo
              </button>
              <span className="photo-meta">
                <FileImage aria-hidden />
                {activeLabel?.fileName ?? "No label"}
              </span>
            </div>
          </div>
        </section>

        <aside className="control-panel" aria-label="Application facts and verification controls">
          <section className="status-card">
            <div className={`decision ${resultCopy.tone}`}>
              {decisionIcon(activeResult?.decision)}
              <div>
                <h2>{resultCopy.title}</h2>
                <p>{resultCopy.body}</p>
              </div>
            </div>
            {activeResult ? (
              <div className="score-row">
                <span>{activeResult.decision.replace("_", " ")}</span>
                <strong>{activeResult.score}%</strong>
              </div>
            ) : null}
          </section>

          <section className="facts-card">
            <div className="section-title">
              <ClipboardList aria-hidden />
              <div>
                <h2>Application facts</h2>
                <p>Distilled spirits MVP.</p>
              </div>
            </div>

            <div className="fact-grid">
              {fields.map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    value={application[key] ?? ""}
                    onChange={(event) => setApplication((current) => ({ ...current, [key]: event.target.value }))}
                  />
                </label>
              ))}
              <label>
                <span>Beverage</span>
                <select
                  value={application.beverageKind}
                  onChange={(event) => setApplication((current) => ({ ...current, beverageKind: event.target.value as ApplicationData["beverageKind"] }))}
                >
                  <option value="spirits">Distilled spirits</option>
                  <option value="wine">Wine</option>
                  <option value="beer">Beer</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>

            <details className="fixture-drawer">
              <summary>Fixtures and text fallback</summary>
              <div className="fixture-strip" aria-label="Generated fixture cases">
                {fixtureCases.map((fixture) => (
                  <button key={fixture.id} type="button" onClick={() => void loadFixture(fixture)}>
                    <span>{fixtureCategoryLabel[fixture.category]}</span>
                    {fixture.title}
                  </button>
                ))}
              </div>
              <textarea value={labelText} onChange={(event) => setLabelText(event.target.value)} aria-label="Label text fallback" />
            </details>

            <button type="submit" className="run-button" disabled={isVerifying}>
              {isVerifying ? <Loader2 aria-hidden className="spin" /> : <Scale aria-hidden />}
              <span>{isVerifying ? "Checking" : "Verify label"}</span>
            </button>
            {error ? <p className="error-message">{error}</p> : null}
          </section>

          <section className="guidance-panel" aria-label="Issues and next steps">
            <div className="section-title">
              <AlertTriangle aria-hidden />
              <div>
                <h2>Review</h2>
                <p>{activeResult ? `${activeResult.checks.length} checks` : "Run verification."}</p>
              </div>
            </div>

            {activeResult ? (
              <div className="review-stack">
                <article className="evidence-card">
                  <h3>Evidence</h3>
                  <dl>
                    <div>
                      <dt>Brand</dt>
                      <dd>{activeResult.extraction.brandName || "Not found"}</dd>
                    </div>
                    <div>
                      <dt>Class</dt>
                      <dd>{activeResult.extraction.classType || "Not found"}</dd>
                    </div>
                    <div>
                      <dt>Alcohol</dt>
                      <dd>{activeResult.extraction.alcoholContent || "Not found"}</dd>
                    </div>
                    <div>
                      <dt>Contents</dt>
                      <dd>{activeResult.extraction.netContents || "Not found"}</dd>
                    </div>
                  </dl>
                  <p className="confidence">{Math.round(activeResult.extraction.confidence * 100)}% confidence</p>
                </article>

                <article className="issue-card">
                  <h3>{blockingIssues.length ? "Issues" : "No issues"}</h3>
                  <div className="checks">
                    {activeResult.checks.map((check) => (
                      <div className={statusClass(check.status)} key={check.id}>
                        <div>
                          <strong>{check.label}</strong>
                          <span>{check.status.replace("_", " ")}</span>
                        </div>
                        <p>{check.rationale}</p>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="next-card">
                  <h3>Next</h3>
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
                </article>
              </div>
            ) : (
              <div className="empty-review">
                <Bot aria-hidden />
                <p>Photo plus facts becomes evidence, issues, next action.</p>
              </div>
            )}
          </section>
        </aside>
      </form>
    </main>
  );
}
