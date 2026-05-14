"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { batchLimitError, buildVerificationLabels, type PendingLabel } from "@/lib/labelPayload";
import { batchSummary, decisionCounts, issueTitle, needsReviewerAttention } from "@/lib/reviewPresentation";
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
    title: "Needs review",
    body: "Missing or uncertain evidence.",
    tone: "review",
  };
}

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export default function Home() {
  const [application, setApplication] = useState<ApplicationData>(demoApplication);
  const [labels, setLabels] = useState<PendingLabel[]>([{ labelId: "demo-label", fileName: "demo-label.txt", text: demoText }]);
  const [labelText, setLabelText] = useState(demoText);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [verifyMode, setVerifyMode] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const activeLabel = labels[activeIndex] ?? labels[0];
  const activeResult = results[activeIndex] ?? results[0];
  const resultCopy = decisionCopy(activeResult);
  const batchCount = Math.max(labels.length, results.length);
  const hasBatch = batchCount > 1;
  const counts = decisionCounts(results);
  const nextSteps = activeResult?.nextSteps?.length ? activeResult.nextSteps : activeResult?.workflow?.nextSteps ?? [];
  const attentionChecks = useMemo(
    () => activeResult?.checks.filter((check) => needsReviewerAttention(check.status)) ?? [],
    [activeResult],
  );

  useEffect(() => {
    if (!isCameraOpen) {
      stopMediaStream(cameraStreamRef.current);
      cameraStreamRef.current = null;
      return;
    }

    let cancelled = false;

    async function startCamera() {
      setCameraError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera capture needs a browser with camera access on localhost or HTTPS. Use Upload instead.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });

        if (cancelled) {
          stopMediaStream(stream);
          return;
        }

        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraError("Camera blocked or unavailable. Use Upload, or allow camera permission in the browser.");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      stopMediaStream(cameraStreamRef.current);
      cameraStreamRef.current = null;
    };
  }, [isCameraOpen]);

  function makeLabelId(fileName: string, index: number) {
    return `${Date.now()}-${index}-${fileName.replace(/[^a-z0-9._-]+/gi, "-")}`;
  }

  function batchItemClass(index: number, result?: VerificationResult) {
    return ["batch-item", index === activeIndex ? "active" : "", result ? `decision-${result.decision}` : ""].filter(Boolean).join(" ");
  }

  async function onFiles(files: FileList | File[] | null) {
    const selectedFiles = files ? [...files] : [];
    if (!selectedFiles.length) return;
    const limitError = batchLimitError(selectedFiles.length);
    if (limitError) {
      setError(limitError);
      return;
    }

    const next = await Promise.all(
      selectedFiles.map(
        (file, index) =>
          new Promise<PendingLabel>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                labelId: makeLabelId(file.name, index),
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
    setActiveIndex(0);
    setLabelText("");
    setResults([]);
    setVerifyMode(null);
    setError(null);
  }

  function captureCameraFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("Camera is still starting. Try again in a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Could not capture a camera frame. Use Upload instead.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const fileName = `camera-capture-${new Date().toISOString().replace(/[:.]/gu, "-")}.jpg`;
    setLabels([
      {
        labelId: makeLabelId(fileName, 0),
        fileName,
        mimeType: "image/jpeg",
        dataUrl: canvas.toDataURL("image/jpeg", 0.92),
      },
    ]);
    setActiveIndex(0);
    setLabelText("");
    setResults([]);
    setVerifyMode(null);
    setError(null);
    setIsCameraOpen(false);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files ? [...event.currentTarget.files] : [];
    event.currentTarget.value = "";
    void onFiles(files);
  }

  function loadDemo() {
    setApplication(demoApplication);
    setLabelText(demoText);
    setLabels([{ labelId: "demo-label", fileName: "demo-label.txt", text: demoText }]);
    setResults([]);
    setVerifyMode(null);
    setActiveIndex(0);
    setError(null);
  }

  async function loadFixture(fixture: FixtureCase) {
    setError(null);
    setResults([]);
    setVerifyMode(null);
    setActiveIndex(0);
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
      setLabels([{ labelId: fixture.id, fileName: `${fixture.id}.png`, mimeType: blob.type || "image/png", dataUrl, text: fixture.labelText }]);
    } catch (err) {
      setLabels([{ labelId: fixture.id, fileName: `${fixture.id}.png`, text: fixture.labelText }]);
      setError(err instanceof Error ? err.message : "Fixture image load failed; text fallback is loaded.");
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsVerifying(true);
    setError(null);
    setResults([]);
    setVerifyMode(null);

    const payloadLabels = buildVerificationLabels(labels, labelText);

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application, labels: payloadLabels }),
      });
      const data = await response.json();
      if (!response.ok) {
        const message = typeof data.error === "string" ? data.error : data.error?.message;
        throw new Error(message || "Verification failed");
      }
      setResults(data.results);
      setVerifyMode(typeof data.meta?.mode === "string" ? data.meta.mode : null);
      setActiveIndex(0);
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

            {hasBatch ? (
              <div className="batch-rail" aria-label="Batch labels">
                {labels.map((label, index) => {
                  const result = results[index];
                  return (
                    <button
                      key={label.labelId ?? `${label.fileName}-${index}`}
                      type="button"
                      className={batchItemClass(index, result)}
                      onClick={() => setActiveIndex(index)}
                    >
                      <span>{index + 1}</span>
                      <strong>{label.fileName}</strong>
                      <em>{result ? result.decision.replace("_", " ") : isVerifying ? "checking" : "queued"}</em>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="photo-dock">
              <label className="tool-button">
                <UploadCloud aria-hidden />
                <span>Upload</span>
                <input className="file-input" type="file" accept="image/*" multiple onChange={handleFileInput} />
              </label>
              <button type="button" className="tool-button" onClick={() => setIsCameraOpen((open) => !open)}>
                <Camera aria-hidden />
                <span>{isCameraOpen ? "Close camera" : "Camera"}</span>
              </button>
              <button type="button" className="ghost-button" onClick={loadDemo}>
                Demo
              </button>
              <span className="photo-meta">
                <FileImage aria-hidden />
                {activeLabel ? `${activeIndex + 1}/${batchCount} ${activeLabel.fileName}` : "No label"}
              </span>
            </div>
            <p className="upload-hint">Upload accepts up to 25 images at once. Camera captures one label at a time.</p>
            {isCameraOpen ? (
              <div className="camera-panel" aria-label="Camera capture">
                <video ref={videoRef} playsInline muted />
                <div>
                  <button type="button" className="ghost-button" onClick={captureCameraFrame}>
                    Capture label
                  </button>
                  {cameraError ? <p>{cameraError}</p> : <p>Allow camera permission, center the label, then capture.</p>}
                </div>
              </div>
            ) : null}
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
            {results.length > 1 ? (
              <div className="batch-summary">
                <strong>{results.length}/{labels.length}</strong>
                <span>{batchSummary(results)}</span>
                <small>{counts.rejected ? "Start with blocked labels." : counts.needs_review ? "Review uncertain labels." : "Batch ready."}</small>
              </div>
            ) : null}
          </section>

          <section className="facts-card">
            <div className="section-title">
              <ClipboardList aria-hidden />
              <div>
                <h2>Application facts</h2>
                <p>Typed or imported source record. The photo must independently show the label.</p>
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
            {verifyMode === "text-only-demo" ? (
              <p className="mode-message">Vision extraction is not configured here. Uploaded photos need OCR text fallback or an OpenAI API key.</p>
            ) : null}

            <button type="submit" className="run-button" disabled={isVerifying}>
              {isVerifying ? <Loader2 aria-hidden className="spin" /> : <Scale aria-hidden />}
              <span>{isVerifying ? "Checking" : labels.length > 1 ? `Verify ${labels.length} labels` : "Verify label"}</span>
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
                  <h3>{issueTitle(attentionChecks.length)}</h3>
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
