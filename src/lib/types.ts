export type BeverageKind = "spirits" | "wine" | "beer" | "other";

export type ApplicationData = {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  bottlerAddress?: string;
  countryOfOrigin?: string;
  beverageKind: BeverageKind;
  imported?: boolean;
  agedYears?: number;
};

export type LabelExtraction = {
  labelText: string;
  brandName?: string;
  classType?: string;
  alcoholContent?: string;
  netContents?: string;
  governmentWarning?: string;
  bottlerAddress?: string;
  countryOfOrigin?: string;
  confidence: number;
  notes: string[];
};

export type CheckStatus = "pass" | "warning" | "fail" | "needs_review";

export type CheckSeverity = "blocking" | "review" | "info";

export type RequirementRef = {
  id: string;
  label: string;
  source: string;
  url: string;
};

export type VerificationCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  severity: CheckSeverity;
  requirementRef: RequirementRef;
  expected?: string;
  observed?: string;
  rationale: string;
  guidance?: string;
};

export type VerificationDecision = "approved" | "needs_review" | "rejected";

export type MissingApplicationFact = {
  field: keyof ApplicationData;
  label: string;
  severity: CheckSeverity;
  rationale: string;
  nextStep: string;
};

export type VerificationWorkflow = {
  comparisonSummary: string;
  missingApplicationFacts: MissingApplicationFact[];
  nextSteps: string[];
};

export type VerificationResult = {
  labelId?: string;
  fileName: string;
  decision: VerificationDecision;
  score: number;
  elapsedMs: number;
  extraction: LabelExtraction;
  checks: VerificationCheck[];
  summary: string;
  missingApplicationFacts: MissingApplicationFact[];
  nextSteps: string[];
  workflow: VerificationWorkflow;
};
