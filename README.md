# LabelCheck Agent

AI-powered alcohol label verification prototype for TTB-style compliance review.

## What it does

- Upload one alcohol label or a batch of label images.
- Drag image files or a folder onto the label area, or use `Bulk upload` to select up to 300 images at once; each image becomes its own review row.
- Use `Camera` on localhost or HTTPS to capture one label image from the browser camera.
- Verify large browser batches in 25-label API chunks with bounded server concurrency: default 3 labels in flight, configurable up to 10 through the API options.
- Enter the application record fields agents normally compare by eye.
- Extract visible label data with a vision model when configured.
- Fall back to pasted OCR/text so the prototype is testable without API credentials.
- Keep extraction blind: the model sees label evidence, not the expected application facts.
- Run deterministic compliance checks for:
  - brand name
  - class/type designation
  - alcohol content / proof
  - net contents
  - Government Health Warning text
  - optional bottler/producer address
  - optional country of origin
- Route low-confidence extraction and poor image evidence to human review instead of clean approval.
- Show per-label batch results, decision counts, and reviewer-oriented next steps.
- Export structured review packets through the API/tool surface.
- Return an agent-readable decision with expected/observed evidence.

## Tech stack

- Next.js App Router + TypeScript
- Tailwind CSS
- OpenAI Responses API for optional vision extraction
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

## Environment

```bash
OPENAI_API_KEY=your_key_here
OPENAI_VISION_MODEL=gpt-4.1-mini
```

If `OPENAI_API_KEY` is missing, the app runs in text-only demo mode using the OCR/text fallback box.
Check `/api/health` to confirm whether the running local or production server sees the key; it reports `vision.configured` without exposing the secret.

## Test and build

```bash
npm run test
npm run lint
npm run build
```

Run the copied fsyed generated fixture eval report:

```bash
npm run eval:fixtures
```

This processes every generated fixture row in `public/evals/fixtures/generated/manifest.json` against the local deterministic rule engine and writes the gap report to `/tmp/labelcheck-fsyed-fixture-eval.json`.

Generate and benchmark the local deterministic HTML/SVG fixture set:

```bash
npm run fixtures:generate
npm run fixtures:benchmark
```

This writes no paid image-generation assets. It creates reproducible SVG, HTML, JSON, and manifest files in `public/evals/fixtures/html-generated/`, then runs the verifier over manifest ground truth with text extraction only. The benchmark report is written to `/tmp/labelcheck-html-fixture-benchmark.json`.

Generate and benchmark the degraded-photo eval set:

```bash
npm run fixtures:degrade
npm run eval:degraded-fixtures
```

This uses ImageMagick locally to create 500 seeded low-quality JPG variants from the copied fixture PNGs: defocus blur, motion blur, low light, overexposure, flash glare, blue cast, JPEG noise, distance/downsample, crop/occlusion, and perspective skew across severity and camera orientation. Artifacts are local generated files under `public/evals/fixtures/degraded-generated/` and are ignored by git; the benchmark report is written to `/tmp/labelcheck-degraded-fixture-benchmark.json`.

A small reviewable subset is committed under `public/evals/fixtures/degraded-samples/`. Sample filenames encode photo quality, expected outcome, degradation family, severity, rotation, and source fixture, for example `bad__review__flash__l09__rotate-p015__src-01-pass-03__243.jpg`.

The deterministic and degraded benchmarks prove the rule engine and image-quality gates behave reproducibly. A claim that the live OpenAI vision model recognizes labels correctly should be backed by a separate opt-in vision eval run with `OPENAI_API_KEY` configured, because CI intentionally avoids paid model calls.

Run the opt-in live vision eval when you want presentation evidence for model recognition:

```bash
OPENAI_API_KEY=... npm run eval:vision -- --limit 10
```

This reads copied generated fixture PNGs through the configured vision model and writes `/tmp/labelcheck-vision-model-eval.json` with field-level match rates for brand, class/type, ABV, net contents, and bottler/address.

The committed local fixture set currently covers nine cases: clean pass, brand mismatch, wrong warning text, title-case warning prefix, blur, glare, low light, perspective skew, and tiny warning text.

## Approach

The prototype separates extraction from compliance judgment:

1. A vision model extracts structured fields from artwork.
2. Deterministic rules compare extracted fields against the application record.
3. The UI shows field-level evidence so a compliance agent can approve, reject, or override.

This avoids the brittle black-box pattern: the model reads; rules decide; humans see the receipts.

Current accepted decisions live in [`docs/decisions`](docs/decisions):

- blind extraction
- deterministic compliance rules
- human-in-the-loop final disposition
- API, CLI, and OpenAPI as the machine surface
- deterministic fixtures and benchmark harness
- deferred auth, audit logs, persistence, and COLAs integration

## Machine and agent access

The browser UI is the primary reviewer experience, but other tools should use the JSON API instead of scraping the UI.

Current local API routes:

- `GET /api/health` returns a basic service health response.
- `POST /api/extract` extracts visible label evidence from image data or fallback text.
- `POST /api/verify` verifies one or more labels against application facts and returns structured decisions, evidence, checks, and next steps. The API accepts up to 25 labels per request; the browser chunks larger batches automatically.
- New integrations should use the versioned aliases: `/api/v1/health`, `/api/v1/extract`, `/api/v1/verify`, and `/api/v1/export`.

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

Planned agent/tool surface:

- Shared Zod schemas exported from `src/lib` and mirrored in [`docs/openapi.json`](docs/openapi.json).
- A thin CLI wrapper, for example `labelcheck verify input.json`, using the same HTTP contract.
- Optional MCP or workflow-agent adapters built on top of the CLI/API, not beside it.

See [`docs/API.md`](docs/API.md) for the current tool integration contract.
See [`docs/decisions`](docs/decisions) for the requirement-focused architecture decisions behind this split.

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
2. [`docs/TASKS.md`](docs/TASKS.md) — V1 implementation backlog derived from the presearch artifact.
3. [`docs/PRODUCT_BLUEPRINT.md`](docs/PRODUCT_BLUEPRINT.md) — broader corrective research/background; do not implement wholesale.
4. [`docs/product-blueprint-designs.html`](docs/product-blueprint-designs.html) — earlier visual artifact/background.
5. [`docs/PRESEARCH.md`](docs/PRESEARCH.md) — original lightweight source notes.
6. [`docs/SPEC.md`](docs/SPEC.md) — older implementation baseline; superseded where it conflicts with the V1 flow.
7. [`docs/API.md`](docs/API.md) — API, CLI, and tool integration contract.
8. [`docs/decisions`](docs/decisions) — concise ADRs for blind extraction, deterministic rules, human review, tool surfaces, fixture benchmarks, and deferred auth/audit scope.
