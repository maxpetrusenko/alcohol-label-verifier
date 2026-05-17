import type { ChangeEvent, DragEvent, RefObject } from "react";
import Image from "next/image";
import { Camera, FileImage, UploadCloud } from "lucide-react";
import type { PendingLabel } from "@/lib/labelPayload";
import type { VerificationResult } from "@/lib/types";

type LabelStageProps = {
  activeLabel?: PendingLabel;
  activeIndex: number;
  batchCount: number;
  labels: PendingLabel[];
  results: VerificationResult[];
  stageState: {
    hasBatch: boolean;
    isDropActive: boolean;
    isVerifying: boolean;
    isCameraOpen: boolean;
  };
  cameraError: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggleCamera: () => void;
  onClearLabelSelection: () => void;
  onLoadDemoFixture: (kind: "pass" | "fail") => void;
  onSetActiveIndex: (index: number) => void;
  onCaptureCameraFrame: () => void;
};

export function LabelStage({
  activeLabel,
  activeIndex,
  batchCount,
  labels,
  results,
  stageState,
  cameraError,
  videoRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileInput,
  onToggleCamera,
  onClearLabelSelection,
  onLoadDemoFixture,
  onSetActiveIndex,
  onCaptureCameraFrame,
}: LabelStageProps) {
  const { hasBatch, isDropActive, isVerifying, isCameraOpen } = stageState;

  function batchItemClass(index: number, result?: VerificationResult) {
    return ["batch-item", index === activeIndex ? "active" : "", result ? `decision-${result.decision}` : ""].filter(Boolean).join(" ");
  }

  return (
    <div className={`label-stage${isDropActive ? " drop-active" : ""}`} onDragOver={onDragOver} onDragEnter={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div className="label-preview" aria-label="Full label preview">
        {activeLabel?.dataUrl ? (
          <Image unoptimized fill sizes="(min-width: 900px) 58vw, 100vw" src={activeLabel.dataUrl} alt={`Uploaded label preview for ${activeLabel.fileName}`} />
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
                disabled={isVerifying}
                onClick={() => onSetActiveIndex(index)}
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
        <label className={`tool-button${isVerifying ? " disabled" : ""}`} aria-disabled={isVerifying}>
          <UploadCloud aria-hidden />
          <span>Upload</span>
          <input
            className="file-input"
            type="file"
            accept="image/*,.json,.csv,application/json,text/csv"
            multiple
            disabled={isVerifying}
            title="Upload label photos and optional JSON or CSV source facts"
            onChange={onFileInput}
          />
        </label>
        <button type="button" className="tool-button" disabled={isVerifying} onClick={onToggleCamera}>
          <Camera aria-hidden />
          <span>{isCameraOpen ? "Close camera" : "Camera"}</span>
        </button>
        {activeLabel ? (
          <button type="button" className="ghost-button secondary" disabled={isVerifying} onClick={onClearLabelSelection}>
            Clear
          </button>
        ) : null}
        <button type="button" className="ghost-button secondary" disabled={isVerifying} onClick={() => onLoadDemoFixture("pass")}>
          Demo pass
        </button>
        <button type="button" className="ghost-button secondary" disabled={isVerifying} onClick={() => onLoadDemoFixture("fail")}>
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
            <button type="button" className="ghost-button" disabled={isVerifying} onClick={onCaptureCameraFrame}>
              Capture label
            </button>
            {cameraError ? <p>{cameraError}</p> : <p>Allow camera permission, center the label, then capture.</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
