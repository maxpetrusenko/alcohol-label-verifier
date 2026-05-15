# Requirements Trace

Read when checking whether the prototype satisfies the take-home prompt.

Source requirement summary: [`requirements.md`](requirements.md)

## Current Position

LabelCheck is a standalone review-assistant prototype. It is not a final compliance authority, a COLAs integration, or a production government system.

The implementation is strongest for distilled spirits. Wine and beer/malt beverage inputs are accepted for common field matching and limited alcohol-content exception handling, but deeper commodity-specific wine and malt beverage rules remain staged.

## Traceability

| Requirement | Current coverage | Evidence in repo | Remaining gap |
| --- | --- | --- | --- |
| Working prototype with accessible app | Implemented | `src/app/page.tsx`, `README.md` live prototype link | Keep production URL healthy and smoke-tested before handoff. |
| Source code and setup docs | Implemented | `README.md`, `package.json`, `docs/API.md` | Keep README aligned with env vars and deployed provider mode. |
| Standalone proof of concept, no COLAs integration | Implemented | `README.md`, `docs/PRESEARCH.md`, `docs/decisions/0006-deferred-production-scope.md` | Mock COLA queue is still a local product shape, not a real COLAs connection. |
| Reviewer checks label artwork against application facts | Implemented | `src/app/page.tsx`, `src/app/api/verify/route.ts`, `src/lib/rules.ts` | Need CSV/JSON manifest import beyond fixture loaders. |
| One review row maps to one isolated product/label image | Implemented as documented V1 boundary | `README.md`, `src/app/page.tsx`, `src/lib/rules.ts`, `src/lib/rules.test.ts` | Multi-product shelf/counter photos block with a target-isolation message; production would need target selection/crop confirmation before comparison. |
| AI extracts observed label evidence only | Implemented | `docs/decisions/0001-blind-extraction.md`, `src/app/api/extract/route.ts` | Need stronger UI explanation when running in text fallback mode. |
| Deterministic rules decide pass/fail/review | Implemented | `docs/decisions/0002-deterministic-rules.md`, `src/lib/rules.ts`, `src/lib/rules.test.ts` | Need expected-vs-observed display on every issue card. |
| Brand name matching | Implemented | `src/lib/rules.ts`, `src/lib/rules.test.ts` | Add more fixtures for punctuation, apostrophes, and OCR spacing. |
| Class/type designation matching | Implemented for common flow; deeper profile checks are spirits-first | `src/lib/rules.ts`, `docs/PRESEARCH.md` | Wine and malt beverage class/type rules need dedicated profiles. |
| Alcohol content matching with wine/beer exceptions | Partial | `src/lib/rules.ts`, `src/lib/rules.test.ts`, `docs/API.md` | Current exception handling is limited; not full wine or malt commodity coverage. |
| Net contents matching | Implemented | `src/lib/rules.ts`, `src/lib/rules.test.ts` | More unit variants and commodity-specific allowed containers remain future work. |
| Bottler/producer/importer name and address | Implemented | `src/lib/rules.ts`, `src/app/page.tsx`, `README.md`, `src/lib/rules.test.ts`, `public/evals/fixtures/html-generated/` | Durable audit trail remains future work; V1 field matching has unit and visual fixture coverage. |
| Country of origin for imports | Implemented as conditional requirement | `src/lib/rules.ts`, `src/app/page.tsx`, `docs/API.md`, `src/lib/rules.test.ts`, `public/evals/fixtures/html-generated/imported-*.svg` | Required only when the source record is imported; V1 has imported pass and mismatch visual fixtures. |
| Government Health Warning exact text | Implemented for text content | `src/lib/rules.ts`, `src/lib/rules.test.ts` | Font size, boldness, contrast, separation, and placement are not verified. |
| Case/punctuation tolerance for obvious equivalents | Implemented | `src/lib/rules.ts`, `src/lib/rules.test.ts` | Continue adding regression cases from real reviewer examples. |
| Human judgment retained | Implemented with local reviewer disposition controls | `docs/decisions/0003-human-review.md`, `src/lib/reviewPresentation.ts`, `src/app/page.tsx` | Saved audit trail, reason codes, and durable case management remain future work. |
| About 5 second results | Implemented with benchmark hook | `src/app/api/verify/route.ts`, `src/lib/labelPayload.ts`, `scripts/eval-vision-model.mjs`, `README.md`, `docs/SPEED_EVIDENCE.md` | Keep live provider speed evidence fresh before final handoff. |
| Clean and obvious UI | Partial | `src/app/page.tsx`, `src/app/globals.css`, `docs/PRESEARCH.html` | Needs more usability QA across 14-inch laptop, tablet, and phone viewports. |
| Error handling | Partial | API schemas, route tests, UI upload validation | Need clearer user-facing messages for camera permission, missing API key, and provider/network failures. |
| Avoid risky sensitive-data handling | Partial | No persistence by default, export packet excludes raw images by default | Production needs auth, audit logs, retention/deletion, encryption, and approved hosting. |
| Cloud/API limitations documented | Implemented | `README.md`, `docs/API.md`, `.env.example` | UI should surface provider mode before the reviewer runs verification. |
| Sample distilled spirits labels | Implemented | `public/evals/fixtures/html-generated/manifest.json`, `public/evals/fixtures/generated/manifest.json` | Multi-panel production examples remain future work. |
| Batch upload/review for importer spikes | Partial | `src/app/page.tsx`, `src/lib/labelPayload.ts`, `README.md` | Browser supports up to 300 separate label images in 25-label chunks; durable async queue/retry/resume and multi-application manifest import are not shipped. |
| Imperfect image handling | Partial | `scripts/generate-degraded-fixtures.mjs`, `scripts/generate-scene-samples.mjs`, `scripts/generate-nano-banana-fixtures.mjs`, `src/lib/degradedFixtureBenchmark.test.ts`, image-quality gates in `src/lib/rules.ts` | Multi-bottle shelf/rack photos, overlapping products, covered labels, and uncertain target bottles intentionally route to reviewer attention; need target selection, crop confirmation, field-level confidence, and label-region evidence before automated comparison. |
| Highlight mismatches | Partial | Review cards and issue grouping in UI | Add explicit expected/observed values and, later, image-region highlights. |
| Documentation of limitations | Implemented | `README.md`, `docs/API.md`, `docs/PRESEARCH.md` | Keep PRESEARCH.html aligned with the same limitations. |

## Explicit Non-Goals For This Prototype

- Direct COLAs integration.
- Legal final approval.
- Autonomous approval without reviewer judgment.
- Persistent case management, audit logs, retention, deletion, RBAC, or encrypted evidence storage.
- FedRAMP/ATO suitability or approved government model-hosting guarantees.
- Full visual-layout compliance for font size, boldness, contrast, separation, placement, and same-field-of-vision.
- Proof that missing information is absent from panels the reviewer did not upload.

## Next Required Fixes

1. Keep production URL healthy and smoke-tested before handoff.
2. Run a fresh live provider speed/eval report before final submission.
3. Browser-QA the reviewer UI on laptop and mobile after any layout change.
4. Replace or quarantine Nano-generated photos that contain real brands or mismatched generated label text; keep them as ambiguity demos only unless paired with matching application facts.
5. Add durable reviewer disposition/audit trail only if the prototype scope expands beyond standalone demo.
