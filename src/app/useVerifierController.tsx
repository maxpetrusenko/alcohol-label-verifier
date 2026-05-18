"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  batchFailureResult,
  batchLimitError,
  chunkVerificationLabelsWithIndex,
  isImageLikeUpload,
  type PendingLabel,
} from "@/lib/labelPayload";
import {
  applicationFromImportJson,
  isApplicationImportUpload,
  type ImportedApplication,
} from "@/lib/applicationImport";
import { needsReviewerAttention } from "@/lib/reviewPresentation";
import { coreReviewRows, supplementalReviewRows } from "@/lib/reviewRows";
import type { ApplicationData, VerificationResult } from "@/lib/types";
import {
  type Adjudication,
  type AdjudicationUpdate,
  adjudicationResultKey,
  applicationForLabel,
  applicationsFromImportFile,
  defaultApplication,
  defaultReviewerDecision,
  demoFixtures,
  demoLabelText,
  drawScaledImage,
  filesFromDrop,
  isAdjudicationComplete,
  knownEvalFixtureFromImage,
  optimizedImageDataUrl,
  readStoredAdjudication,
  stopMediaStream,
  VISION_IMAGE_QUALITY,
  writeStoredAdjudication,
} from "./pageSupport";

export function useVerifierController() {
  const [application, setApplication] = useState<ApplicationData>(defaultApplication);
  const [importedApplications, setImportedApplications] = useState<ImportedApplication[]>([]);
  const [labels, setLabels] = useState<PendingLabel[]>([]);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [isFactsDropActive, setIsFactsDropActive] = useState(false);
  const [adjudications, setAdjudications] = useState<Record<string, Adjudication>>({});
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const activeLabel = labels[activeIndex] ?? labels[0];
  const activeResult = results[activeIndex];
  const activeAdjudicationKey = adjudicationResultKey(activeResult, activeLabel);
  const storedAdjudications = useMemo(() => {
    const next: Record<string, Adjudication> = {};
    results.forEach((result, index) => {
      if (!result) return;
      const key = adjudicationResultKey(result, labels[index]);
      const stored = readStoredAdjudication(key);
      if (stored) next[key] = stored;
    });
    return next;
  }, [results, labels]);
  const reviewerAdjudications = useMemo(() => ({ ...storedAdjudications, ...adjudications }), [storedAdjudications, adjudications]);
  const activeAdjudication = activeResult ? reviewerAdjudications[activeAdjudicationKey] : undefined;
  const batchCount = Math.max(labels.length, results.length);
  const hasBatch = batchCount > 1;
  const batchProgress = hasBatch
    ? {
        total: labels.length,
        completed: verifiedCount,
        failed: failedCount,
      }
    : undefined;
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

  function loadImportedApplications(rows: ImportedApplication[]) {
    setImportedApplications(rows);
    if (rows[0]) setApplication(rows[0].application);
  }

  async function importApplicationFiles(files: File[]) {
    if (!files.length) return [];
    const imported = (await Promise.all(files.map(applicationsFromImportFile))).flat();
    if (!imported.length) throw new Error("No application rows found. Use JSON or CSV with brand, class/type, ABV, and net contents columns.");
    loadImportedApplications(imported);
    return imported;
  }

  async function onFiles(files: FileList | File[] | null) {
    if (isVerifying) return;
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
      const knownFixtures = await Promise.all(imageFiles.map(knownEvalFixtureFromImage));
      const importedApplication = importFiles.length > 0 ? (await importApplicationFiles(importFiles))[0]?.application : knownFixtures[0]?.application;
      if (importedApplication) setApplication(importedApplication);

      if (!imageFiles.length) {
        setError(importFiles.length ? null : "Select label image files.");
        return;
      }

      const next = await Promise.all(
        imageFiles.map(async (file, index) => {
          const image = await optimizedImageDataUrl(file);
          const text = knownFixtures[index]?.labelText;
          return {
            labelId: makeLabelId(file.name, index),
            fileName: file.name,
            mimeType: image.mimeType,
            dataUrl: image.dataUrl,
            ...(text ? { text } : {}),
          };
        }),
      );

      setLabels(next);
      setActiveIndex(0);
      setResults([]);
      setAdjudications({});
      setVerifiedCount(0);
      setFailedCount(0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import application facts.");
      return;
    }
  }

  function captureCameraFrame() {
    if (isVerifying) return;
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
    setFailedCount(0);
    setError(null);
    setIsCameraOpen(false);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files ? [...event.currentTarget.files] : [];
    event.currentTarget.value = "";
    void onFiles(files);
  }

  async function handleApplicationImportInput(event: ChangeEvent<HTMLInputElement>) {
    if (isVerifying) return;
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
    if (isVerifying) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDropActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDropActive(false);
  }

  async function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (isVerifying) return;
    setIsDropActive(false);
    const files = await filesFromDrop(event.dataTransfer);
    if (!files.length) {
      setError("Drop image files, JSON source facts, or a folder containing them.");
      return;
    }
    await onFiles(files);
  }

  function handleFactsDragOver(event: DragEvent<HTMLElement>) {
    if (isVerifying) return;
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
    if (isVerifying) return;
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
    if (isVerifying) return;
    setLabels([]);
    setResults([]);
    setAdjudications({});
    setVerifiedCount(0);
    setFailedCount(0);
    setActiveIndex(0);
    setError(null);
  }

  async function loadDemoFixture(kind: keyof typeof demoFixtures) {
    if (isVerifying) return;
    const id = demoFixtures[kind];
    setIsVerifying(true);
    setError(null);
    setResults([]);
    setAdjudications({});
    setVerifiedCount(0);
    setFailedCount(0);

    try {
      const [factsResponse, imageResponse] = await Promise.all([
        fetch(`/evals/fixtures/spirits-generated-canonical/${id}.json`, { cache: "no-store" }),
        fetch(`/evals/fixtures/spirits-generated-canonical/${id}.png`, { cache: "no-store" }),
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
        text: demoLabelText(id),
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
      setFailedCount(0);
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
    setFailedCount(0);

    if (!labels.length) {
      setError("Upload or capture one label photo before verification.");
      setIsVerifying(false);
      return;
    }

    try {
      const labelsToVerify = hasApplicationBatch
        ? labels.map((label, index) => {
            const labelApplication = applicationForLabel(label, index, application, importedApplications);
            if (!labelApplication) throw new Error(`No application facts found for ${label.fileName}.`);
            return { ...label, application: labelApplication };
          })
        : labels;

      const nextResults = Array<VerificationResult | undefined>(labelsToVerify.length);
      const chunks = chunkVerificationLabelsWithIndex(labelsToVerify);
      const chunkFailures: string[] = [];

      function commitChunk(start: number, chunkResults: VerificationResult[]) {
        chunkResults.forEach((result, offset) => {
          nextResults[start + offset] = result;
        });
        const committed = nextResults.filter(Boolean) as VerificationResult[];
        setResults([...nextResults] as VerificationResult[]);
        setVerifiedCount(committed.length);
        setFailedCount(committed.filter((result) => result.checks.some((check) => check.id === "batch-request")).length);
      }

      async function verifyChunk(start: number, chunk: PendingLabel[]) {
        const chunkStart = Date.now();
        try {
          const response = await fetch("/api/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ application, labels: chunk, options: { maxConcurrency: 3 } }),
          });
          const data = await response.json();
          if (!response.ok) {
            const message = typeof data.error === "string" ? data.error : data.error?.message;
            throw new Error(message || "Verification failed.");
          }
          if (!Array.isArray(data.results) || data.results.length !== chunk.length) throw new Error("Verification returned an incomplete batch response.");
          commitChunk(start, data.results as VerificationResult[]);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unexpected verification error.";
          chunkFailures.push(message);
          commitChunk(
            start,
            chunk.map((label) => batchFailureResult(label, message, Date.now() - chunkStart)),
          );
        }
      }

      let cursor = 0;
      const workerCount = Math.min(2, chunks.length);
      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (cursor < chunks.length) {
            const chunk = chunks[cursor];
            cursor += 1;
            if (chunk) await verifyChunk(chunk.start, chunk.labels);
          }
        }),
      );

      setResults(nextResults as VerificationResult[]);
      setVerifiedCount(labelsToVerify.length);
      setFailedCount(nextResults.filter((result) => result?.checks.some((check) => check.id === "batch-request")).length);
      setActiveIndex(0);
      if (chunkFailures.length) {
        setError(`${chunkFailures.length} batch request${chunkFailures.length === 1 ? "" : "s"} failed. Completed labels stayed in the queue; retry failed rows or split the batch.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsVerifying(false);
    }
  }

  function setReviewerDecision(update: AdjudicationUpdate) {
    if (!activeResult) return;
    setExportStatus(null);
    setAdjudications((current) => {
      const currentDraft = current[activeAdjudicationKey];
      const disposition = update.disposition ?? currentDraft?.disposition ?? "accept_recommendation";
      const dispositionChanged = Boolean(update.disposition && update.disposition !== currentDraft?.disposition);
      const reviewerDecision =
        "reviewerDecision" in update
          ? update.reviewerDecision
          : dispositionChanged
            ? defaultReviewerDecision(disposition, activeResult.decision)
            : currentDraft?.reviewerDecision ?? defaultReviewerDecision(disposition, activeResult.decision);
      const nextDraft: Adjudication = {
        resultKey: activeAdjudicationKey,
        fileName: activeResult.fileName,
        disposition,
        reasonCode: update.reasonCode ?? currentDraft?.reasonCode ?? "",
        note: update.note ?? currentDraft?.note ?? "",
        recommendationDecision: activeResult.decision,
        reviewerDecision,
        isComplete: false,
        updatedAt: new Date().toISOString(),
        ...(activeResult.labelId ? { labelId: activeResult.labelId } : {}),
      };
      const completeDraft = { ...nextDraft, isComplete: isAdjudicationComplete(nextDraft) };
      writeStoredAdjudication(completeDraft);
      return { ...current, [activeAdjudicationKey]: completeDraft };
    });
  }

  function exportBatchPayload() {
    const completedResults = results.filter(Boolean);
    return {
      batchId: `labelcheck-${new Date().toISOString().replace(/[:.]/gu, "-")}`,
      application,
      results: completedResults,
      adjudications: reviewerAdjudications,
      meta: {
        labelCount: completedResults.length,
        exportedFrom: "reviewer-ui",
      },
    };
  }

  async function exportReviewPacket(format: "json" | "csv") {
    const completedResults = results.filter(Boolean);
    if (!completedResults.length) return;
    setExportStatus("Preparing export");
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: exportBatchPayload(), format }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = typeof data?.error?.message === "string" ? data.error.message : "Export failed.";
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `labelcheck-review.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportStatus(`${format.toUpperCase()} export ready`);
    } catch (err) {
      setExportStatus(err instanceof Error ? err.message : "Export failed.");
    }
  }

  async function copyReviewSummary() {
    const completedResults = results.filter(Boolean);
    if (!completedResults.length) return;
    const counts = completedResults.reduce(
      (acc, result) => {
        acc[result.decision] += 1;
        return acc;
      },
      { approved: 0, needs_review: 0, rejected: 0 },
    );
    const activeReview = activeAdjudication ? `Reviewer disposition: ${activeAdjudication.disposition}${activeAdjudication.reasonCode ? ` (${activeAdjudication.reasonCode})` : ""}` : "Reviewer disposition: not set";
    const summary = [
      `LabelCheck batch: ${completedResults.length} label${completedResults.length === 1 ? "" : "s"}`,
      `System decisions: ${counts.approved} approved, ${counts.needs_review} needs review, ${counts.rejected} rejected`,
      activeResult ? `Active label: ${activeResult.fileName} - ${activeResult.decision}` : undefined,
      activeReview,
      activeAdjudication?.note ? `Reviewer note: ${activeAdjudication.note}` : undefined,
      activeResult?.nextSteps?.[0] ? `Next action: ${activeResult.nextSteps[0]}` : undefined,
    ].filter(Boolean).join("\n");

    try {
      await navigator.clipboard.writeText(summary);
      setExportStatus("Summary copied");
    } catch {
      setExportStatus("Clipboard blocked; use export instead.");
    }
  }

  return {
    application,
    labels,
    results,
    activeLabel,
    activeIndex,
    activeResult,
    activeAdjudication,
    adjudications: reviewerAdjudications,
    exportStatus,
    batchCount,
    batchProgress,
    hasBatch,
    isDropActive,
    isVerifying,
    isCameraOpen,
    cameraError,
    isFactsDropActive,
    verifiedCount,
    error,
    videoRef,
    attentionChecks,
    activeReviewRows,
    scoredReviewRows,
    activeSupplementalRows,
    nextSteps,
    setApplication,
    setActiveIndex,
    verify,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInput,
    toggleCamera: () => {
      setCameraError(null);
      setIsCameraOpen((open) => !open);
    },
    clearLabelSelection,
    loadDemoFixture,
    captureCameraFrame,
    handleFactsDragOver,
    handleFactsDragLeave,
    handleFactsDrop,
    handleApplicationImportInput,
    setReviewerDecision,
    exportReviewPacket,
    copyReviewSummary,
  };
}
