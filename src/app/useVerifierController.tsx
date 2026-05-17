"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  batchLimitError,
  chunkVerificationLabels,
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
  applicationForLabel,
  applicationsFromImportFile,
  defaultApplication,
  demoFixtures,
  drawScaledImage,
  filesFromDrop,
  knownEvalFixtureFromImage,
  optimizedImageDataUrl,
  type ReviewerDisposition,
  stopMediaStream,
  VISION_IMAGE_QUALITY,
} from "./pageSupport";

export function useVerifierController() {
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
      const labelsToVerify = hasApplicationBatch
        ? labels.map((label, index) => {
            const labelApplication = applicationForLabel(label, index, application, importedApplications);
            if (!labelApplication) throw new Error(`No application facts found for ${label.fileName}.`);
            return { ...label, application: labelApplication };
          })
        : labels;

      const chunkedResults = await Promise.all(
        chunkVerificationLabels(labelsToVerify).map(async (chunk) => {
          const response = await fetch("/api/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ application, labels: chunk }),
          });
          const data = await response.json();
          if (!response.ok) {
            const message = typeof data.error === "string" ? data.error : data.error?.message;
            throw new Error(message || "Verification failed.");
          }
          return data.results as VerificationResult[];
        }),
      );
      const nextResults = chunkedResults.flat();
      setResults(nextResults);
      setVerifiedCount(nextResults.length);
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

  return {
    application,
    labels,
    results,
    activeLabel,
    activeIndex,
    activeResult,
    activeAdjudication,
    batchCount,
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
  };
}
