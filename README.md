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

## Presearch

See [`docs/PRESEARCH.md`](docs/PRESEARCH.md) for requirement extraction, research notes, and architecture rationale.
