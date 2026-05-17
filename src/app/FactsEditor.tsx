import { Loader2, Scale } from "lucide-react";
import type { ApplicationData, VerificationResult } from "@/lib/types";
import {
  fieldOptions,
  fieldPlaceholders,
  fields,
  optionListId,
  selectFieldKeys,
  type FactFieldKey,
} from "./pageSupport";

type FactsEditorProps = {
  application: ApplicationData;
  isVerifying: boolean;
  labelsLength: number;
  activeResult?: VerificationResult;
  verifiedCount: number;
  error: string | null;
  onApplicationChange: (next: ApplicationData) => void;
};

export function FactsEditor({
  application,
  isVerifying,
  labelsLength,
  activeResult,
  verifiedCount,
  error,
  onApplicationChange,
}: FactsEditorProps) {
  function updateApplication(key: keyof ApplicationData, value: string) {
    onApplicationChange({ ...application, [key]: value });
  }

  const datalists: Array<[string, string[]]> = [];
  for (const [key, options] of Object.entries(fieldOptions)) {
    if (!selectFieldKeys.has(key as FactFieldKey)) datalists.push([key, options]);
  }

  return (
    <>
      <div className="fact-grid">
        {fields.map(([key, label]) => {
          const className = ["fact-field", key === "bottlerAddress" ? "wide-field" : ""].filter(Boolean).join(" ");
          return (
            <label key={key} className={className}>
              <span>{label}</span>
              {selectFieldKeys.has(key) ? (
                <select disabled={isVerifying} value={application[key] ?? ""} onChange={(event) => updateApplication(key, event.target.value)}>
                  <option value="">Select {label.toLowerCase()}</option>
                  {fieldOptions[key]?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  disabled={isVerifying}
                  value={application[key] ?? ""}
                  placeholder={fieldPlaceholders[key]}
                  list={optionListId(key)}
                  onChange={(event) => updateApplication(key, event.target.value)}
                />
              )}
            </label>
          );
        })}
        {datalists.map(([key, options]) => (
          <datalist key={key} id={`options-${key}`}>
            {options.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        ))}
        <label>
          <span>Beverage</span>
          <select
            disabled={isVerifying}
            value={application.beverageKind}
            onChange={(event) => updateApplication("beverageKind", event.target.value as ApplicationData["beverageKind"])}
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
            ? labelsLength > 1
              ? `Checking ${verifiedCount}/${labelsLength}`
              : "Checking"
            : labelsLength > 1
              ? `Verify ${labelsLength} labels`
              : activeResult
                ? "Re-verify label"
                : "Verify label"}
        </span>
      </button>
      {error ? <p className="error-message">{error}</p> : null}
    </>
  );
}
