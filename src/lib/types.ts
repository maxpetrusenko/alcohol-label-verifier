export type BeverageKind = "spirits" | "wine" | "beer" | "other";

export type ApplicationData = {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  bottlerAddress?: string;
  countryOfOrigin?: string;
  beverageKind: BeverageKind;
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

export type VerificationCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  expected?: string;
  observed?: string;
  rationale: string;
};

export type VerificationDecision = "approved" | "needs_review" | "rejected";

export type VerificationResult = {
  fileName: string;
  decision: VerificationDecision;
  score: number;
  elapsedMs: number;
  extraction: LabelExtraction;
  checks: VerificationCheck[];
  summary: string;
};
