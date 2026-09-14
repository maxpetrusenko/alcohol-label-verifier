import { useRef, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { ClipboardList } from "lucide-react";

type ApplicationFactsCardProps = {
  hasResult: boolean;
  isFactsDropActive: boolean;
  isVerifying: boolean;
  children: ReactNode;
  onFactsDragOver: (event: DragEvent<HTMLElement>) => void;
  onFactsDragLeave: (event: DragEvent<HTMLElement>) => void;
  onFactsDrop: (event: DragEvent<HTMLElement>) => void;
  onApplicationImportInput: (event: ChangeEvent<HTMLInputElement>) => void;
};

function stopInputEventPropagation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function ImportButton({ isVerifying, onApplicationImportInput }: Pick<ApplicationFactsCardProps, "isVerifying" | "onApplicationImportInput">) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <button
        type="button"
        className={`import-button${isVerifying ? " disabled" : ""}`}
        aria-disabled={isVerifying}
        disabled={isVerifying}
        onClick={(event) => {
          event.stopPropagation();
          inputRef.current?.click();
        }}
      >
        <ClipboardList aria-hidden />
        <span>Import JSON / CSV</span>
      </button>
      <input
        ref={inputRef}
        className="file-input"
        type="file"
        accept=".json,.csv,application/json,text/csv"
        multiple
        disabled={isVerifying}
        aria-label="Import JSON or CSV"
        onClick={stopInputEventPropagation}
        onChange={onApplicationImportInput}
      />
    </>
  );
}

function FactsHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="facts-header">
      <div className="section-title">
        <ClipboardList aria-hidden />
        <div>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}

export function ApplicationFactsCard({
  hasResult,
  isFactsDropActive,
  isVerifying,
  children,
  onFactsDragOver,
  onFactsDragLeave,
  onFactsDrop,
  onApplicationImportInput,
}: ApplicationFactsCardProps) {
  const importButton = <ImportButton isVerifying={isVerifying} onApplicationImportInput={onApplicationImportInput} />;

  return (
    <section
      className={`facts-card${hasResult ? " facts-card-edit" : ""}${isFactsDropActive ? " facts-drop-active" : ""}`}
      onDragOver={onFactsDragOver}
      onDragEnter={onFactsDragOver}
      onDragLeave={onFactsDragLeave}
      onDrop={onFactsDrop}
    >
      {hasResult ? (
        <details className="edit-facts-drawer">
          <summary>
            <FactsHeader title="Edit application facts">{importButton}</FactsHeader>
          </summary>
          {children}
        </details>
      ) : (
        <>
          <FactsHeader title="Application facts">{importButton}</FactsHeader>
          {children}
        </>
      )}
    </section>
  );
}
