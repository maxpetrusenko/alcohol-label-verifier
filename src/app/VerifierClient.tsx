"use client";

import { ApplicationFactsCard } from "./ApplicationFactsCard";
import { FactsEditor } from "./FactsEditor";
import { LabelStage } from "./LabelStage";
import { ResultsPanel } from "./ResultsPanel";
import { useVerifierController } from "./useVerifierController";

export function VerifierClient() {
  const verifier = useVerifierController();
  const {
    application,
    labels,
    results,
    activeLabel,
    activeIndex,
    activeResult,
    activeAdjudication,
    adjudications,
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
    toggleCamera,
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
  } = verifier;
  const activeImageIssueRows = [...activeReviewRows, ...activeSupplementalRows];

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

          <LabelStage
            activeLabel={activeLabel}
            activeIndex={activeIndex}
            batchCount={batchCount}
            labels={labels}
            results={results}
            activeIssueRows={activeImageIssueRows}
            batchProgress={batchProgress}
            stageState={{ hasBatch, isDropActive, isVerifying, isCameraOpen }}
            cameraError={cameraError}
            videoRef={videoRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileInput={handleFileInput}
            onToggleCamera={toggleCamera}
            onClearLabelSelection={clearLabelSelection}
            onLoadDemoFixture={(kind) => void loadDemoFixture(kind)}
            onSetActiveIndex={setActiveIndex}
            onCaptureCameraFrame={captureCameraFrame}
          />
        </section>

        <aside className={`control-panel${activeResult ? " has-result" : ""}`} aria-label="Application facts and verification controls">
          <ApplicationFactsCard
            hasResult={Boolean(activeResult)}
            isFactsDropActive={isFactsDropActive}
            isVerifying={isVerifying}
            onFactsDragOver={handleFactsDragOver}
            onFactsDragLeave={handleFactsDragLeave}
            onFactsDrop={handleFactsDrop}
            onApplicationImportInput={handleApplicationImportInput}
          >
            <FactsEditor
              application={application}
              isVerifying={isVerifying}
              labelsLength={labels.length}
              activeResult={activeResult}
              verifiedCount={verifiedCount}
              error={error}
              onApplicationChange={setApplication}
            />
          </ApplicationFactsCard>

          {activeResult ? (
            <ResultsPanel
              activeResult={activeResult}
              attentionChecks={attentionChecks}
              activeAdjudication={activeAdjudication}
              adjudicationCount={Object.keys(adjudications).length}
              exportStatus={exportStatus}
              isVerifying={isVerifying}
              activeReviewRows={activeReviewRows}
              scoredReviewRows={scoredReviewRows}
              activeSupplementalRows={activeSupplementalRows}
              nextSteps={nextSteps}
              onReviewerDecision={setReviewerDecision}
              onExportReviewPacket={exportReviewPacket}
              onCopyReviewSummary={copyReviewSummary}
            />
          ) : null}
        </aside>
      </form>
    </main>
  );
}
