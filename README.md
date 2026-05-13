# LabelCheck Agent

AI-powered alcohol label verification prototype for TTB-style compliance review.

## What it does

- Upload one alcohol label or a batch of label images.
- Enter the application record fields agents normally compare by eye.
- Extract visible label data with a vision model when configured.
- Fall back to pasted OCR/text so the prototype is testable without API credentials.
- Run deterministic compliance checks for:
  - brand name
  - class/type designation
  - alcohol content / proof
  - net contents
  - Government Health Warning text
  - optional bottler/producer address
  - optional country of origin
- Return an agent-readable decision with expected/observed evidence.

## Tech stack

- Next.js App Router + TypeScript
- Tailwind CSS
- OpenAI Responses API for optional vision extraction
- Zod request validation
- Vitest for rule coverage

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

## Approach

The prototype separates extraction from compliance judgment:

1. A vision model extracts structured fields from artwork.
2. Deterministic rules compare extracted fields against the application record.
3. The UI shows field-level evidence so a compliance agent can approve, reject, or override.

This avoids the brittle black-box pattern: the model reads; rules decide; humans see the receipts.

## Assumptions and limitations

- This is a standalone proof-of-concept and does not integrate with COLA.
- It does not store uploads or results.
- Exact bold/font-size verification for the health warning is documented as a production limitation; the prototype checks exact text and all-caps prefix.
- For government production use, model hosting, audit logs, retention, RBAC, and FedRAMP/security review would be required.

## Product definition and research

Read these in order:

1. [`docs/presearch-labelcheck-v1-flow.html`](docs/presearch-labelcheck-v1-flow.html) — START HERE: buildable V1 app direction, UI, source spine, API shape, and TDD sequence.
2. [`docs/TASKS.md`](docs/TASKS.md) — V1 implementation backlog derived from the presearch artifact.
3. [`docs/PRODUCT_BLUEPRINT.md`](docs/PRODUCT_BLUEPRINT.md) — broader corrective research/background; do not implement wholesale.
4. [`docs/product-blueprint-designs.html`](docs/product-blueprint-designs.html) — earlier visual artifact/background.
5. [`docs/PRESEARCH.md`](docs/PRESEARCH.md) — original lightweight source notes.
6. [`docs/SPEC.md`](docs/SPEC.md) — older implementation baseline; superseded where it conflicts with the V1 flow.
