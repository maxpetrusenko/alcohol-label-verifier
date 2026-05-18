# Presearch: LabelCheck V1

Canonical artifact:

- DaveJ-style clickable workflow map: [PRESEARCH.html#flow](./PRESEARCH.html#flow)
- Workflow map JSON: [presearch-labelcheck-v1/app-flow.json](./presearch-labelcheck-v1/app-flow.json)
- HTML: [PRESEARCH.html](./PRESEARCH.html)
- Markdown twin: [presearch-labelcheck-v1-flow.md](./presearch-labelcheck-v1-flow.md)
- Take-home requirement trace: [REQUIREMENTS_TRACE.md](./REQUIREMENTS_TRACE.md)
- Images: [presearch-labelcheck-v1/assets](./presearch-labelcheck-v1/assets)
- Reference screenshots: [presearch-labelcheck-v1/screenshots](./presearch-labelcheck-v1/screenshots)

## One Line Decision

Build **TTB COLA Label Verifier** as a human-in-the-loop discrepancy cockpit for TTB compliance agents:

```text
mock COLA queue or JSON/CSV fixture + label images/text
  -> AI extracts observed label evidence only
  -> deterministic rule graph
  -> reviewer-facing evidence cards
  -> human disposition
  -> exportable audit packet
```

Do not build an autonomous approval system. Do not build a COLAs replacement. Do not build a broad workflow platform.

## Product Definition

AI-powered label verification tool for TTB compliance agents. Upload or select a label image and application data; the system checks that they match and meet COLA requirements under 27 CFR Part 5.

Scope of this deployment: **distilled spirits first**. Wine and malt beverages use the common field-matching flow plus limited alcohol-content exception handling; deeper commodity-specific wine and malt beverage rules are staged.

The compliance engine surfaces advisories for four TTB rule areas:

- Bottle size: standards of fill under 27 CFR 5.203.
- State of distillation: origin disclosure for straight designations under 27 CFR 5.36.
- Statement of composition: required for liqueurs, cordials, and specialty or flavored products under 27 CFR 5.39.
- Non-standard production statements: terms like small batch, handcrafted, estate under 27 CFR 5.36.

Live demo: <https://cola.maxpetrusenko.com>. Health check: `curl -fsS https://cola.maxpetrusenko.com/api/health`.

## Why This Fits The Take Home

The source DOCX says agents need relief from routine matching, a result that feels faster than manual review, an obvious interface for mixed technical comfort, batch handling for importer spikes, and no direct COLAs integration for the prototype.

That points to a focused review assistant:

- automates the repetitive matching work
- keeps nuance and final judgment with the agent
- supports one label, multi-panel labels, and small batches
- starts from structured application facts, using a mock COLA queue or JSON/CSV fixture import
- keeps AI blind to expected facts during label extraction, reducing anchoring risk
- works with pasted OCR text when vision calls are unavailable
- can be explained and defended in a take-home review

## Alignment Decision From Reference Builds

The strongest direction signal is **queue-first review**, not blank form-first review.

- Raq's `ttb-label-verifier`: best product shape. Default screen is a mock COLA queue; each row already has application facts and attached artwork. Borrow queue-first, single-label fallback, batch ZIP + manifest, SSE-style progress later.
- fsyeddev's `ttb-label`: best fixture/eval source. Borrow generated label image plus JSON pairs from `evals/fixtures/spirits-generated-canonical`, import JSON/CSV, and field-level result/advisory UI.
- PlntGoblin's ALRT: best architecture decision. Borrow blind extraction: model sees only label artwork; deterministic code compares extracted evidence to expected application facts.
- External products: borrow visual report patterns from COLAClear, LabelScreener, Label Score AI, Esko Comply, and ENTR Proofing, but do not copy broad platform scope.

Corrected V1 stance:

```text
expected facts = structured COLA row / JSON / CSV / fixture
observed facts = AI extraction from label image
judge = deterministic rules
reviewer = final authority
```

## Current Repo Grounding

- `src/app/page.tsx`, `src/app/VerifierClient.tsx`, `src/app/useVerifierController.tsx`: reviewer surface with source facts, upload, demo flow, result cards, per-label navigation, decision counts, active result focus, 300-label browser batches, and beverage-profile selection.
- `src/app/api/verify/route.ts`: server-side verification route with validation, vision extraction, and text fallback.
- `src/app/api/v1/*`: versioned machine/API aliases for health, extract, verify, and export.
- `src/lib/rules.ts`: deterministic matching spine for brand, class/type, ABV/proof, net contents, warning, bottler, origin, image quality, and low-confidence review gates.
- `src/lib/types.ts`: current result contract.
- `src/lib/rules.test.ts`: baseline regression tests for normalization, ABV mismatch, and warning failures.
- `src/lib/htmlFixtureBenchmark.ts`: local benchmark harness for generated HTML/SVG fixtures.
- `scripts/html-fixture-generator.mjs`: deterministic fixture generator for clean pass, mismatch, warning, and bad-photo cases.
- `public/evals/fixtures/spirits-rendered-regression/manifest.json`: committed local fixture corpus for CI-friendly regression checks.
- `docs/decisions`: accepted ADRs for blind extraction, deterministic rules, human review, API/CLI/OpenAPI surface, fixture benchmarks, and deferred auth/audit/persistence.

Next implementation should extend those files, not introduce a separate workflow framework.

## Implementation Update: 2026-05-14

The presearch direction has been partly converted into working prototype requirements:

- Requirement-focused ADRs now define the product constraints and trust boundaries.
- Extraction remains blind: source application facts are not sent to the AI reader.
- Rules remain deterministic: model output is evidence, not authority.
- Human disposition remains separate from system findings.
- Deterministic fixture generation creates local SVG, HTML, JSON, and manifest files without paid image generation.
- Fixture benchmarking runs the rule engine over committed ground truth and writes a gap report to `/tmp/labelcheck-html-fixture-benchmark.json`.
- The full degraded-photo generator can create 500 local JPG variants across blur, glare, low light, noise, crop, distance, skew, severity, and camera orientation. The normal benchmark gate uses one representative image per degradation variant and writes `/tmp/labelcheck-degraded-fixture-benchmark.json`.
- Scene-photo edge cases are documented as reviewer-attention cases, not automated pass/fail cases: many bottles on shelves or racks, overlapping products, ambiguous target bottles, covered labels, pouring angles, glare, and unreadable label regions. The prototype should request an isolated label/crop instead of guessing the target product.
- Nano Banana generated image fixtures can be created with `npm run fixtures:nano` for fresh realistic demo coverage, but those generated pixels and label text are not deterministic legal ground truth.
- Live vision-model recognition has a separate opt-in eval: `npm run eval:vision -- --limit 10`, which requires the configured provider key and writes `/tmp/labelcheck-vision-model-eval.json`.
- Image-quality evidence such as blur, glare, low light, crop, skew, or unreadable text routes to review instead of clean approval.
- Batch UI now exposes label count, active label focus, decision counts, and per-label results.
- The API/tool surface is documented through `/api/v1/*`, `docs/openapi.json`, and the local `labelcheck` CLI wrapper.

## Scope Boundary

V1 currently has:

- demo text, copied fsyed fixtures, and deterministic local HTML/SVG fixtures for source application facts
- generated degraded-photo fixtures for local eval reporting, ignored by git to avoid committing hundreds of binaries
- opt-in generated scene-photo fixtures under `public/evals/fixtures/stress-nano-scenes/` for edge-case demos
- blind extraction or text fallback for observed label evidence
- one or more label inputs through multi-file upload or folder/image drag and drop, capped at 300 browser labels and 25 labels per API request
- CLI image and folder verification, capped at 300 images and chunked into 25-label API requests
- bounded parallel batch verification, defaulting to 3 labels in flight and accepting API options up to 10
- common field-matching support for distilled spirits, wine, and beer/malt, with `Other` blocked as an unsupported open-ended profile
- browser camera capture for one label at a time on localhost or HTTPS
- visible text/evidence extraction
- source-backed rule cards
- status grouping by blocking, review, warning, clear
- per-label batch results and summary counts
- reviewer disposition controls with reason codes, notes, browser draft persistence, and export inclusion
- export packet route without raw images by default
- CSV/JSON application fact import for single-record and multi-record batches

V1 still needs:

- mock COLA queue as the default main-screen data model
- target-label selection and crop confirmation for shelf/rack/multi-product photos before automated comparison
- durable server-side reviewer disposition audit trail
- durable server-side batch queue/retry/resume
- true pixel-level bounding boxes for label regions

V1 does not ship:

- COLAs integration
- authentication/RBAC
- long-term storage
- 300-label async queue
- source-document OCR as the default flow
- letting AI compare against expected facts directly
- legal final approval
- reviewer disposition persistence, reason codes, audit trails, retention/deletion policy, or encrypted evidence storage
- FedRAMP/ATO suitability, procurement approval, approved model hosting, or government-network guarantees
- font size, boldness, contrast, continuous placement, same-field-of-vision, warning separation, or exact visual placement checks unless layout evidence is added
- proof that missing facts are absent from label panels that were not uploaded
- live model-recognition claims without an opt-in `eval:vision` run using configured model credentials

## Source Spine

- Reference flow screenshots included in the HTML: LabelScreener, COLAClear, Label Score AI, ENTR Proofing, and Esko Comply.
- Reference builds reviewed: <https://github.com/fsyeddev/ttb-label>, <https://github.com/robin-raq/ttb-label-verifier>, <https://github.com/PlntGoblin/Automated-Label-Review-Tool>
- TTB health warning guidance: <https://www.ttb.gov/regulated-commodities/beverage-alcohol/beer/labeling/malt-beverage-health-warning>
- TTB distilled spirits labeling: <https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/labeling>
- TTB malt beverage mandatory label information: <https://www.ttb.gov/regulated-commodities/beverage-alcohol/beer/labeling/malt-beverage-mandatory-label-information>
- TTB wine brand label guidance: <https://www.ttb.gov/regulated-commodities/beverage-alcohol/wine/labeling-wine/wine-labeling-brand-label>
- TTB COLAs Online: <https://www.ttb.gov/what-we-do/online-services/colas-online>
- HTML artifact reference: <https://x.com/trq212/status/2052809885763747935>

Fetched/reviewed on 2026-05-13.

DaveJ workflow-map prompt added on 2026-05-14.
