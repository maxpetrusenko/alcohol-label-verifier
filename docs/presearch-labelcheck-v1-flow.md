# LabelCheck V1 Presearch Flow

Canonical HTML artifact: [PRESEARCH.html](./PRESEARCH.html)

Asset folder: [presearch-labelcheck-v1/assets](./presearch-labelcheck-v1/assets)

## Decision

Build **TTB COLA Label Verifier** as a human in the loop discrepancy cockpit for TTB compliance agents, not an autonomous approval system and not a COLA replacement.

## Product Definition

AI-powered label verification tool for TTB compliance agents. Upload or select a label image and application data; the system checks that they match and meet COLA requirements under 27 CFR Part 5.

Scope of this deployment: **distilled spirits first**. Wine and malt beverages use the shared field-matching flow with limited alcohol-content exception handling; deeper commodity-specific wine and malt beverage rules remain staged.

The compliance engine surfaces advisories for four TTB rule areas:

- Bottle size: standards of fill under 27 CFR 5.203.
- State of distillation: origin disclosure for straight designations under 27 CFR 5.36.
- Statement of composition: required for liqueurs, cordials, and specialty or flavored products under 27 CFR 5.39.
- Non-standard production statements: terms like small batch, handcrafted, estate under 27 CFR 5.36.

Live demo: <https://cola.maxpetrusenko.com>. Health check: `curl -fsS https://cola.maxpetrusenko.com/api/health`.

The winning architecture is:

```text
mock COLA queue / JSON fixture + label image/text
  -> extractor reads visible label evidence only
  -> deterministic rule graph compares evidence to application and TTB references
  -> discrepancy summary groups reviewer action
  -> human disposition closes the review
  -> export packet preserves evidence, checks, timing, mode, and notes
```

## Why this is the right V1

The take home doc has four non-negotiables:

- Results must feel fast, with about 5 seconds as the practical adoption threshold.
- The interface must be obvious for mixed technical comfort levels.
- Routine matching should be automated, while judgment stays human.
- Batch review matters, because importer spikes can arrive as hundreds of labels.

The current repo already has the right core wedge:

- `src/app/page.tsx`, `src/app/VerifierClient.tsx`, `src/app/useVerifierController.tsx`: reviewer UI with source facts, image upload, demo flow, and result cards.
- `src/app/api/verify/route.ts`: `POST /api/verify` route with Zod validation, Gemini vision extraction by default, optional OpenAI extraction, and text fallback when no provider is configured.
- `src/lib/rules.ts`: deterministic comparison logic for brand, class/type, ABV/proof, net contents, warning, bottler, and origin.
- `src/lib/rules.test.ts`: baseline rule coverage.

The presearch decision is to deepen that wedge instead of broadening into platform work.

## Alignment Decision From Reference Repos

The new reference set changes the recommended V1 direction.

| Reference | Strongest signal | Borrow | Avoid |
| --- | --- | --- | --- |
| fsyeddev/ttb-label | Fixture-driven demo with generated label image + JSON pairs and field-level results. | Use `evals/fixtures/spirits-generated-canonical` as sample data and eval corpus. Borrow JSON/CSV import and PASS/FAIL/REVIEW rows. | Do not make manual field entry feel like the primary TTB workflow. |
| robin-raq/ttb-label-verifier | Mock COLA queue as default screen. Real agents review queued applications; they do not type every fact. | Make queue-first the main demo. Keep Single Label and Batch as secondary tabs. | Do not apply one shared form to many different labels. Each row needs its own source facts. |
| PlntGoblin/Automated-Label-Review-Tool | Blind extraction plus deterministic comparison. | AI reads only the label image. Code compares extracted evidence to application facts. | Do not show expected facts to the model during extraction; it can anchor the model. |

Corrected V1 decision:

```text
expected facts = COLA row / JSON fixture / CSV manifest
observed facts = AI extraction from label image
comparison = deterministic rule graph
decision = human reviewer disposition
```

## Similar Apps and Product Pattern

The closest apps are not alcohol-specific auto-approval systems. They are artwork proofing, packaging compliance, and official submission tools.

The HTML artifact includes five reference flow screenshots so the pattern is visual, not just described: LabelScreener, COLAClear, Label Score AI, ENTR Proofing, and Esko Comply.

| Reference | What it does | Lesson for LabelCheck |
| --- | --- | --- |
| TTB COLAs Online | Official COLA application, status tracking, application detail, and label image upload. | Mirror the mental model: application/source facts plus uploaded label images. Do not replace COLAs in V1. |
| LabelScreener | Upload artwork and product specs; get pass/fail/needs-review compliance report. | Source facts matter. For us, the source is the application PDF/screenshot/CSV or pasted facts. |
| COLAClear | Upload alcohol label artwork; get color-coded pass, review, fail, and info results with CFR citations. | This is the clearest alcohol-specific flow pattern: upload, check, report. |
| Label Score AI | Choose product type, upload label PDF/image, preview artwork, and show compliance issue cards. | The upload screen can fit product context, artwork, and first issue in one page. |
| Esko Comply | AI-led artwork checks for approved copy, formatting, symbols, barcodes, and reusable rulebooks. | Build source-backed reusable rules and visual evidence, not only a score. |
| ManageArtworks ComplAi | Scans packaging elements against regulatory profiles and flags deviations for collaborative review. | Use profiles for spirits, wine, malt beverage, imported, and domestic. |
| ENTR Proofing | Links packaging proofs to formula/regulatory data, comments, approvals, and traceability. | Add final disposition and export even if V1 has no persistence. |
| Truli / LabelValidator | AI label and claims review with flagged issues and citations. | Trust comes from citations and specific corrections. |

Shared pattern:

```text
pick/import application row
  + upload or attach label artwork
  -> extract visible text and elements
  -> compare against facts and rules
  -> flag mismatches with evidence
  -> human reviews and signs off
```

## Decision Matrix

| Option | What it means | Upside | Risk | Verdict |
| --- | --- | --- | --- | --- |
| Single label checker | Simple upload, single response | Fastest to finish | Misses batch pain and stakeholder context | Reject |
| Full compliance platform | Auth, persistence, queues, COLA-like workflow | Impressive scope | Too slow and not prototype realistic | Reject |
| Review cockpit | Evidence extraction, deterministic rules, batch review, human disposition, export | Matches assignment and can ship cleanly | Needs disciplined scope | Choose |

## V1 Scope

Ship these:

- Queue-first review using mock COLA rows or fixture JSON/CSV as expected application facts.
- Label image upload/attachment per row.
- Blind AI extraction preview for observed brand, class/type, ABV/proof, net contents, bottler/producer, origin, and warning.
- Single and small batch upload with text fallback.
- Extractor mode indicator: `vision+rules` or `text-only-demo`.
- Rule cards with expected, observed, status, rationale, and requirement reference.
- Reviewer final disposition: accept, request correction, override with reason, SME review.
- Exportable review packet with no raw image bytes by default.
- Tests for rule behavior, route contract, malformed extraction, and export shape.

Do not ship these in V1:

- Direct COLA integration.
- Authentication and RBAC.
- Long term storage.
- Teams posting.
- 300 label production queue infrastructure.
- Source-document OCR as the default expected-facts path.
- Asking the model to compare expected facts to the label directly.
- Claims that the system verifies font size, boldness, contrast, or placement without layout evidence.

## Architecture

```text
Browser
  mock COLA queue / fixture import
  label image preview
  blind extraction preview
  result cockpit
  disposition controls
      |
      v
POST /api/verify
  validates request
  enforces count and size limits
  calls extractor
      |
      v
Extractor
  configured vision provider when key and image exist
  text parser fallback when no key or blocked network
  sees only label image or pasted OCR
  returns visible fields, confidence, notes
      |
      v
RuleGraph
  deterministic checks
  commodity aware requirements
  low confidence gating
  requirement citations
      |
      v
Review packet
  result summary
  checks
  model mode
  elapsed time
  reviewer disposition
```

## Flow

1. Reviewer opens a mock COLA queue row or imports a JSON/CSV fixture.
2. The app attaches the label image for that row or the reviewer uploads one.
3. API validates expected facts and image payload before any model call.
4. AI extracts visible label evidence only.
5. Rule graph compares normalized evidence to the application.
6. UI groups labels into blocking, review, warning, and clear.
7. Reviewer accepts, overrides, requests correction, or sends to SME.
8. App exports JSON and a copyable summary block.

## What We Compare

Default comparison is **structured application facts versus each submitted label image/panel**.

We do **not** compare label A to label B by default.

Three concrete cases:

| Case | Input | What happens |
| --- | --- | --- |
| One label | One COLA row or JSON fixture + one image/text label | Extract observed facts from the label, compare field by field to expected structured facts. |
| Two panels for same SKU | One COLA row or JSON fixture + front label + back label | Combine evidence across panels. Brand/class may be on front; warning/name/address may be on back. Result is one product review with panel-level evidence. |
| Two different labels | Two source records plus two label files in batch | Each label gets its own result row. If they belong to different applications/SKUs, CSV/JSON application import can match each label to its expected facts by filename. |

Picture sources:

- Prototype: use generated fixture pairs under `/evals/fixtures/spirits-generated-canonical`: image + JSON + expected behavior.
- Real TTB flow: images already come with COLA applications; future integration would prefill source facts and attached images from COLAs.
- Fallback: reviewer manually enters fields, uploads CSV, or pastes OCR/text when no queue/fixture is available.

Concrete example:

```text
Expected application:
  Brand Name: OLD TOM DISTILLERY
  Class/Type: Kentucky Straight Bourbon Whiskey
  Alcohol Content: 45% Alc./Vol. (90 Proof)
  Net Contents: 750 mL

Observed label:
  OLD TOM DISTILLERY
  Kentucky Straight Bourbon Whiskey
  45% Alc./Vol. (90 Proof)
  750 mL
  GOVERNMENT WARNING: ...

Comparison:
  brand-name -> pass
  class-type -> pass
  alcohol-content -> pass
  net-contents -> pass
  government-warning -> pass / fail / needs_review depending exact text and extraction confidence
```

## Requirement References

Use source-backed chips in the UI and export packet.

| Check | Source spine | Prototype stance |
| --- | --- | --- |
| Health warning | 27 CFR Part 16, 16.21, 16.22 and TTB health warning guidance | Hard risk when missing or materially wrong. Exact formatting is marked unverified unless layout evidence exists. |
| Spirits mandatory fields | TTB distilled spirits labeling page and checklist | Brand, class/type, ABV, net contents, name/address, warning, import origin when applicable. |
| Wine brand label | TTB wine brand label guidance | Brand, class/type, appellation when required; other mandatory info can appear on any label. |
| Malt beverages | TTB malt mandatory label guidance | Brand, class/type, net contents, name/address, health warning, conditional alcohol and ingredient disclosures. |

## Data Contract Direction

Add these fields to checks and results:

```ts
type RequirementRef = {
  id: string;
  label: string;
  url: string;
};

type VerificationCheck = {
  id: string;
  label: string;
  status: "pass" | "warning" | "fail" | "needs_review";
  severity: "blocking" | "review" | "info";
  requirementRef: RequirementRef;
  expected?: string;
  observed?: string;
  rationale: string;
};

type ReviewerDisposition = {
  status: "accepted" | "request_correction" | "override" | "sme_review";
  reasonCode?: string;
  note?: string;
};
```

## Build Plan

1. Add requirement references and severities to rule checks.
2. Gate clean approval on extractor confidence.
3. Add reviewer disposition state in the UI.
4. Add export packet generation.
5. Add route contract tests for valid, invalid, fallback, and partial failure cases.
6. Add visual filters for blocking failures, needs review, warnings, and cleared labels.
7. Keep the 25 label API cap for V1; document that 200 to 300 label importer spikes require a future queue.

## Acceptance Tests

- A perfect demo spirits label produces `approved` with all required checks passing.
- `Stone's Throw` vs `STONE'S THROW` is not a hard mismatch.
- ABV/proof arithmetic reconciles `45% Alc./Vol.` and `90 Proof`.
- A wrong government warning is a blocking failure.
- A missing extractor field becomes `needs_review`, not invented evidence.
- A low confidence extraction cannot produce clean approval.
- One bad label in a batch does not hide the rest of the batch.
- Export excludes raw image bytes by default.

## Sources

- TTB health warning guidance: <https://www.ttb.gov/regulated-commodities/beverage-alcohol/beer/labeling/malt-beverage-health-warning>
- TTB distilled spirits labeling: <https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/labeling>
- TTB distilled spirits checklist PDF: <https://www.ttb.gov/system/files/images/labeling-ds/ds-labeling-checklist.pdf>
- TTB wine brand label guidance: <https://www.ttb.gov/regulated-commodities/beverage-alcohol/wine/labeling-wine/wine-labeling-brand-label>
- TTB malt beverage mandatory label guidance: <https://www.ttb.gov/regulated-commodities/beverage-alcohol/beer/labeling/malt-beverage-mandatory-label-information>
- TTB COLAs Online: <https://www.ttb.gov/what-we-do/online-services/colas-online>
- LabelScreener: <https://labelscreener.com/>
- Esko Comply: <https://www.esko.com/en/products/comply>
- ManageArtworks ComplAi: <https://www.manageartworks.com/products/complai>
- ENTR Proofing: <https://www.entrtechnologies.com/label-proofing>
- Truli: <https://trytruli.com/>
- LabelValidator: <https://labelvalidator.com/>
- HTML artifact reference from Thariq: <https://x.com/trq212/status/2052809885763747935>
