"use client";

import { ChangeEvent, DragEvent, FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileImage,
  Loader2,
  Scale,
  UploadCloud,
  XCircle,
} from "lucide-react";
import {
  batchLimitError,
  chunkVerificationLabels,
  isImageLikeUpload,
  type PendingLabel,
} from "@/lib/labelPayload";
import {
  applicationFromImportJson,
  applicationsFromCsvText,
  applicationsFromImportJson,
  isApplicationImportUpload,
  isCsvLikeUpload,
  type ImportedApplication,
} from "@/lib/applicationImport";
import { issueTitle, needsReviewerAttention } from "@/lib/reviewPresentation";
import { coreReviewRows, supplementalReviewRows } from "@/lib/reviewRows";
import type { ApplicationData, VerificationResult } from "@/lib/types";

const defaultApplication: ApplicationData = {
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
  bottlerAddress: "",
  countryOfOrigin: "United States",
  beverageKind: "spirits",
};

const MAX_VISION_IMAGE_EDGE = 768;
const VISION_IMAGE_QUALITY = 0.72;

const fields = [
  ["brandName", "Brand"],
  ["classType", "Class or type"],
  ["alcoholContent", "Alcohol"],
  ["netContents", "Contents"],
  ["bottlerAddress", "Bottler / producer / importer address"],
  ["countryOfOrigin", "Country"],
] as const;

type FactFieldKey = (typeof fields)[number][0];

const fieldPlaceholders: Partial<Record<FactFieldKey, string>> = {
  bottlerAddress: "Example: Frostweaver Spirits, Denver, CO",
};

const selectFieldKeys = new Set<FactFieldKey>(["alcoholContent", "netContents", "countryOfOrigin"]);

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
  alcoholContent: ["40% Alc./Vol.", "43% Alc./Vol.", "45% Alc./Vol. (90 Proof)", "35% Alc./Vol.", "13.5% Alc./Vol.", "12% Alc./Vol.", "5% Alc./Vol."],
  netContents: ["50 mL", "100 mL", "200 mL", "375 mL", "700 mL", "750 mL", "1 L", "1.75 L", "12 fl oz", "16 fl oz"],
  countryOfOrigin: ["United States", "Mexico", "France", "Italy", "Spain", "Canada", "Ireland", "Scotland", "United Kingdom", "Japan"],
};

const demoFixtures = {
  pass: "01-pass-01",
  fail: "06-warning-sneaky-01",
} as const;

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

function diffToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function renderLabelEvidence(row: { id: string; expected: string; observed: string; status: string }) {
  const observed = row.observed || "Not found";
  if (row.id !== "government-warning" || row.status === "pass" || !row.expected || !row.observed) return observed;

  const expectedWords = row.expected.split(/\s+/).map(diffToken);
  let wordIndex = 0;
  return observed.split(/(\s+)/).map((part, index) => {
    if (/^\s+$/u.test(part)) return <Fragment key={index}>{part}</Fragment>;
    const differs = diffToken(part) !== expectedWords[wordIndex];
    wordIndex += 1;
    return differs ? (
      <mark className="diff-word" key={index}>
        {part}
      </mark>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    );
  });
}

function rowReason(row: { id: string; label: string; expected: string; observed: string; status: string; rationale: string; guidance?: string }) {
  if (row.status === "pass") return "";
  if (row.status === "needs_review" && !row.observed) {
    return `Could not read ${row.label.toLowerCase()} from the label image. Upload a clearer image or inspect that label area manually.`;
  }
  if (row.id === "government-warning" && row.observed) {
    if (!/^GOVERNMENT\s+WARNING\s*:/u.test(row.observed)) {
      return 'Government Health Warning prefix must be exactly "GOVERNMENT WARNING:" in all caps.';
    }
    return "Government Health Warning must match the statutory wording exactly. Correct the highlighted word or punctuation before approval.";
  }
  const mismatchReasons: Record<string, string> = {
    "brand-name": "Brand name on the label does not match the application record.",
    "class-type": row.rationale.includes("fanciful name")
      ? "Application and label both show this text, but it is a fanciful name, not a legal class/type. Add the legal designation, such as Vodka, Rum, Whiskey, or Liqueur."
      : "Class/type on the label does not match the application record.",
    "alcohol-content": "Alcohol content or proof on the label does not match the application record.",
    "net-contents": row.expected === row.observed
      ? "Net contents match the application, but this container size is not authorized for this beverage profile."
      : "Net contents on the label do not match the application record.",
    "bottler-address": "Bottler, producer, or importer statement on the label does not match the application record.",
    "country-origin": "Country of origin on the label is missing or does not match the imported product record.",
    "target-isolation": "This image does not isolate one target product label, so the app may compare the wrong label.",
    "supported-profile": "This source record selected an unsupported beverage profile. Choose distilled spirits, wine, or beer.",
    "alcohol-content-profile": "Alcohol content could not be checked because this beverage profile has conditional ABV rules.",
  };
  if (row.status === "fail" && mismatchReasons[row.id]) return mismatchReasons[row.id];
  if (row.status === "needs_review" && mismatchReasons[row.id]) return mismatchReasons[row.id];
  return row.guidance || row.rationale;
}

type ReviewerDisposition = "approved" | "rejected";

type Adjudication = {
  decision: ReviewerDisposition;
};

function dispositionLabel(decision: ReviewerDisposition) {
  return decision === "approved" ? "Approved" : "Rejected";
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

function isSupportedUpload(file: File) {
  return isImageLikeUpload(file) || isApplicationImportUpload(file);
}

function fileFromEntry(entry: DroppedEntry) {
  return new Promise<File | null>((resolve) => {
    if (!entry.file) {
      resolve(null);
      return;
    }

    entry.file((file) => resolve(isSupportedUpload(file) ? file : null), () => resolve(null));
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

async function filesFromDrop(dataTransfer: DataTransfer) {
  const entries: DroppedEntry[] = [];
  for (const item of [...dataTransfer.items]) {
    const entry = (item as DroppedDataTransferItem).webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  if (entries.length) {
    const files = await Promise.all(entries.map(filesFromEntry));
    return files.flat();
  }

  return [...dataTransfer.files].filter(isSupportedUpload);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsText(file);
  });
}

function basename(fileName: string) {
  return fileName.replace(/\.[^.]+$/u, "");
}

async function applicationsFromImportFile(file: File): Promise<ImportedApplication[]> {
  const text = await readFileAsText(file);
  return isCsvLikeUpload(file) ? applicationsFromCsvText(text, file.name) : applicationsFromImportJson(JSON.parse(text), file.name);
}

async function applicationFromKnownEvalFixture(imageFile: File) {
  const id = basename(imageFile.name);
  if (!/^(?:0[1-6])-[a-z]+(?:-[a-z]+)?-\d{2}$/iu.test(id)) return null;
  const response = await fetch(`/evals/fixtures/generated/${id}.json`, { cache: "no-store" });
  if (!response.ok) return null;
  return applicationFromImportJson(await response.json());
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
  const [application, setApplication] = useState<ApplicationData>(defaultApplication);
  const [importedApplications, setImportedApplications] = useState<ImportedApplication[]>([]);
  const [labels, setLabels] = useState<PendingLabel[]>([]);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [isFactsDropActive, setIsFactsDropActive] = useState(false);
  const [adjudications, setAdjudications] = useState<Record<string, Adjudication>>({});
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const activeLabel = labels[activeIndex] ?? labels[0];
  const activeResult = results[activeIndex] ?? results[0];
  const activeAdjudicationKey = activeResult?.labelId ?? activeLabel?.labelId ?? activeResult?.fileName ?? activeLabel?.fileName ?? "single-label";
  const activeAdjudication = activeResult ? adjudications[activeAdjudicationKey] : undefined;
  const batchCount = Math.max(labels.length, results.length);
  const hasBatch = batchCount > 1;
  const hasApplicationBatch = importedApplications.length > 1;
  const nextSteps = activeResult?.nextSteps?.length ? activeResult.nextSteps : activeResult?.workflow?.nextSteps ?? [];
  const attentionChecks = useMemo(
    () => activeResult?.checks.filter((check) => needsReviewerAttention(check.status)) ?? [],
    [activeResult],
  );
  const activeReviewRows = useMemo(() => (activeResult ? coreReviewRows(activeResult).filter((row) => row.status !== "not_applicable") : []), [activeResult]);
  const scoredReviewRows = useMemo(() => activeReviewRows.filter((row) => row.severity !== "info"), [activeReviewRows]);
  const activeSupplementalRows = useMemo(() => (activeResult ? supplementalReviewRows(activeResult).filter((row) => row.status !== "not_applicable") : []), [activeResult]);

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

  function loadImportedApplications(rows: ImportedApplication[]) {
    setImportedApplications(rows);
    if (rows[0]) setApplication(rows[0].application);
  }

  function normalizedFileKey(fileName?: string) {
    return basename(fileName ?? "").toLowerCase().replace(/[^a-z0-9]+/gu, "");
  }

  function applicationForLabel(label: PendingLabel, index: number): ApplicationData | null {
    if (!hasApplicationBatch) return importedApplications[0]?.application ?? application;
    const labelKey = normalizedFileKey(label.fileName);
    const matched = importedApplications.find((row) => {
      const rowKey = normalizedFileKey(row.fileName);
      return rowKey && (rowKey === labelKey || labelKey.includes(rowKey) || rowKey.includes(labelKey));
    });
    return matched?.application ?? importedApplications[index]?.application ?? null;
  }

  async function importApplicationFiles(files: File[]) {
    if (!files.length) return [];
    const imported = (await Promise.all(files.map(applicationsFromImportFile))).flat();
    if (!imported.length) throw new Error("No application rows found. Use JSON or CSV with brand, class/type, ABV, and net contents columns.");
    loadImportedApplications(imported);
    return imported;
  }

  async function onFiles(files: FileList | File[] | null) {
    const selectedFiles = files ? [...files] : [];
    if (!selectedFiles.length) return;
    const imageFiles = selectedFiles.filter(isImageLikeUpload);
    const importFiles = selectedFiles.filter(isApplicationImportUpload);
    const limitError = batchLimitError(imageFiles.length);
    if (limitError) {
      setError(limitError);
      return;
    }

    try {
      const importedApplication =
        importFiles.length > 0
          ? (await importApplicationFiles(importFiles))[0]?.application
          : imageFiles.length === 1
            ? await applicationFromKnownEvalFixture(imageFiles[0])
            : null;
      if (importedApplication) setApplication(importedApplication);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import application facts.");
      return;
    }

    if (!imageFiles.length) {
      setError(importFiles.length ? null : "Select label image files.");
      return;
    }

    const next = await Promise.all(
      imageFiles.map(async (file, index) => {
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
    setResults([]);
    setAdjudications({});
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
    setResults([]);
    setAdjudications({});
    setVerifiedCount(0);
    setError(null);
    setIsCameraOpen(false);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files ? [...event.currentTarget.files] : [];
    event.currentTarget.value = "";
    void onFiles(files);
  }

  async function handleApplicationImportInput(event: ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files ? [...event.currentTarget.files] : [];
    event.currentTarget.value = "";
    try {
      await importApplicationFiles(files);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import application facts.");
    }
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
    const files = await filesFromDrop(event.dataTransfer);
    if (!files.length) {
      setError("Drop image files, JSON source facts, or a folder containing them.");
      return;
    }
    await onFiles(files);
  }

  function handleFactsDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsFactsDropActive(true);
  }

  function handleFactsDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFactsDropActive(false);
  }

  async function handleFactsDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsFactsDropActive(false);
    const files = [...event.dataTransfer.files].filter(isApplicationImportUpload);
    if (!files.length) {
      setError("Drop a JSON or CSV source facts file on Application facts.");
      return;
    }
    try {
      await importApplicationFiles(files);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import application facts.");
    }
  }

  function clearLabelSelection() {
    setLabels([]);
    setResults([]);
    setAdjudications({});
    setVerifiedCount(0);
    setActiveIndex(0);
    setError(null);
  }

  async function loadDemoFixture(kind: keyof typeof demoFixtures) {
    const id = demoFixtures[kind];
    setIsVerifying(true);
    setError(null);
    setResults([]);
    setAdjudications({});
    setVerifiedCount(0);

    try {
      const [factsResponse, imageResponse] = await Promise.all([
        fetch(`/evals/fixtures/generated/${id}.json`, { cache: "no-store" }),
        fetch(`/evals/fixtures/generated/${id}.png`, { cache: "no-store" }),
      ]);
      if (!factsResponse.ok || !imageResponse.ok) throw new Error(`Could not load ${id}.`);

      const demoApplication = applicationFromImportJson(await factsResponse.json());
      if (!demoApplication) throw new Error(`Could not read application facts for ${id}.`);

      const blob = await imageResponse.blob();
      const file = new File([blob], `${id}.png`, { type: blob.type || "image/png" });
      const image = await optimizedImageDataUrl(file);
      const label = {
        labelId: makeLabelId(file.name, 0),
        fileName: file.name,
        mimeType: image.mimeType,
        dataUrl: image.dataUrl,
      };

      setApplication(demoApplication);
      setImportedApplications([]);
      setLabels([label]);
      setActiveIndex(0);

      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application: demoApplication, labels: [label] }),
      });
      const data = await response.json();
      if (!response.ok) {
        const message = typeof data.error === "string" ? data.error : data.error?.message;
        throw new Error(message || `Verification failed for ${id}.`);
      }
      setResults(data.results);
      setVerifiedCount(data.results.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load demo fixture.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsVerifying(true);
    setError(null);
    setResults([]);
    setAdjudications({});
    setVerifiedCount(0);

    if (!labels.length) {
      setError("Upload or capture one label photo before verification.");
      setIsVerifying(false);
      return;
    }

    try {
      let nextResults: VerificationResult[] = [];
      if (hasApplicationBatch) {
        const matchedLabels = labels.map((label, index) => {
          const labelApplication = applicationForLabel(label, index);
          if (!labelApplication) throw new Error(`No application facts found for ${label.fileName}.`);
          return { ...label, application: labelApplication };
        });

        for (const chunk of chunkVerificationLabels(matchedLabels)) {
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
        }
      } else {
        for (const chunk of chunkVerificationLabels(labels)) {
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
        }
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
      },
    }));
  }

  function renderFactsEditor() {
    return (
      <>
        <div className="fact-grid">
          {fields.map(([key, label]) => {
            const className = ["fact-field", key === "bottlerAddress" ? "wide-field" : ""].filter(Boolean).join(" ");
            return (
              <label key={key} className={className}>
                <span>{label}</span>
                {selectFieldKeys.has(key) ? (
                  <select value={application[key] ?? ""} onChange={(event) => setApplication((current) => ({ ...current, [key]: event.target.value }))}>
                    <option value="">Select {label.toLowerCase()}</option>
                    {fieldOptions[key]?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={application[key] ?? ""}
                    placeholder={fieldPlaceholders[key]}
                    list={optionListId(key)}
                    onChange={(event) => setApplication((current) => ({ ...current, [key]: event.target.value }))}
                  />
                )}
              </label>
            );
          })}
          {Object.entries(fieldOptions).filter(([key]) => !selectFieldKeys.has(key as FactFieldKey)).map(([key, options]) => (
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
            </select>
          </label>
        </div>

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

  function renderImportButton() {
    return (
      <label className="import-button" onClick={(event) => event.stopPropagation()}>
        <ClipboardList aria-hidden />
        <span>Import JSON / CSV</span>
        <input className="file-input" type="file" accept=".json,.csv,application/json,text/csv" multiple onChange={handleApplicationImportInput} />
      </label>
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
              {activeLabel ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeLabel.dataUrl} alt={`Uploaded label preview for ${activeLabel.fileName}`} />
              ) : (
                <div className="empty-label-state">
                  <UploadCloud aria-hidden />
                  <strong>Upload label photo</strong>
                  <span>{isDropActive ? "Release to load" : "Drop images or a folder here. Up to 300 labels."}</span>
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
                <input
                  className="file-input"
                  type="file"
                  accept="image/*,.json,.csv,application/json,text/csv"
                  multiple
                  title="Upload label photos and optional JSON or CSV source facts"
                  onChange={handleFileInput}
                />
              </label>
              <button type="button" className="tool-button" onClick={() => setIsCameraOpen((open) => !open)}>
                <Camera aria-hidden />
                <span>{isCameraOpen ? "Close camera" : "Camera"}</span>
              </button>
              {activeLabel ? (
                <button type="button" className="ghost-button secondary" onClick={clearLabelSelection}>
                  Clear
                </button>
              ) : null}
              <button type="button" className="ghost-button secondary" disabled={isVerifying} onClick={() => void loadDemoFixture("pass")}>
                Demo pass
              </button>
              <button type="button" className="ghost-button secondary" disabled={isVerifying} onClick={() => void loadDemoFixture("fail")}>
                Demo fail
              </button>
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
          <section
            className={`facts-card${activeResult ? " facts-card-edit" : ""}${isFactsDropActive ? " facts-drop-active" : ""}`}
            onDragOver={handleFactsDragOver}
            onDragEnter={handleFactsDragOver}
            onDragLeave={handleFactsDragLeave}
            onDrop={handleFactsDrop}
          >
            {activeResult ? (
              <details className="edit-facts-drawer">
                <summary>
                  <div className="facts-header">
                    <div className="section-title">
                      <ClipboardList aria-hidden />
                      <div>
                        <h2>Edit application facts</h2>
                      </div>
                    </div>
                    {renderImportButton()}
                  </div>
                </summary>
                {renderFactsEditor()}
              </details>
            ) : (
              <>
                <div className="facts-header">
                  <div className="section-title">
                    <ClipboardList aria-hidden />
                    <div>
                      <h2>Application facts</h2>
                    </div>
                  </div>
                  {renderImportButton()}
                </div>
                {renderFactsEditor()}
              </>
            )}
          </section>

          {activeResult ? (
          <section className="guidance-panel" aria-label="Issues and next steps">
            <div className="field-comparison-header">
              <div className="section-title review-title">
                {decisionIcon(activeResult.decision)}
                <div>
                  <h2>Field comparison</h2>
                  <p>{`${issueTitle(attentionChecks.length)} · ${activeResult.elapsedMs} ms`}</p>
                </div>
              </div>
              <div className={`score-row decision-${activeResult.decision}`}>
                <span>{activeResult.decision.replace("_", " ")}</span>
                <strong>{activeResult.score}%</strong>
              </div>
            </div>

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
                      <p>{renderLabelEvidence(row)}</p>
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
                          <p>{renderLabelEvidence(row)}</p>
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
          ) : null}
          {activeResult ? (
            <section className="review-action-bar" aria-label="Reviewer final decision">
              <div className="decision-actions">
                {(["approved", "rejected"] as const).map((decision) => (
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
            </section>
          ) : null}
        </aside>
      </form>
    </main>
  );
}
