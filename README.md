# LabelCheck Agent

AI-powered alcohol label verification prototype for TTB-style compliance review.

Live prototype: <https://cola.maxpetrusenko.com>

## What it does

- Scope is strongest for distilled spirits in V1. Wine and beer/malt reviews are supported for the common field-matching flow, including documented alcohol-content exceptions; `Other` remains blocked as an unsupported open-ended profile.
- Upload one isolated alcohol label/product image, or a batch of isolated label images.
- Drag image files or a folder onto the label area, or use `Bulk upload` to select up to 300 images at once; each image becomes its own review row and should correspond to one product/application record.
- Use `Camera` on localhost or HTTPS to capture one isolated label image from the browser camera.
- Verify large browser batches in 25-label API chunks with bounded server concurrency: default 3 labels in flight, configurable up to 10 through the API options.
- Enter the application record fields agents normally compare by eye.
- Extract visible label data with a vision model when configured.
- Fall back to pasted OCR/text so the prototype is testable without API credentials.
- Keep extraction blind: the model sees label evidence, not the expected application facts.
- Do not infer label facts from bottle shape, common container sizes, standard warning text, or other not-shown label panels. A field can pass only when the value is visible in extracted text or supplied through explicit text fallback.
- Run deterministic compliance checks for:
  - brand name
  - class/type designation
  - alcohol content / proof
  - net contents
  - Government Health Warning text
  - bottler/producer name and address, for example `Distilled and bottled by Old Cypress Distillery, Louisville, KY`
  - country of origin when imported
- Route low-confidence extraction and poor image evidence to human review instead of clean approval.
- Show per-label batch results, decision counts, and reviewer-oriented next steps.
- Export structured review packets through the API/tool surface.
- Return an agent-readable decision with expected/observed evidence.

## Tech stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Vision extraction through a low-latency provider path: Gemini by default, OpenAI available with `VISION_PROVIDER=openai`
- Zod request validation
- Vitest for rules, routes, presentation, and fixture benchmark coverage
- Deterministic HTML/SVG fixture generator for local regression cases
- Local `labelcheck` CLI and OpenAPI starter spec for tool/agent integrations

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

Production smoke check:

```bash
curl -fsS https://cola.maxpetrusenko.com/api/health
```

## Environment

```bash
VISION_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
GEMINI_API_KEY_MAX=
GEMINI_API_KEY_TURKEY=
GEMINI_VISION_MODEL=gemini-2.5-flash-lite
LANGSMITH_API_KEY=
LANGSMITH_ENDPOINT=
LANGSMITH_TRACING=false
LANGSMITH_PROJECT=alcohol-label-verifier
ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY=
ALCOHOL_LABEL_VERIFIER_LANGSMITH_ENDPOINT=
ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING=false
ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT=alcohol-label-verifier
BRAINTRUST_API_KEY=
BRAINTRUST_APP_URL=
BRAINTRUST_TRACING=true
BRAINTRUST_PROJECT=alcohol-label-verifier
ALCOHOL_LABEL_VERIFIER_BRAINTRUST_API_KEY=
ALCOHOL_LABEL_VERIFIER_BRAINTRUST_APP_URL=
ALCOHOL_LABEL_VERIFIER_BRAINTRUST_TRACING=true
ALCOHOL_LABEL_VERIFIER_BRAINTRUST_PROJECT=alcohol-label-verifier
VISION_MAX_OUTPUT_TOKENS=450
VISION_TIMEOUT_MS=2500
VISION_FALLBACK_TIMEOUT_MS=1500
OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-4.1-nano
OPENAI_VISION_ENDPOINT=chat_completions
OPENAI_IMAGE_DETAIL=low
OPENAI_VISION_MAX_OUTPUT_TOKENS=450
```

If the configured provider key is missing, the app runs in text-only demo mode using the OCR/text fallback box. Gemini is the default provider; set one of `GEMINI_API_KEY`, `GEMINI_API_KEY_MAX`, `GEMINI_API_KEY_TURKEY`, or `GOOGLE_API_KEY`. Set `VISION_PROVIDER=openai` to use OpenAI instead.
`VISION_TIMEOUT_MS` defaults to `2500`, so a stalled primary provider does not block the reviewer. If the opposite provider key is available, the app retries once with `VISION_FALLBACK_TIMEOUT_MS`, default `1500`; otherwise it returns a fast extraction failure instead of waiting 20-30 seconds.
Set `ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY` and `ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING=true` to trace sanitized vision extraction calls in LangSmith. Generic `LANGSMITH_*` variables still work as a fallback. Traces record provider/model/status and file metadata, not raw base64 label images or provider keys.
Set `ALCOHOL_LABEL_VERIFIER_BRAINTRUST_API_KEY` and `ALCOHOL_LABEL_VERIFIER_BRAINTRUST_TRACING=true` to also trace the same sanitized model calls in Braintrust. Generic `BRAINTRUST_*` variables still work as a fallback.
Check `/api/health` to confirm whether the running local or production server sees the keys; it reports `vision.configured`, `vision.provider`, the selected model, and LangSmith/Braintrust tracing status without exposing secrets.
The browser compresses uploaded/camera images to a bounded JPEG before verification so normal vision calls stay fast enough for reviewer use.

## Test and build

```bash
npm run test
npm run test:coverage
npm run test:e2e
npm run lint
npm run doctor:react
npm run build
```

`test:coverage` enforces 90% statements, functions, and lines coverage for `src/app/api` and `src/lib`, with branches currently held at the fixture-heavy baseline. `test:e2e` runs a Playwright Chromium smoke test against the reviewer UI and demo verification flow. CI installs Chromium and runs it alongside lint, unit/eval tests, React Doctor, and the production build.

Run the copied fsyed generated fixture eval report:

```bash
npm run eval:fixtures
```

This processes every generated fixture row in `public/evals/fixtures/spirits-generated-canonical/manifest.json` against the local deterministic rule engine and writes the gap report to `/tmp/labelcheck-fsyed-fixture-eval.json`.

Generate and benchmark the local deterministic HTML/SVG fixture set:

```bash
npm run fixtures:generate
npm run fixtures:benchmark
```

This writes no paid image-generation assets. It creates reproducible SVG, HTML, JSON, and manifest files in `public/evals/fixtures/spirits-rendered-regression/`, then runs the verifier over manifest ground truth with text extraction only. The benchmark report is written to `/tmp/labelcheck-html-fixture-benchmark.json`.

Generate and benchmark the degraded-photo eval set:

```bash
npm run fixtures:degrade
npm run fixtures:scenes
npm run eval:degraded-fixtures
```

`fixtures:degrade` uses ImageMagick locally to create the full seeded degraded set from copied fixture PNGs: defocus blur, motion blur, low light, overexposure, flash glare, blue cast, JPEG noise, distance/downsample, crop/occlusion, perspective skew, and camera viewpoint angles from top, bottom, inward, and outward label rotation across severity and camera orientation. `eval:degraded-fixtures` keeps the normal test gate fast by generating one representative image per degradation variant. Artifacts are local generated files under `public/evals/fixtures/stress-degraded-generated/` or a temp directory and are ignored by git; the benchmark report is written to `/tmp/labelcheck-degraded-fixture-benchmark.json`.

`fixtures:scenes` writes a small committed scene-photo sample set under `public/evals/fixtures/stress-degraded-samples/`: many bottles in storage, oblique shelf rows, crowded counters, and a pouring/hand-covered label. These cases are expected to block with a clear target-isolation message because the label panel is not isolated. They are not field-matching ground truth fixtures.

Generate opt-in Nano Banana edge-case photos when you want fresh realistic demo images:

```bash
npm run fixtures:nano
```

This uses Gemini image generation with `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY_MAX`, or `GEMINI_API_KEY_TURKEY` and writes images plus metadata to `public/evals/fixtures/stress-nano-scenes/`. It is intentionally outside CI because paid model calls and generated pixels are not deterministic. Use these images only for image-quality and target-ambiguity review behavior; generated label names and text may not match application facts and may not be legally exact. Use `GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview npm run fixtures:nano` to try Nano Banana Pro when that model is available on the configured key.

A small reviewable subset is committed under `public/evals/fixtures/stress-degraded-samples/`. Sample filenames encode photo quality, expected outcome, degradation family, severity, rotation, and source fixture, for example `bad__review__flash__l09__rotate-p015__src-01-pass-03__243.jpg`.

The deterministic and degraded benchmarks prove the rule engine and image-quality gates behave reproducibly. A claim that the live vision model recognizes labels correctly should be backed by a separate opt-in vision eval run with the configured provider key, because CI intentionally avoids paid model calls.

Run the opt-in live vision eval when you want presentation evidence for model recognition:

```bash
VISION_PROVIDER=gemini GEMINI_API_KEY=... npm run eval:vision -- --limit 10
```

This reads copied generated fixture PNGs through the configured vision model and writes `/tmp/labelcheck-vision-model-eval.json` with field-level match rates plus p50/p95/max latency for brand, class/type, ABV, net contents, bottler/importer address, and country of origin. Gemini is the default path; set `VISION_PROVIDER=openai` to benchmark OpenAI instead.

The committed local fixture set currently covers twelve cases: clean pass, imported spirits pass, imported country mismatch, imported importer mismatch, brand mismatch, wrong warning text, title-case warning prefix, blur, glare, low light, perspective skew, and tiny warning text.

## Prototype limitations

This prototype does not prove final label compliance. It is a review assistant for field matching and rule-surfacing.

It does not verify:

- health-warning font size, boldness, contrast, continuous placement, or separation from other label text; the statutory text itself is checked with exact capitalization and punctuation
- same-field-of-vision layout requirements beyond review-only flags when OCR/notes indicate required facts may be split across panels
- exact visual placement of brand, class/type, alcohol content, net contents, or warning text
- ingredient/source-fact disclosures beyond deterministic text triggers for sulfites, FD&C Yellow #5, carmine/cochineal, and neutral-spirits source commodity
- full wine or beer/malt commodity rule coverage beyond the common field checks and alcohol-content exception handling
- final image readability beyond heuristic low-confidence and degraded-image gates
- target-bottle disambiguation in photos with many bottles, shelves, racks, overlapping products, or multiple readable labels
- label facts that are physically covered by hands, pouring angles, bottle shoulders, glare, crop, or another object
- whether a missing field appears on another label panel that was not uploaded
- COLAs identity, submission status, or source-record authenticity
- reviewer disposition, reason codes, audit trails, retention, deletion, RBAC, or production security controls
- FedRAMP/ATO suitability, procurement approval, approved model hosting, or government-network access

For multi-product shelf/rack photos, covered labels, and ambiguous target bottles, the intended prototype behavior is a blocking target-isolation message: the reviewer should upload or crop one isolated label panel rather than letting the app guess which product to verify. Batch review means many separate label images, not one crowded image containing many products. A production version should add target selection, label-region detection, perspective correction, and confidence-backed crop review before comparison.

Cloud/model assumptions:

- Gemini vision extraction is the default and requires a Gemini or Google API key. OpenAI vision extraction requires `VISION_PROVIDER=openai` plus server-side `OPENAI_API_KEY`.
- If the key, network, or provider is unavailable, the app falls back to text-only demo behavior.
- CI does not call paid model APIs; live model recognition claims require `npm run eval:vision`.
- Uploaded image data is sent to the model provider when vision mode is configured.

## Approach

The prototype separates extraction from compliance judgment:

1. A vision model extracts structured fields from artwork.
2. Deterministic rules compare extracted fields against the application record.
3. The UI shows field-level evidence so a compliance agent can approve, reject, or override.

This avoids the brittle black-box pattern: the model reads; rules decide; humans see the receipts.

The reviewer may use judgment for harmless formatting equivalence after text is visible, such as case, punctuation, or apostrophes. The app should not use judgment to fill in missing ABV, net contents, warning text, bottler address, or country of origin from bottle appearance, common defaults, or expected application facts.

Current accepted decisions live in [`docs/decisions`](docs/decisions):

- blind extraction
- deterministic compliance rules
- human-in-the-loop final disposition
- API, CLI, and OpenAPI as the machine surface
- deterministic fixtures and benchmark harness
- deferred auth, audit logs, persistence, and COLAs integration
- Gemini as the default low-latency vision provider

## Machine and agent access

The browser UI is the primary reviewer experience, but other tools should use the JSON API instead of scraping the UI.

Current local API routes:

- `GET /api/health` returns a basic service health response.
- `POST /api/extract` extracts visible label evidence from image data or fallback text.
- `POST /api/verify` verifies one or more labels against application facts and returns structured decisions, evidence, checks, and next steps. The API accepts up to 25 labels per request; the browser chunks larger batches automatically.
- New integrations should use the versioned aliases: `/api/v1/health`, `/api/v1/extract`, `/api/v1/verify`, and `/api/v1/export`.

Local CLI wrapper:

```bash
LABELCHECK_BASE_URL=http://localhost:3000 node bin/labelcheck.mjs health
LABELCHECK_BASE_URL=http://localhost:3000 node bin/labelcheck.mjs verify input.json
LABELCHECK_BASE_URL=http://localhost:3000 node bin/labelcheck.mjs extract label.png
LABELCHECK_BASE_URL=http://localhost:3000 node bin/labelcheck.mjs export verify-response.json --format csv
```

Public CLI package:

```bash
npx labelcheck health
npx labelcheck verify input.json
npx labelcheck extract label.png
npx labelcheck export verify-response.json --format csv
```

The published package is `labelcheck@0.1.0`. It defaults to `https://cola.maxpetrusenko.com`. Set `LABELCHECK_BASE_URL` or pass `--base-url` for local/private servers.

Published CLI smoke test:

```bash
npx -y labelcheck@0.1.0 health
npm run demo:cli -- --base-url https://cola.maxpetrusenko.com --no-start
```

Agent/local demo:

```bash
npm run demo:cli
npm run demo:cli -- --base-url https://cola.maxpetrusenko.com --no-start
```

The demo script reuses an existing LabelCheck server when it finds one, otherwise starts `next dev` for the default local URL. It writes a fixture-backed verify payload, CLI response, and CSV review packet to `/tmp` and fails if the fixture decisions drift. Agents should use `--no-start` for the deployed app so the command fails clearly if production is unavailable.

Example `POST /api/verify` call:

```bash
curl -s http://localhost:3000/api/verify \
  -H 'Content-Type: application/json' \
  -d '{
    "application": {
      "brandName": "Old Cypress Distillery",
      "classType": "Kentucky Straight Bourbon Whiskey",
      "alcoholContent": "45% Alc./Vol.",
      "netContents": "750 mL",
      "bottlerAddress": "Old Cypress Distillery, Louisville, KY",
      "countryOfOrigin": "",
      "beverageKind": "spirits"
    },
    "labels": [
      {
        "labelId": "front",
        "fileName": "front.txt",
        "text": "Old Cypress Distillery\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol.\n750 mL"
      }
    ]
  }'
```

Future-proofing rules for tool integrations:

- Treat the API response as the integration contract, not the rendered UI.
- Add new response fields in a backward-compatible way.
- Keep extraction blind: model calls should see only label evidence, never the expected application facts.
- Keep compliance decisions deterministic: rules compare extracted evidence to application facts.
- Preserve per-label results in batch requests so one bad label does not fail the whole batch.
- Return structured errors with stable codes before exposing this as a public or cross-tool API.

Agent/tool surface:

- Shared Zod schemas exported from `src/lib` and mirrored in [`docs/openapi.json`](docs/openapi.json).
- A thin CLI wrapper, `node bin/labelcheck.mjs`, using the same HTTP contract.
- Optional MCP or workflow-agent adapters built on top of the CLI/API, not beside it.

See [`docs/API.md`](docs/API.md) for the current tool integration contract.
See [`docs/decisions`](docs/decisions) for the requirement-focused architecture decisions behind this split.
See [`docs/REQUIREMENTS_TRACE.md`](docs/REQUIREMENTS_TRACE.md) for the take-home requirement coverage matrix.

## Assumptions and limitations

- This is a standalone proof-of-concept and does not integrate with COLA.
- It does not store uploads or results.
- The prototype produces export packets, but they are not a compliance-grade audit log.
- The current reviewer screen supports demo, fixture, text fallback, upload, and small batch review; a true mock COLA queue remains the next product-shape step.
- Exact bold/font-size verification for the health warning is documented as a production limitation; the prototype checks exact text and all-caps prefix.
- For government production use, model hosting, audit logs, retention, RBAC, and FedRAMP/security review would be required.

## Product definition and research

Read these in order:

1. [`docs/PRESEARCH.html`](docs/PRESEARCH.html) — START HERE: clean visual presearch artifact with named app flows, UI, source spine, API shape, and TDD sequence.
2. [`docs/REQUIREMENTS_TRACE.md`](docs/REQUIREMENTS_TRACE.md) — take-home requirement coverage matrix: implemented, partial, and missing.
3. [`docs/SPEED_EVIDENCE.md`](docs/SPEED_EVIDENCE.md) — local and deployed speed probe evidence for the 5-second requirement.
4. [`docs/TASKS.md`](docs/TASKS.md) — V1 implementation backlog derived from the presearch artifact.
5. [`docs/PRODUCT_BLUEPRINT.md`](docs/PRODUCT_BLUEPRINT.md) — broader corrective research/background; do not implement wholesale.
6. [`docs/product-blueprint-designs.html`](docs/product-blueprint-designs.html) — earlier visual artifact/background.
7. [`docs/PRESEARCH.md`](docs/PRESEARCH.md) — original lightweight source notes.
8. [`docs/SPEC.md`](docs/SPEC.md) — older implementation baseline; superseded where it conflicts with the V1 flow.
9. [`docs/API.md`](docs/API.md) — API, CLI, and tool integration contract.
10. [`docs/decisions`](docs/decisions) — concise ADRs for blind extraction, deterministic rules, human review, tool surfaces, fixture benchmarks, and deferred auth/audit scope.
