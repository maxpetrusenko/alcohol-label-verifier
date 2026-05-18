# Requirements Trace

Read when checking whether the prototype satisfies the take-home prompt.

Source requirement summary: [`requirements.md`](requirements.md)

## Sample label + JSON fixtures

Faheem’s shared dataset lives in [fsyeddev/ttb-label `evals/fixtures/generated`](https://github.com/fsyeddev/ttb-label/tree/main/evals/fixtures/generated). This repo vendors the same canonical pass/mismatch/noncompliant set under:

| Location | Use |
| --- | --- |
| `public/evals/fixtures/spirits-generated-canonical/` | PNG + JSON pairs (`01-pass-01`, …), `manifest.json`, used by **Demo pass** / **Demo fail** |
| `public/evals/fixtures/spirits-rendered-regression/` | Deterministic SVG/HTML regression set + `manifest.json` |
| `public/evals/fixtures/stress-degraded-samples/` | Small committed degraded-photo samples |
| `public/evals/fixtures/wine-rendered-canonical/` | Wine SVG fixtures |

HTTP path (local or deployed): `/evals/fixtures/spirits-generated-canonical/<id>.json` and `.png`.

Other team fixture sources for cross-checking:

- [robin-raq/ttb-label-verifier](https://github.com/robin-raq/ttb-label-verifier) — `samples/`, mock-COLA queue fixtures
- [gjw/colacop `fixtures/pairs`](https://github.com/gjw/colacop/tree/main/fixtures/pairs) — paired `.jpg` + `.json` (agave, rumble, …)
- [PlntGoblin/Automated-Label-Review-Tool](https://github.com/PlntGoblin/Automated-Label-Review-Tool) — backend/frontend split, ADR-style docs

## Peer prototypes (gaps to know)

Compared to other take-home repos (May 2026). Not a scorecard — features we do not ship yet that evaluators may notice:

| Capability | Faheem `ttb-label` | Raq `ttb-label-verifier` | Gabe `colacop` | Daniel `ALRT` | LabelCheck (this repo) |
| --- | --- | --- | --- | --- | --- |
| Mock COLA application queue | — | Yes (default screen) | Yes (queue + lifecycle) | — | **No** — reviewer form + demo fixtures only |
| Batch ZIP + `manifest.csv` + SSE | — | Yes | Yes (watcher / upload) | — | **V1 done** — up to 300 images in browser, progressive 25-label API chunks, partial-safe failed rows; no ZIP manifest workflow |
| README “deliverables” map for graders | Partial | **Strong** | **Strong** (facts → reqs pipeline) | **Strong** (ADR index) | **README matrix** + this file |
| Explicit Layer 1 (regulation) vs Layer 2 (application) UI | Advisories in engine | Single compare pass | **Two layers + CFR rows** | Blind extract + deterministic compare | Single field-comparison table; CFR refs on checks |
| Verifying / progress UI screenshot in README | Yes | SSE row progress | Queue lifecycle | — | Before/after JPEGs only |
| Reviewer override audit (initials, persisted) | — | — | Per-finding adjudication UI | Initials on override | Approve/reject buttons; **no persisted audit trail** |
| Semantic / fuzzy class-type list | Documented | — | — | Fuzzy warning | Normalization + rules; not full designation ontology |
| CLI + OpenAPI agent surface | — | curl multipart | — | — | **Yes** (`labelcheck`, `docs/openapi.json`) |
| Degraded-image eval harness | — | — | — | — | **Yes** (ImageMagick degrade + benchmarks) |

Strengths relative to peers: blind extraction + deterministic rules (same family as ALRT), published CLI, large fixture/benchmark harness, live demo, Braintrust tracing hook.

## Current Position

LabelCheck is a standalone review-assistant prototype. It is not a final compliance authority, a COLAs integration, or a production government system.

The implementation is strongest for distilled spirits. Wine and beer/malt beverage inputs are accepted for common field matching and limited alcohol-content exception handling, but deeper commodity-specific wine and malt beverage rules remain staged.

## Traceability

| Requirement | Current coverage | Evidence in repo | Remaining gap |
| --- | --- | --- | --- |
| Working prototype with accessible app | Implemented | `src/app/page.tsx`, `src/app/VerifierClient.tsx`, `README.md` live prototype link, `tests/e2e/labelcheck.spec.ts` | Keep production URL healthy and smoke-tested before handoff. |
| Source code and setup docs | Implemented | `README.md`, `package.json`, `docs/API.md`, deliverables table in README | Keep README aligned with env vars and deployed provider mode. |
| README: approach, tools, assumptions, limitations | Implemented | `README.md` (Approach & assumptions), this matrix, `docs/decisions/` | Expand mock-COLA queue only if product scope grows. |
| Standalone proof of concept, no COLAs integration | Implemented | `README.md`, `docs/PRESEARCH.md`, `docs/decisions/0006-defer-auth-audit-and-persistence.md` | Mock COLA queue is still a local product shape, not a real COLAs connection. |
| Reviewer checks label artwork against application facts | Implemented | `src/app/VerifierClient.tsx`, `src/app/useVerifierController.tsx`, `src/app/api/verify/route.ts`, `src/lib/rules.ts`, `src/lib/applicationImport.ts`, `packages/labelcheck-cli/bin/labelcheck.mjs` | Browser and CLI support image/folder batches with CSV/JSON application facts; durable async queue/retry/resume remains future work. |
| One review row maps to one isolated product/label image | Implemented as documented V1 boundary | `README.md`, `src/app/LabelStage.tsx`, `src/lib/rules.ts`, `src/lib/rules.test.ts` | Multi-product shelf/counter photos block with a target-isolation message; production would need target selection/crop confirmation before comparison. |
| AI extracts observed label evidence only | Implemented | `docs/decisions/0001-blind-extraction.md`, `src/app/api/extract/route.ts` | Need stronger UI explanation when running in text fallback mode. |
| Deterministic rules decide pass/fail/review | Implemented | `docs/decisions/0002-deterministic-rules.md`, `src/lib/rules.ts`, `src/lib/rules.test.ts`, `src/app/ResultsPanel.tsx` | Deeper commodity-specific rule profiles remain future work. |
| Brand name matching | Implemented | `src/lib/rules.ts`, `src/lib/rules.test.ts` | Add more fixtures for punctuation, apostrophes, and OCR spacing. |
| Class/type designation matching | Implemented for common flow; deeper profile checks are spirits-first | `src/lib/rules.ts`, `docs/PRESEARCH.md` | Wine and malt beverage class/type rules need dedicated profiles. |
| Alcohol content matching with wine/beer exceptions | Partial | `src/lib/rules.ts`, `src/lib/rules.test.ts`, `docs/API.md` | Spirits now reject proof-only formatting; wine/malt exception handling is still limited and not full commodity coverage. |
| Net contents matching | Implemented | `src/lib/rules.ts`, `src/lib/rules.test.ts` | More unit variants and commodity-specific allowed containers remain future work. |
| Bottler/producer/importer name and address | Implemented | `src/lib/rules.ts`, `src/app/ResultsPanel.tsx`, `README.md`, `src/lib/rules.test.ts`, `public/evals/fixtures/spirits-rendered-regression/` | V1 now checks standard attribution/importer phrases; durable audit trail remains future work. |
| Country of origin for imports | Implemented as conditional requirement | `src/lib/rules.ts`, `src/app/ResultsPanel.tsx`, `docs/API.md`, `src/lib/rules.test.ts`, `public/evals/fixtures/spirits-rendered-regression/imported-*.svg` | Required only when the source record is imported; V1 has imported pass and mismatch visual fixtures. |
| Government Health Warning exact text | Implemented for text content | `src/lib/rules.ts`, `src/lib/rules.test.ts` | Exact capitalization and punctuation are enforced; font size, boldness, contrast, separation, and placement are not verified. |
| Same-field-of-vision and conditional disclosures | Partial | `src/lib/rules.ts`, `src/lib/rules.test.ts` | Text/notes can trigger review or blocking checks, but true layout and full ingredient-source validation require richer evidence. |
| Human judgment retained | Implemented with structured local reviewer disposition controls | `docs/decisions/0003-human-in-the-loop-no-auto-denial.md`, `src/lib/reviewPresentation.ts`, `src/app/ResultsPanel.tsx`, `src/app/pageSupport.tsx`, `src/lib/exportPacket.ts` | Reason codes and notes are saved as browser drafts and export packet data; durable server-side audit logs and case management remain future work. |
| About 5 second results | Implemented with benchmark hook | `src/app/api/verify/route.ts`, `src/lib/labelPayload.ts`, `scripts/eval-vision-model.mjs`, `README.md`, `docs/SPEED_EVIDENCE.md` | Keep live provider speed evidence fresh before final handoff. |
| Clean and obvious UI | Implemented for V1 | `src/app/VerifierClient.tsx`, `src/app/LabelStage.tsx`, `src/app/ResultsPanel.tsx`, `src/app/*.css`, `docs/PRESEARCH.html`, `tests/e2e/labelcheck.spec.ts` | Production polish would add saved filters, case queue, and durable audit review. |
| Error handling | Implemented for V1 | API schemas, route tests, UI upload validation, per-label batch failure results in `src/lib/labelPayload.ts` | Production hardening still needs central error telemetry and persisted retry history. |
| Avoid risky sensitive-data handling | Partial | No server persistence by default, export packet excludes raw images by default, reviewer notes stay client-held unless exported | Production needs auth, audit logs, retention/deletion, encryption, and approved hosting. |
| Cloud/API limitations documented | Implemented | `README.md`, `docs/API.md`, `.env.example` | UI should surface provider mode before the reviewer runs verification. |
| Sample distilled spirits labels | Implemented | `public/evals/fixtures/spirits-rendered-regression/manifest.json`, `public/evals/fixtures/spirits-generated-canonical/manifest.json` | Multi-panel production examples remain future work. |
| Batch upload/review for importer spikes | Implemented for V1 | `src/app/useVerifierController.tsx`, `src/app/LabelStage.tsx`, `src/lib/labelPayload.ts`, `src/lib/labelPayload.test.ts`, `packages/labelcheck-cli/bin/labelcheck.mjs`, `README.md` | Browser and CLI support up to 300 separate label images in progressive 25-label chunks with per-label failure isolation; durable server-side queue/retry/resume remains future work. |
| Imperfect image handling | Implemented for V1 triage | `scripts/generate-degraded-fixtures.mjs`, `scripts/generate-scene-samples.mjs`, `scripts/generate-nano-banana-fixtures.mjs`, `src/lib/degradedFixtureBenchmark.test.ts`, image-quality gates in `src/lib/rules.ts`, provider failure alerts in `src/app/ResultsPanel.tsx` | Multi-bottle shelf/rack photos, overlapping products, covered labels, and uncertain target bottles intentionally route to reviewer attention; production automation would add target selection, crop confirmation, and model bounding boxes. |
| Highlight mismatches | Implemented for V1 | `src/app/LabelStage.tsx`, `src/app/ResultsPanel.tsx`, `src/lib/reviewRows.ts` | V1 pins failures to image-side callouts and the expected/observed table; true pixel-level bounding boxes require extraction models that return reliable coordinates. |
| Documentation of limitations | Implemented | `README.md`, `docs/API.md`, `docs/PRESEARCH.md` | Keep PRESEARCH.html aligned with the same limitations. |

## Explicit Non-Goals For This Prototype

- Direct COLAs integration.
- Legal final approval.
- Autonomous approval without reviewer judgment.
- Server-side case management, audit logs, retention, deletion, RBAC, or encrypted evidence storage.
- FedRAMP/ATO suitability or approved government model-hosting guarantees.
- Full visual-layout compliance for font size, boldness, contrast, separation, placement, and same-field-of-vision.
- Proof that missing information is absent from panels the reviewer did not upload.

## Next Required Fixes

1. Keep production URL healthy and smoke-tested before handoff.
2. Run a fresh live provider speed/eval report before final submission.
3. Browser-QA the reviewer UI on laptop and mobile after any layout change.
4. Replace or quarantine Nano-generated photos that contain real brands or mismatched generated label text; keep them as ambiguity demos only unless paired with matching application facts.
5. Add durable server-side reviewer audit trail only if the prototype scope expands beyond standalone demo.

## Test Coverage

- Unit and route tests: `npm run test`
- Browser smoke E2E: `npm run test:e2e`
- React/Next static quality: `npm run doctor:react`
- CI now runs lint, unit tests, Playwright E2E, React Doctor, and production build.

The E2E suite currently covers the primary reviewer shell and demo verification result flow. It is intentionally small and deterministic; next useful E2E cases are JSON/CSV fact import drag/drop, failed batch chunk retry, mobile viewport layout, and provider/network failure messaging.
