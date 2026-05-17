# SPEC: LabelCheck Agent Next Phase

> Corrective note: read `docs/PRODUCT_BLUEPRINT.md` first. It clarifies the product as a controlled discrepancy agent, adds the missing batch/edge-case/design requirements, and supersedes any vague app-like framing in this first spec.

## 1. Purpose

Advance the existing alcohol label verification proof-of-concept into a more reliable review-assistant workflow that supports batch-oriented TTB-style label checks, deterministic rule expansion, traceable evidence, and collaboration handoff without pretending to be an autonomous approval system.

This spec is written for implementation in the current Next.js App Router application at `/Users/maxpetrusenko/Desktop/Projects/alcohol-label-verifier`.

## 2. Current baseline

Existing app capabilities observed in the repo:

- UI: `src/app/page.tsx`, `src/app/VerifierClient.tsx`, `src/app/useVerifierController.tsx`, and focused components under `src/app/`
  - Single-page form for application record fields.
  - Uploads image batches as base64 data URLs.
  - Supports pasted OCR/text fallback.
  - Displays per-label decisions and field-level evidence cards.
- API: `src/app/api/verify/route.ts`
  - `POST /api/verify` validates requests with Zod.
  - Accepts `application` plus up to 25 `labels`.
  - Uses OpenAI Responses vision extraction when `OPENAI_API_KEY` and `label.dataUrl` are present.
  - Falls back to deterministic plain-text extraction when no model input is available.
- Rules: `src/lib/rules.ts`
  - Deterministic checks for brand, class/type, alcohol content/proof, net contents, Government Health Warning, optional bottler/producer, optional country of origin.
  - Decisions: `approved`, `needs_review`, `rejected`.
  - Check statuses: `pass`, `warning`, `fail`, `needs_review`.
- Types: `src/lib/types.ts`
  - Shared `ApplicationData`, `LabelExtraction`, `VerificationCheck`, `VerificationResult` types.
- Tests: `src/lib/rules.test.ts`
  - Vitest coverage for normalization, approval, ABV mismatch rejection, and bad warning rejection.
- Docs: `README.md`, `docs/PRESEARCH.md`.

## 3. Product goals for next phase

1. **Make batch review credible**
   - Handle importer spikes more gracefully than the current all-at-once request pattern.
   - Preserve per-label progress, error isolation, and resumability at the UI/API contract level.

2. **Increase agent trust**
   - Show exactly which requirement each check maps to.
   - Separate extracted evidence, deterministic rule result, and human final disposition.
   - Add a structured override path with reason codes.

3. **Expand deterministic rule coverage**
   - Keep the model as an extractor only.
   - Add commodity-aware required-field logic for spirits, wine, beer, and other.
   - Add confidence and evidence-span handling to reduce false certainty.

4. **Add auditable outputs without long-term storage by default**
   - Generate exportable review packets containing application data, extraction, checks, timestamps, and reviewer notes.
   - Keep persistence optional and explicitly scoped.

5. **Preserve demo usability**
   - Continue to run in text-only mode without `OPENAI_API_KEY`.
   - Keep common demo path under 5 seconds for one normal label.

## 4. Non-goals

- No direct COLA/TTB system integration in this phase.
- No final legal/compliance approval automation.
- No claim that OCR/model output proves font size, boldness, placement, contrast, or full layout compliance.
- No persistent storage of label images unless a later deployment decision adds an approved retention policy.
- No user authentication implementation unless selected by the security track; this spec defines the boundary and assumptions.

## 5. Personas and workflow

### Primary reviewer

A compliance agent receives an application record and one or more label images. They need to quickly detect mismatches and missing mandatory text while retaining final judgment.

### Internal reviewer/collaborator

A supervisor or SME needs to inspect evidence, reviewer notes, and override rationale.

### Proposed workflow

1. Reviewer enters or imports application record.
2. Reviewer uploads one or more labels or pastes OCR text.
3. System creates a client-visible batch with per-label status.
4. For each label:
   - Extract visible text/fields.
   - Run deterministic rules.
   - Return evidence cards and rule citations.
5. Reviewer chooses final disposition:
   - Accept system recommendation.
   - Override with reason and note.
   - Mark for SME review.
6. Reviewer exports a review packet or posts a summary to the internal collaboration path.

### Teams/internal collaboration path

For prototype handoff, support one of these lightweight options before building full workflow integration:

- **Export path:** Download JSON/CSV/PDF review packet and manually attach it to a Microsoft Teams thread.
- **Deep-link path:** Copy a formatted summary block designed for Teams chat:
  - Batch ID
  - Label file name
  - System decision
  - Failing/warning checks
  - Reviewer final disposition
  - Reviewer notes
- **Future integration path:** `POST /api/integrations/teams/summary` guarded behind environment flags and tenant-approved credentials. Do not implement until security assumptions are approved.

## 6. TDD-first implementation policy

All functional changes in this phase must start with failing tests. The implementation PR is not complete until the tests pass and the acceptance criteria are demonstrably covered.

### Required test layers

1. **Pure rule tests**
   - File target: `src/lib/rules.test.ts` or additional `src/lib/*.test.ts` files.
   - Cover normalization, commodity-specific required fields, exact warning behavior, threshold behavior, optional vs required fields, and decision aggregation.

2. **Schema/API contract tests**
   - Add route-handler tests for `POST /api/verify` and any new batch/export endpoints.
   - Validate accepted payloads, rejected payloads, max batch limits, bad MIME/type handling, and model-fallback behavior.

3. **Extractor tests with mocks**
   - Mock model response success, malformed JSON, unavailable model, and low-confidence extraction.
   - Ensure the app never invents missing fields and records extraction errors as notes/warnings rather than crashing the batch.

4. **UI behavior tests**
   - Keep the Playwright E2E smoke test for the primary reviewer shell and demo result flow green.
   - Expand E2E coverage for file selection, text-only fallback, per-label results, final disposition selection, and export/copy summary actions.

5. **Regression fixtures**
   - Add small text fixtures for representative spirits/wine/beer labels.
   - Image fixtures should be tiny, non-sensitive, and license-safe. Prefer text fixtures unless vision behavior is explicitly under test.

### Red-green-refactor flow

For each work item:

1. Write a failing test that states the required behavior.
2. Run `npm run test` and confirm the target failure.
3. Implement the smallest change to pass.
4. Run `npm run test`.
5. Run `npm run lint`.
6. Refactor only with green tests.
7. Update docs/API examples when contracts change.

## 7. Acceptance criteria

### A. Batch processing

- Given a request with up to the configured max labels, the API returns one result per submitted label.
- A failure to extract one label does not fail the entire batch unless the request schema itself is invalid.
- Each label result includes a stable `labelId`, file name, status, elapsed time, extraction notes, and checks.
- UI displays per-label progress/result states and does not hide partial failures.
- Batch size and payload limits are enforced with clear error messages.

### B. Rule accuracy and transparency

- All current rule behavior remains covered by tests.
- Government Health Warning exact text remains a hard compliance risk when missing/materially wrong.
- Commodity-aware required checks are explicit:
  - Spirits: brand, class/type, alcohol content/proof, net contents, Government Health Warning, bottler/producer when provided/required, origin for imports when provided/required.
  - Wine: brand, class/type/appellation where modeled, alcohol content when required, net contents, Government Health Warning, origin/import details when applicable.
  - Beer/malt beverage: brand, class/type, net contents, alcohol content where required by configured jurisdiction/rule profile, Government Health Warning where applicable.
- Every check includes `requirementRef` and `severity` in addition to status/rationale.
- Low extraction confidence cannot produce an unqualified `approved` decision without a warning or needs-review status.

### C. Human disposition and audit packet

- Reviewer can accept, override, or mark each label for SME review.
- Overrides require a reason code and free-text note.
- Export includes original application input, label metadata, extraction output, rule checks, model mode, timestamps, app version if available, and reviewer disposition.
- Export does not include raw image bytes by default.

### D. API reliability

- `POST /api/verify` remains backward compatible for the existing UI unless intentionally versioned.
- Invalid payloads return 400 with structured validation errors.
- Unexpected extractor/model failures return per-label `needs_review`/error notes where possible, not unhandled 500s.
- Server validates MIME type, data URL size, label count, and required fields before calling model providers.
- Response includes `meta.mode`, `meta.count`, `meta.elapsedMs`, and request/batch identifiers.

### E. Security/compliance posture

- No upload or result persistence is introduced without explicit retention design.
- API keys remain server-only and are never exposed to the browser.
- Raw model errors are sanitized before returning to the client.
- Request payload size limits are documented and enforced.
- Any Teams/integration endpoint is disabled by default and controlled via environment configuration.

## 8. Data model

The existing types can evolve as follows. Names are proposed; exact implementation may split API DTOs from internal domain models.

```ts
export type BeverageKind = "spirits" | "wine" | "beer" | "other";

export type ApplicationRecord = {
  id?: string;
  brandName: string;
  classType: string;
  alcoholContent?: string;
  netContents: string;
  bottlerAddress?: string;
  countryOfOrigin?: string;
  beverageKind: BeverageKind;
  imported?: boolean;
  applicantName?: string;
  permitNumber?: string;
  ruleProfile?: "ttb-demo" | "ttb-spirits" | "ttb-wine" | "ttb-malt";
};

export type LabelInput = {
  labelId: string;
  fileName: string;
  mimeType?: "image/png" | "image/jpeg" | "image/webp" | "text/plain";
  dataUrl?: string;
  text?: string;
  panel?: "front" | "back" | "neck" | "unknown";
};

export type EvidenceSpan = {
  field: string;
  text: string;
  source: "vision" | "ocr_text" | "fallback" | "user";
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type LabelExtraction = {
  labelText: string;
  fields: {
    brandName?: string;
    classType?: string;
    alcoholContent?: string;
    netContents?: string;
    governmentWarning?: string;
    bottlerAddress?: string;
    countryOfOrigin?: string;
  };
  confidence: number;
  evidence: EvidenceSpan[];
  notes: string[];
  extractor: {
    mode: "vision" | "text-only-demo" | "mock";
    model?: string;
    elapsedMs: number;
  };
};

export type CheckSeverity = "blocking" | "review" | "informational";
export type CheckStatus = "pass" | "warning" | "fail" | "needs_review";

export type VerificationCheck = {
  id: string;
  label: string;
  requirementRef: string;
  severity: CheckSeverity;
  status: CheckStatus;
  expected?: string;
  observed?: string;
  evidence?: EvidenceSpan[];
  confidence?: number;
  rationale: string;
};

export type VerificationDecision = "approved" | "needs_review" | "rejected";

export type ReviewerDisposition = {
  decision: "accepted" | "overridden" | "sme_review";
  reasonCode?: "false_positive" | "acceptable_variation" | "poor_image_quality" | "policy_exception" | "other";
  note?: string;
  reviewerId?: string;
  decidedAt: string;
};

export type VerificationResult = {
  labelId: string;
  fileName: string;
  decision: VerificationDecision;
  score: number;
  elapsedMs: number;
  extraction: LabelExtraction;
  checks: VerificationCheck[];
  summary: string;
  reviewerDisposition?: ReviewerDisposition;
};

export type VerificationBatch = {
  batchId: string;
  createdAt: string;
  application: ApplicationRecord;
  results: VerificationResult[];
  meta: {
    count: number;
    elapsedMs: number;
    mode: "vision+rules" | "text-only-demo" | "mixed";
    appVersion?: string;
  };
};
```

### Migration note

To preserve current UI compatibility, add new fields in a backward-compatible way first. For example, current flat `LabelExtraction.brandName` can be supported while the next model introduces `LabelExtraction.fields.brandName`. Tests should lock the compatibility behavior before refactor.

## 9. API contracts

### 9.1 Verify labels

`POST /api/verify`

Current endpoint remains the main synchronous path for demo and small batches.

#### Request

```json
{
  "application": {
    "brandName": "OLD TOM DISTILLERY",
    "classType": "Kentucky Straight Bourbon Whiskey",
    "alcoholContent": "45% Alc./Vol. (90 Proof)",
    "netContents": "750 mL",
    "bottlerAddress": "Old Tom Distillery, Frankfort, KY",
    "countryOfOrigin": "United States",
    "beverageKind": "spirits",
    "imported": false,
    "ruleProfile": "ttb-demo"
  },
  "labels": [
    {
      "labelId": "label-001",
      "fileName": "front.png",
      "mimeType": "image/png",
      "dataUrl": "data:image/png;base64,...",
      "text": "optional OCR fallback"
    }
  ],
  "options": {
    "includeRawExtraction": true,
    "maxConcurrency": 3
  }
}
```

#### Response: success

```json
{
  "batchId": "batch_2026-05-12_abc123",
  "results": [
    {
      "labelId": "label-001",
      "fileName": "front.png",
      "decision": "needs_review",
      "score": 83,
      "elapsedMs": 1420,
      "summary": "No hard mismatch was found, but one or more fields needs agent judgment.",
      "extraction": {
        "labelText": "...",
        "fields": {
          "brandName": "OLD TOM DISTILLERY",
          "classType": "Kentucky Straight Bourbon Whiskey",
          "alcoholContent": "45% Alc./Vol. (90 Proof)",
          "netContents": "750 mL",
          "governmentWarning": "..."
        },
        "confidence": 0.78,
        "evidence": [],
        "notes": ["Vision model returned structured fields."],
        "extractor": {
          "mode": "vision",
          "model": "gpt-4.1-mini",
          "elapsedMs": 1200
        }
      },
      "checks": [
        {
          "id": "government-warning",
          "label": "Government health warning",
          "requirementRef": "TTB-demo:health-warning",
          "severity": "blocking",
          "status": "pass",
          "expected": "GOVERNMENT WARNING: ...",
          "observed": "GOVERNMENT WARNING: ...",
          "confidence": 0.92,
          "rationale": "Mandatory warning appears with exact standard text and all-caps prefix."
        }
      ]
    }
  ],
  "meta": {
    "count": 1,
    "elapsedMs": 1510,
    "mode": "vision+rules"
  }
}
```

#### Response: validation error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request payload is invalid.",
    "issues": [
      {
        "path": ["labels"],
        "message": "At least one label is required."
      }
    ]
  }
}
```

### 9.2 Export review packet

`POST /api/export`

Generates a downloadable review packet from client-held verification results. No server persistence required.

#### Request

```json
{
  "batch": {
    "batchId": "batch_2026-05-12_abc123",
    "application": {},
    "results": []
  },
  "format": "json"
}
```

Supported initial formats:

- `json`: required.
- `csv`: optional if useful for supervisors.
- `pdf`: future/non-goal unless a library is intentionally added.

#### Response

- `200 application/json` for JSON export, or file download response for other formats.
- Export must exclude raw `dataUrl` image bytes unless explicitly requested and enabled by configuration.

### 9.3 Teams summary, future/disabled by default

`POST /api/integrations/teams/summary`

Do not implement until credentials, tenant, and data-handling requirements are approved. If implemented later:

- Require server-side auth/session.
- Require environment flag such as `TEAMS_INTEGRATION_ENABLED=true`.
- Sanitize all content.
- Send only summary metadata and check outcomes by default, not raw label images.

## 10. Validation and limits

Initial proposed limits:

- Labels per synchronous verify request: 25, preserving current behavior.
- Image MIME types: `image/png`, `image/jpeg`, `image/webp`.
- Text fallback max length: 50,000 characters per label.
- Data URL max decoded size: 8 MB per image for prototype; lower if deployment limits require.
- Total request body size: document and enforce at the route/runtime layer if possible.
- Model concurrency: default 3 for batch processing to avoid provider/API pressure.

Tests must cover limit boundaries and rejection messages.

## 11. Security and compliance assumptions

- The application is a prototype review assistant, not a system of record.
- Uploaded labels may contain regulated business information; treat all payloads as sensitive.
- No raw uploads, data URLs, model responses, or review results are stored server-side by default.
- If persistence is introduced, require a retention policy, encryption-at-rest plan, access model, audit logs, and deletion flow.
- API keys are server-only environment variables.
- Model provider use must be approved for the target environment. For government deployment, assume FedRAMP/ATO review or approved Azure/OpenAI/local model path is required.
- Logs must not include raw label text, raw image data, application records, or bearer/API tokens.
- Return sanitized model failure summaries to clients.
- Add abuse controls before public exposure: payload limits, rate limiting, CSRF/session strategy if authenticated, and content-type validation.
- Human reviewer remains the final authority; UI copy must avoid “guaranteed compliant” language.

## 12. Implementation plan and subagent work breakdown

### Subagent A: Rules and TDD harness

Scope:

- Expand `src/lib/rules.test.ts` with commodity-aware fixtures.
- Add `requirementRef`, `severity`, and confidence-aware decision behavior.
- Preserve existing tests and public behavior where compatible.

Deliverables:

- Failing tests first.
- Updated rule functions and types.
- Fixture files for spirits/wine/beer text examples.

Acceptance:

- `npm run test` passes.
- Tests prove low-confidence extraction cannot silently approve.

### Subagent B: API contracts and validation

Scope:

- Refactor schemas out of `route.ts` if helpful, e.g. `src/lib/schemas.ts`.
- Add structured validation errors.
- Add MIME, data URL size, text length, and label count validation.
- Add route tests for success, validation failure, extractor failure, and partial batch failure.

Deliverables:

- API tests.
- Backward-compatible response additions.
- Sanitized error handling.

Acceptance:

- Invalid requests return stable `VALIDATION_ERROR` shape.
- One extractor failure becomes a per-label review result where possible.

### Subagent C: Extraction robustness

Scope:

- Isolate extractor code from the route handler, e.g. `src/lib/extract.ts`.
- Add model response parsing guards.
- Add evidence/confidence shaping.
- Keep text-only fallback deterministic.

Deliverables:

- Mocked extractor tests.
- Typed extractor result with notes and elapsed time.

Acceptance:

- Malformed model JSON does not crash the batch.
- Missing fields are not invented.

### Subagent D: UI workflow

Scope:

- Add per-label status display and partial failure states.
- Add reviewer final disposition UI with reason/note.
- Add export/copy-summary action.
- Keep current single-page demo understandable.

Deliverables:

- UI changes in `src/app/page.tsx`, `src/app/VerifierClient.tsx`, `src/app/useVerifierController.tsx`, or focused components.
- Manual QA script or UI tests if test framework is added.

Acceptance:

- Reviewer can complete an end-to-end demo without API credentials.
- Results remain readable for 1 label and 25 labels.

### Subagent E: Documentation and security review

Scope:

- Update `README.md` with new API examples, env vars, limits, and test commands.
- Add security/compliance notes for retention, model provider, Teams path, and logging.
- Maintain `docs/PRESEARCH.md` and this spec as planning references.

Deliverables:

- README updates.
- Optional `docs/SECURITY.md` if scope grows.

Acceptance:

- A new developer can run tests and understand demo vs production caveats.

## 13. Open questions

1. Should the next phase introduce persistence, or keep all review state client-held/export-only?
2. Which rule profile should be authoritative for beer/malt beverage alcohol-content requirements in the prototype?
3. Should batch processing remain synchronous for 25 labels, or introduce an async job abstraction now?
4. What reviewer identity model is acceptable for override audit trails in a prototype with no auth?
5. Is Teams integration a real requirement for the next phase, or should copy/export be sufficient?
6. Are there approved sample labels/images for fixture-based regression tests?

## 14. Definition of done for next phase

- All new behavior is test-first and covered by automated tests where practical.
- `npm run test`, `npm run lint`, and `npm run build` pass.
- Current demo flow still works without `OPENAI_API_KEY`.
- API contracts and docs are updated with examples.
- Security assumptions are documented and no new persistence is added accidentally.
- Human-in-the-loop review and override path is present or explicitly deferred with issue-level acceptance criteria.
