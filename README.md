# LabelCheck Agent

AI-powered alcohol label verification for TTB-style compliance review.

**Live:** <https://cola.maxpetrusenko.com>

Vision reads the label; deterministic rules compare extracted text to the application record; the reviewer keeps final disposition. Standalone proof of concept — no COLAs integration.

## Reviewer UI

| Before verification | After verification |
| --- | --- |
| ![Reviewer screen before input](docs/assets/reviewer-before-input.jpg) | ![Reviewer screen after verification](docs/assets/reviewer-after-verification.jpg) |

**Demo pass** / **Demo fail** on the live app load fixture label + JSON without uploading files.

## Requirements

Take-home scope: [`docs/requirements.md`](docs/requirements.md). Full trace (evidence, gaps, peer notes): [`docs/REQUIREMENTS_TRACE.md`](docs/REQUIREMENTS_TRACE.md).

| # | Requirement | Status |
| --- | --- | --- |
| 1 | Deployed prototype + repo README (setup, approach, tools, assumptions, limits) | **Done** |
| 2 | Core flow: brand, class/type, ABV, net contents, bottler, import origin, gov. warning | **Done** (spirits strongest) |
| 3 | Government warning exact text (+ `GOVERNMENT WARNING:` caps) | **Done** (not font/size/placement) |
| 4 | Human judgment; formatting equivalence | **Done** |
| 5 | ~5 second results | **Done** ([`docs/SPEED_EVIDENCE.md`](docs/SPEED_EVIDENCE.md)) |
| 6 | Clean UI + error handling | **Partial** |
| 7 | Standalone — no COLAs API | **Done** |
| 8 | Security / cloud API documented | **Done** |
| 9 | Sample spirits test labels | **Done** ([fixtures](#fixtures)) |
| — | Batch upload (200–300) | **Partial** (browser batch only) |
| — | Imperfect / bad photos | **Partial** |
| — | Highlight mismatches on image | **Partial** (field table only) |

**Out of V1:** mock COLA queue, persisted audit trail, FedRAMP, layout/font compliance.

## Approach

1. **Blind extraction** — vision sees only the label, not application facts ([ADR 0001](docs/decisions/0001-blind-extraction.md)).
2. **Deterministic rules** — pass / fail / needs-review ([ADR 0002](docs/decisions/0002-deterministic-rules.md)).
3. **Human disposition** — reviewer approves or rejects; no silent auto-denial ([ADR 0003](docs/decisions/0003-human-in-the-loop-no-auto-denial.md)).

**Assumptions:** one image = one label panel; cloud vision (Gemini default); no upload persistence or COLAs API; rules approximate TTB for demo speed, not legal sign-off.

**Trade-off:** speed and explainable checks over full commodity coverage and regulatory layout verification.

## Stack

Next.js (App Router), TypeScript, Tailwind, Zod, Vitest, Playwright, Gemini/OpenAI vision, Braintrust tracing (optional), `labelcheck` CLI + OpenAPI.

## Fixtures

Team dataset: [fsyeddev/ttb-label `evals/fixtures/generated`](https://github.com/fsyeddev/ttb-label/tree/main/evals/fixtures/generated).

```text
public/evals/fixtures/spirits-generated-canonical/   # PNG + JSON + manifest
public/evals/fixtures/spirits-rendered-regression/   # deterministic SVG/HTML set
```

**Demo pass** uses `01-pass-01`. Regenerate: `npm run fixtures:generate` · evaluate: `npm run eval:fixtures`.

## Quick start

Node.js 18+, npm.

```bash
git clone https://github.com/maxpetrusenko/alcohol-label-verifier.git
cd alcohol-label-verifier
npm install
cp .env.example .env.local
# optional: GEMINI_API_KEY=...
npm run dev
```

Open <http://localhost:3000> · health: `curl -fsS http://localhost:3000/api/health | jq`

Optional: `doppler secrets download --no-file --format env -p api_keys -c dev >> .env.local` · README screenshots: `npm run screenshots:readme`

## Environment

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Vision extraction (default) |
| `VISION_PROVIDER` | `gemini` or `openai` |
| `OPENAI_API_KEY` | OpenAI vision |
| `ALCOHOL_LABEL_VERIFIER_BRAINTRUST_*` | Optional tracing |

See [`.env.example`](.env.example).

## Test and build

```bash
npm run test && npm run test:e2e && npm run lint && npm run build
```

## API and CLI

| Route | Description |
| --- | --- |
| `GET /api/health` | Service + provider status |
| `POST /api/verify` | Verify label(s) vs application facts |
| `POST /api/extract` | Extract fields only |

```bash
npx labelcheck health
npx labelcheck verify payload.json
npm run demo:cli
```

[`docs/API.md`](docs/API.md) · versioned routes `/api/v1/*`

## Docs

| Doc | Purpose |
| --- | --- |
| [`docs/REQUIREMENTS_TRACE.md`](docs/REQUIREMENTS_TRACE.md) | Full matrix + fixture map |
| [`docs/PRESEARCH.html`](docs/PRESEARCH.html) | Product flow |
| [`docs/SPEED_EVIDENCE.md`](docs/SPEED_EVIDENCE.md) | Latency evidence |
| [`docs/decisions/`](docs/decisions/) | ADRs |
