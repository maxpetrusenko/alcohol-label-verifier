"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import {
  batchLimitError,
  buildVerificationLabels,
  chunkVerificationLabels,
  isImageLikeUpload,
  type PendingLabel,
} from "@/lib/labelPayload";
import { batchSummary, decisionCounts, issueTitle, needsReviewerAttention } from "@/lib/reviewPresentation";
import { coreReviewRows, supplementalReviewRows } from "@/lib/reviewRows";
import { GOVERNMENT_WARNING_TEXT } from "@/lib/rules";
import type { ApplicationData, VerificationResult } from "@/lib/types";

const demoText = `OLD TOM DISTILLERY
Kentucky Straight Bourbon Whiskey
45% Alc./Vol. (90 Proof)
750 mL
Bottled by Old Tom Distillery, Frankfort, KY
${GOVERNMENT_WARNING_TEXT}`;

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

const MAX_VISION_IMAGE_EDGE = 768;
const VISION_IMAGE_QUALITY = 0.72;

const fields = [
  ["brandName", "Brand"],
  ["classType", "Class or type"],
  ["alcoholContent", "Alcohol"],
  ["netContents", "Contents"],
  ["bottlerAddress", "Bottler / producer / importer address"],
  ["countryOfOrigin", "Import country"],
] as const;

type FactFieldKey = (typeof fields)[number][0];

const fieldPlaceholders: Partial<Record<FactFieldKey, string>> = {
  bottlerAddress: "Example: Frostweaver Spirits, Denver, CO",
  countryOfOrigin: "Required when imported",
};

const fieldHelp: Partial<Record<FactFieldKey, string>> = {
  bottlerAddress: "Required label element: name and address statement shown on the label.",
  countryOfOrigin: "Separate from address; only required for imported products.",
};

const fieldOptions: Partial<Record<FactFieldKey, string[]>> = {
  classType: [
    "Vodka",
    "Gin",
    "Rum",
    "Brandy",
    "Cognac",
    "Liqueur",
    "Bourbon Whiskey",
    "Straight Bourbon Whiskey",
    "Kentucky Straight Bourbon Whiskey",
    "Rye Whiskey",
    "Scotch Whisky",
    "Irish Whiskey",
    "Tennessee Whiskey",
    "Blanco Tequila",
    "Mezcal",
    "Red Wine",
    "White Wine",
    "Beer",
    "Lager",
    "Ale",
    "Hard Cider",
  ],
  alcoholContent: ["40% Alc./Vol.", "45% Alc./Vol. (90 Proof)", "35% Alc./Vol.", "13.5% Alc./Vol.", "12% Alc./Vol.", "5% Alc./Vol."],
  netContents: ["50 mL", "100 mL", "200 mL", "375 mL", "700 mL", "750 mL", "1 L", "1.75 L", "12 fl oz", "16 fl oz"],
  countryOfOrigin: ["United States", "Mexico", "France", "Italy", "Spain", "Canada", "Ireland", "Scotland", "United Kingdom", "Japan"],
};

function optionListId(key: FactFieldKey) {
  return fieldOptions[key] ? `options-${key}` : undefined;
}

function decisionIcon(decision?: VerificationResult["decision"]) {
  if (decision === "approved") return <BadgeCheck aria-hidden className="decision-icon pass" />;
  if (decision === "rejected") return <XCircle aria-hidden className="decision-icon fail" />;
  return <AlertTriangle aria-hidden className="decision-icon review" />;
}

function statusLabel(status: string) {
  if (status === "pass") return "PASS";
  if (status === "fail") return "FAIL";
  if (status === "needs_review") return "REVIEW";
  if (status === "warning") return "WARN";
  if (status === "not_applicable") return "N/A";
  return status.replace("_", " ").toUpperCase();
}

function rowStatusLabel(row: { status: string; severity: string }) {
  return statusLabel(row.status);
}

type ReviewerDisposition = "approved" | "rejected" | "sme_review";

type Adjudication = {
  decision: ReviewerDisposition;
  note: string;
};

type VisionHealth = {
  configured: boolean;
  mode: string;
  provider: string;
  model: string;
  endpoint?: string;
};

function dispositionLabel(decision: ReviewerDisposition) {
  if (decision === "sme_review") return "SME review";
  return decision === "approved" ? "Approved" : "Rejected";
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

type DroppedEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (success: (file: File) => void, failure?: (error: DOMException) => void) => void;
  createReader?: () => {
    readEntries: (success: (entries: DroppedEntry[]) => void, failure?: (error: DOMException) => void) => void;
  };
};

type DroppedDataTransferItem = DataTransferItem & {
  webkitGetAsEntry?: () => DroppedEntry | null;
};

function fileFromEntry(entry: DroppedEntry) {
  return new Promise<File | null>((resolve) => {
    if (!entry.file) {
      resolve(null);
      return;
    }

    entry.file((file) => resolve(isImageLikeUpload(file) ? file : null), () => resolve(null));
  });
}

async function filesFromEntry(entry: DroppedEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = await fileFromEntry(entry);
    return file ? [file] : [];
  }

  if (!entry.isDirectory || !entry.createReader) return [];

  const reader = entry.createReader();
  const files: File[] = [];

  async function readAllEntries(): Promise<void> {
    const entries = await new Promise<DroppedEntry[]>((resolve) => {
      reader.readEntries(resolve, () => resolve([]));
    });
    if (!entries.length) return;
    const nested = await Promise.all(entries.map(filesFromEntry));
    files.push(...nested.flat());
    await readAllEntries();
  }

  await readAllEntries();
  return files;
}

async function imageFilesFromDrop(dataTransfer: DataTransfer) {
  const entries: DroppedEntry[] = [];
  for (const item of [...dataTransfer.items]) {
    const entry = (item as DroppedDataTransferItem).webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  if (entries.length) {
    const files = await Promise.all(entries.map(filesFromEntry));
    return files.flat();
  }

  return [...dataTransfer.files].filter(isImageLikeUpload);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function drawScaledImage(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, MAX_VISION_IMAGE_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function optimizedImageDataUrl(file: File) {
  const original = await readFileAsDataUrl(file);
  if (file.type === "image/gif") return { dataUrl: original, mimeType: file.type };

  return new Promise<{ dataUrl: string; mimeType: string }>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = drawScaledImage(image, image.naturalWidth, image.naturalHeight);
      if (!canvas) {
        resolve({ dataUrl: original, mimeType: file.type });
        return;
      }
      resolve({ dataUrl: canvas.toDataURL("image/jpeg", VISION_IMAGE_QUALITY), mimeType: "image/jpeg" });
    };
    image.onerror = () => resolve({ dataUrl: original, mimeType: file.type });
    image.src = original;
  });
}

export default function Home() {
  const [application, setApplication] = useState<ApplicationData>(demoApplication);
  const [labels, setLabels] = useState<PendingLabel[]>([{ labelId: "demo-label", fileName: "demo-label.txt", text: demoText }]);
  const [labelText, setLabelText] = useState(demoText);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [verifyMode, setVerifyMode] = useState<string | null>(null);
  const [visionHealth, setVisionHealth] = useState<VisionHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [adjudications, setAdjudications] = useState<Record<string, Adjudication>>({});
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const activeLabel = labels[activeIndex] ?? labels[0];
  const activeResult = results[activeIndex] ?? results[0];
  const activeAdjudicationKey = activeResult?.labelId ?? activeLabel?.labelId ?? activeResult?.fileName ?? activeLabel?.fileName ?? "single-label";
  const activeAdjudication = activeResult ? adjudications[activeAdjudicationKey] : undefined;
  const resultCopy = decisionCopy(activeResult);
  const batchCount = Math.max(labels.length, results.length);
  const hasBatch = batchCount > 1;
  const counts = decisionCounts(results);
  const nextSteps = activeResult?.nextSteps?.length ? activeResult.nextSteps : activeResult?.workflow?.nextSteps ?? [];
  const attentionChecks = useMemo(
    () => activeResult?.checks.filter((check) => needsReviewerAttention(check.status)) ?? [],
    [activeResult],
  );
  const activeReviewRows = useMemo(() => (activeResult ? coreReviewRows(activeResult) : []), [activeResult]);
  const scoredReviewRows = useMemo(() => activeReviewRows.filter((row) => row.severity !== "info"), [activeReviewRows]);
  const activeSupplementalRows = useMemo(() => (activeResult ? supplementalReviewRows(activeResult) : []), [activeResult]);

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Health check failed");
        if (!cancelled) {
          setVisionHealth(data.vision ?? null);
          setHealthError(null);
        }
      } catch {
        if (!cancelled) {
          setVisionHealth(null);
          setHealthError("Provider status unavailable. Verification can still run, but network or server health needs review.");
        }
      }
    }

    void loadHealth();
    return () => {
      cancelled = true;
    };
  }, []);

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
      selectedFiles.map(async (file, index) => {
        const image = await optimizedImageDataUrl(file);
        return {
          labelId: makeLabelId(file.name, index),
          fileName: file.name,
          mimeType: image.mimeType,
          dataUrl: image.dataUrl,
        };
      }),
    );

    setLabels(next);
    setActiveIndex(0);
    setLabelText("");
    setResults([]);
    setAdjudications({});
    setVerifyMode(null);
    setVerifiedCount(0);
    setError(null);
  }

  function captureCameraFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("Camera is still starting. Try again in a moment.");
      return;
    }

    const canvas = drawScaledImage(video, video.videoWidth, video.videoHeight);
    if (!canvas) {
      setCameraError("Could not capture a camera frame. Use Upload instead.");
      return;
    }

    const fileName = `camera-capture-${new Date().toISOString().replace(/[:.]/gu, "-")}.jpg`;
    setLabels([
      {
        labelId: makeLabelId(fileName, 0),
        fileName,
        mimeType: "image/jpeg",
        dataUrl: canvas.toDataURL("image/jpeg", VISION_IMAGE_QUALITY),
      },
    ]);
    setActiveIndex(0);
    setLabelText("");
    setResults([]);
    setAdjudications({});
    setVerifyMode(null);
    setVerifiedCount(0);
    setError(null);
    setIsCameraOpen(false);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files ? [...event.currentTarget.files] : [];
    event.currentTarget.value = "";
    void onFiles(files);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDropActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDropActive(false);
  }

  async function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDropActive(false);
    const files = await imageFilesFromDrop(event.dataTransfer);
    if (!files.length) {
      setError("Drop image files or a folder containing images.");
      return;
    }
    await onFiles(files);
  }

  function loadDemo() {
    setApplication(demoApplication);
    setLabelText(demoText);
    setLabels([{ labelId: "demo-label", fileName: "demo-label.txt", text: demoText }]);
    setResults([]);
    setAdjudications({});
    setVerifyMode(null);
    setVerifiedCount(0);
    setActiveIndex(0);
    setError(null);
  }

  function clearLabelSelection() {
    setLabels([]);
    setLabelText("");
    setResults([]);
    setAdjudications({});
    setVerifyMode(null);
    setVerifiedCount(0);
    setActiveIndex(0);
    setError(null);
  }

  async function loadFixture(fixture: FixtureCase) {
    setError(null);
    setResults([]);
    setAdjudications({});
    setVerifyMode(null);
    setVerifiedCount(0);
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
    setAdjudications({});
    setVerifyMode(null);
    setVerifiedCount(0);

    const payloadLabels = buildVerificationLabels(labels, labelText);

    try {
      let nextResults: VerificationResult[] = [];
      for (const chunk of chunkVerificationLabels(payloadLabels)) {
        const response = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ application, labels: chunk }),
        });
        const data = await response.json();
        if (!response.ok) {
          const message = typeof data.error === "string" ? data.error : data.error?.message;
          throw new Error(message || `Verification failed after ${nextResults.length} labels`);
        }
        nextResults = [...nextResults, ...data.results];
        setResults(nextResults);
        setVerifiedCount(nextResults.length);
        setVerifyMode(typeof data.meta?.mode === "string" ? data.meta.mode : null);
      }
      setActiveIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsVerifying(false);
    }
  }

  function setReviewerDecision(decision: ReviewerDisposition) {
    setAdjudications((current) => ({
      ...current,
      [activeAdjudicationKey]: {
        decision,
        note: current[activeAdjudicationKey]?.note ?? "",
      },
    }));
  }

  function setReviewerNote(note: string) {
    setAdjudications((current) => ({
      ...current,
      [activeAdjudicationKey]: {
        decision: current[activeAdjudicationKey]?.decision ?? "sme_review",
        note,
      },
    }));
  }

  function renderFactsEditor() {
    return (
      <>
        <div className="fact-grid">
          {fields.map(([key, label]) => (
            <label
              key={key}
              className={["fact-field", key === "bottlerAddress" ? "wide-field" : "", fieldHelp[key] ? "has-help" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <span>{label}</span>
              <input
                value={application[key] ?? ""}
                placeholder={fieldPlaceholders[key]}
                list={optionListId(key)}
                onChange={(event) => setApplication((current) => ({ ...current, [key]: event.target.value }))}
              />
              {fieldHelp[key] ? <small className="field-help">{fieldHelp[key]}</small> : null}
            </label>
          ))}
          {Object.entries(fieldOptions).map(([key, options]) => (
            <datalist key={key} id={`options-${key}`}>
              {options.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          ))}
          <label>
            <span>Beverage</span>
            <select
              value={application.beverageKind}
              onChange={(event) => setApplication((current) => ({ ...current, beverageKind: event.target.value as ApplicationData["beverageKind"] }))}
            >
              <option value="spirits">Distilled spirits</option>
              <option value="wine">Wine</option>
              <option value="beer">Beer / malt beverage</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="checkbox-field">
            <span>Import status</span>
            <div className="checkbox-control">
              <input
                type="checkbox"
                checked={Boolean(application.imported)}
                onChange={(event) => setApplication((current) => ({ ...current, imported: event.target.checked }))}
              />
              <strong>Imported product</strong>
            </div>
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
          <p className="mode-message">Vision extraction is not configured here. Uploaded photos need OCR text fallback or a provider API key.</p>
        ) : null}

        <button type="submit" className="run-button" disabled={isVerifying}>
          {isVerifying ? <Loader2 aria-hidden className="spin" /> : <Scale aria-hidden />}
          <span>
            {isVerifying
              ? labels.length > 1
                ? `Checking ${verifiedCount}/${labels.length}`
                : "Checking"
              : labels.length > 1
                ? `Verify ${labels.length} labels`
                : activeResult
                  ? "Re-verify label"
                  : "Verify label"}
          </span>
        </button>
        {error ? <p className="error-message">{error}</p> : null}
      </>
    );
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
          </div>

          <div
            className={`label-stage${isDropActive ? " drop-active" : ""}`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="label-preview" aria-label="Full label preview">
              {activeLabel?.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeLabel.dataUrl} alt={`Uploaded label preview for ${activeLabel.fileName}`} />
              ) : activeLabel ? (
                <div className="mock-label">
                  <span className="seal">COLA</span>
                  <strong>OLD TOM DISTILLERY</strong>
                  <p>Kentucky Straight Bourbon Whiskey</p>
                  <p>45% Alc./Vol.  90 Proof</p>
                  <p>750 mL</p>
                  <small>Bottled by Old Tom Distillery, Frankfort, KY</small>
                  <small className="warning-line">{GOVERNMENT_WARNING_TEXT}</small>
                </div>
              ) : (
                <div className="empty-label-state">
                  <UploadCloud aria-hidden />
                  <strong>Upload label photo</strong>
                  <span>Use Upload, Camera, or drag images here.</span>
                </div>
              )}
            </div>

            <div className="drop-strip" aria-live="polite">
              <UploadCloud aria-hidden />
              <strong>{isDropActive ? "Release to load this batch" : activeLabel?.dataUrl ? activeLabel.fileName : "Drop images or a folder here"}</strong>
              <span>{activeLabel?.dataUrl ? `${activeIndex + 1}/${batchCount} selected. Drop another batch to replace it.` : "Up to 300 images. Large batches verify in 25-label chunks."}</span>
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
                <input
                  className="file-input"
                  type="file"
                  accept="image/*"
                  multiple
                  title="Upload one or more label photos"
                  onChange={handleFileInput}
                />
              </label>
              <button type="button" className="tool-button" onClick={() => setIsCameraOpen((open) => !open)}>
                <Camera aria-hidden />
                <span>{isCameraOpen ? "Close camera" : "Camera"}</span>
              </button>
              <button type="button" className="ghost-button" onClick={loadDemo}>
                Demo
              </button>
              {activeLabel ? (
                <button type="button" className="ghost-button secondary" onClick={clearLabelSelection}>
                  Clear
                </button>
              ) : null}
              <span className="photo-meta">
                <FileImage aria-hidden />
                {activeLabel ? `${activeIndex + 1}/${batchCount} ${activeLabel.fileName}` : "No label selected"}
              </span>
            </div>
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

        <aside className={`control-panel${activeResult ? " has-result" : ""}`} aria-label="Application facts and verification controls">
          <section className="status-card">
            <div className={`decision ${resultCopy.tone}`}>
              {decisionIcon(activeResult?.decision)}
              <div>
                <h2>{resultCopy.title}</h2>
                <p>{resultCopy.body}</p>
              </div>
            </div>
            {activeResult ? (
              <div className={`score-row decision-${activeResult.decision}`}>
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
            <div className={`provider-chip ${visionHealth?.configured ? "provider-ready" : "provider-demo"}`}>
              <span>{visionHealth?.configured ? "Vision ready" : "Text-only mode"}</span>
              <strong>
                {visionHealth
                  ? visionHealth.configured
                    ? `${visionHealth.provider} · ${visionHealth.model}`
                    : "Paste OCR/text fallback"
                  : healthError
                    ? "Status unavailable"
                    : "Checking provider"}
              </strong>
              {verifyMode ? <small>Last run: {verifyMode}</small> : healthError ? <small>{healthError}</small> : null}
            </div>
          </section>

          <section className={`facts-card${activeResult ? " facts-card-edit" : ""}`}>
            {activeResult ? (
              <details className="edit-facts-drawer">
                <summary>
                  <div className="section-title">
                    <ClipboardList aria-hidden />
                    <div>
                      <h2>Edit application facts</h2>
                      <p>Open only when the source record needs correction, then re-run verification.</p>
                    </div>
                  </div>
                </summary>
                {renderFactsEditor()}
              </details>
            ) : (
              <>
                <div className="section-title">
                  <ClipboardList aria-hidden />
                  <div>
                    <h2>Application facts</h2>
                    <p>Typed or imported source record. The photo must independently show the label.</p>
                  </div>
                </div>
                {renderFactsEditor()}
              </>
            )}
          </section>

          <section className="guidance-panel" aria-label="Issues and next steps">
            <div className={`section-title review-title decision-${activeResult?.decision ?? "idle"}`}>
              {activeResult ? decisionIcon(activeResult.decision) : <AlertTriangle aria-hidden />}
              <div>
                <h2>{activeResult ? "Field comparison" : "Review"}</h2>
                <p>{activeResult ? `${issueTitle(attentionChecks.length)} · ${activeResult.elapsedMs} ms` : "Run verification."}</p>
              </div>
            </div>

            {activeResult ? (
              <div className="comparison-stack">
                <div className="comparison-meta">
                  <span>{Math.round(activeResult.extraction.confidence * 100)}% extraction confidence</span>
                  <span>{scoredReviewRows.filter((row) => row.status === "pass").length}/{scoredReviewRows.length} requirement rows pass</span>
                </div>

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
                      <p>{row.observed || "Not found"}</p>
                      <span>{rowStatusLabel(row)}</span>
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
                          <p>{row.observed || "Not found"}</p>
                          <span>{rowStatusLabel(row)}</span>
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

                <article className="next-card">
                  <h3>{activeResult.decision === "approved" ? "Ready" : "Next action"}</h3>
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

                <article className="adjudication-card" aria-label="Reviewer final decision">
                  <div>
                    <h3>Reviewer decision</h3>
                    <p>Tool recommendation: {activeResult.decision.replace("_", " ")}. Final disposition is yours.</p>
                  </div>
                  <div className="decision-actions">
                    {(["approved", "rejected", "sme_review"] as const).map((decision) => (
                      <button
                        key={decision}
                        type="button"
                        className={`decision-action ${activeAdjudication?.decision === decision ? "selected" : ""} decision-action-${decision}`}
                        onClick={() => setReviewerDecision(decision)}
                      >
                        {dispositionLabel(decision)}
                      </button>
                    ))}
                  </div>
                  <textarea
                    aria-label="Reviewer note"
                    placeholder="Optional note or reason for the final disposition."
                    value={activeAdjudication?.note ?? ""}
                    onChange={(event) => setReviewerNote(event.target.value)}
                  />
                  <p className="adjudication-state">
                    {activeAdjudication
                      ? `Recorded locally: ${dispositionLabel(activeAdjudication.decision)}${activeAdjudication.note ? " with note" : ""}.`
                      : "No reviewer decision recorded yet."}
                  </p>
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
