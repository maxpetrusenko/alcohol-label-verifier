# LabelCheck Agent

AI-powered alcohol label verification for TTB-style compliance review.

**Live:** <https://cola.maxpetrusenko.com>

A vision model reads the label; deterministic rules compare extracted text to the application record; the reviewer keeps final disposition. Standalone proof of concept — no COLAs integration.

## Reviewer UI

| Before verification | After verification |
| --- | --- |
| ![Reviewer screen before input](docs/assets/reviewer-before-input.jpg) | ![Reviewer screen after verification](docs/assets/reviewer-after-verification.jpg) |

On the live app, **Demo pass** / **Demo fail** load fixture label + JSON without uploading files.

## Take-home deliverables

| Required | Where |
| --- | --- |
| Deployed app | <https://cola.maxpetrusenko.com> |
| Source + setup | This repo; [Quick start](#quick-start) |
| **Approach** | [Approach & assumptions](#approach--assumptions) · [`docs/decisions/`](docs/decisions/) |
| **Tools used** | [Tech stack](#tech-stack) |
| **Assumptions** | [Approach & assumptions](#approach--assumptions) |
| **Limitations / trade-offs** | [Limitations](#limitations) · full matrix below |
| **Requirements coverage** | [Requirements matrix](#requirements-matrix) · [`docs/REQUIREMENTS_TRACE.md`](docs/REQUIREMENTS_TRACE.md) |

## Requirements matrix

Summary of the take-home prompt ([`docs/requirements.md`](docs/requirements.md)). **Full trace** (evidence paths, gaps): [`docs/REQUIREMENTS_TRACE.md`](docs/REQUIREMENTS_TRACE.md).

| # | Requirement | Status |
| --- | --- | --- |
| 1 | Working deployed prototype | **Done** |
| 2 | Repo + README (setup, approach, tools, assumptions, limits) | **Done** |
| 3 | Core flow: label vs application facts (brand, class/type, ABV, net contents, bottler, import origin, gov. warning) | **Done** (spirits strongest; wine/beer common fields) |
| 4 | Government warning exact text (+ caps prefix) | **Done** (not font/size/placement) |
| 5 | Human judgment; sensible formatting equivalence | **Done** (approve/reject override; no auto-denial) |
| 6 | ~5 second results | **Done** ([`docs/SPEED_EVIDENCE.md`](docs/SPEED_EVIDENCE.md)) |
| 7 | Clean, obvious UI + error handling | **Partial** (E2E smoke; more mobile/error copy needed) |
| 8 | Standalone — no COLAs integration | **Done** |
| 9 | Security / cloud API awareness documented | **Done** |
| 10 | Sample distilled spirits test labels | **Done** ([fixtures](#sample-fixtures)) |
| — | Batch upload (200–300 labels) | **Partial** (browser batch; no ZIP manifest queue) |
| — | Imperfect images / bad photos | **Partial** (degrade harness + review gates) |
| — | Highlight mismatches clearly | **Partial** (field table; no image regions yet) |

**Not in V1 (documented):** mock COLA queue (see [Raq](https://github.com/robin-raq/ttb-label-verifier), [colacop](https://github.com/gjw/colacop)), persisted audit trail, FedRAMP hosting, layout/font compliance.

## Approach & assumptions

**Approach**

1. **Blind extraction** — vision sees only label image/OCR, never application facts ([`0001-blind-extraction`](docs/decisions/0001-blind-extraction.md)).
2. **Deterministic rules** — pass / fail / needs-review from extracted vs expected ([`0002-deterministic-rules`](docs/decisions/0002-deterministic-rules.md)).
3. **Human disposition** — tool advises; reviewer approves or rejects ([`0003-human-in-the-loop`](docs/decisions/0003-human-in-the-loop-no-auto-denial.md)).

**Assumptions**

- One uploaded image = one isolated label panel (shelf/rack photos should block or crop).
- Cloud vision (Gemini default, OpenAI optional); text-only demo without keys.
- No upload persistence, auth, or COLAs API in this prototype.
- TTB field rules are approximated for demo speed, not a legal sign-off.

**Trade-offs:** speed and explainable checks over full commodity rule coverage and regulatory layout verification.

## Tech stack

Next.js (App Router), TypeScript, Tailwind, Zod, Vitest, Playwright, Gemini/OpenAI vision, Braintrust tracing (optional), `labelcheck` CLI + OpenAPI.

## Sample fixtures

Shared team dataset (Faheem): [fsyeddev/ttb-label `evals/fixtures/generated`](https://github.com/fsyeddev/ttb-label/tree/main/evals/fixtures/generated).

**In this repo** (same `01-pass-01` style pairs):

```text
public/evals/fixtures/spirits-generated-canonical/   # PNG + JSON + manifest.json
public/evals/fixtures/spirits-rendered-regression/   # SVG/HTML deterministic set
```

Served at `/evals/fixtures/spirits-generated-canonical/<id>.json` when running locally or on production. **Demo pass** uses `01-pass-01`.

```bash
npm run eval:fixtures    # rule engine over generated manifest
npm run fixtures:generate
```

## Quick start

**Requirements:** Node.js 18+, npm.

```bash
git clone https://github.com/maxpetrusenko/alcohol-label-verifier.git
cd alcohol-label-verifier
npm install
cp .env.example .env.local
# optional: GEMINI_API_KEY=...
npm run dev
```

Open <http://localhost:3000>. Health check: `curl -fsS http://localhost:3000/api/health | jq`

**Doppler:** `doppler secrets download --no-file --format env -p api_keys -c dev >> .env.local`

**README screenshots:** `npm run screenshots:readme`

## Environment

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Vision extraction (default) |
| `VISION_PROVIDER` | `gemini` or `openai` |
| `OPENAI_API_KEY` | When using OpenAI vision |
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

Details: [`docs/API.md`](docs/API.md). Versioned routes: `/api/v1/*`.

## Limitations

Proof-of-concept only — not final COLA compliance, no persistence/RBAC, no warning font metrics or multi-bottle shelf disambiguation. See [`docs/REQUIREMENTS_TRACE.md`](docs/REQUIREMENTS_TRACE.md) and [`docs/decisions/`](docs/decisions/).

## Docs

| Doc | Purpose |
| --- | --- |
| [`docs/REQUIREMENTS_TRACE.md`](docs/REQUIREMENTS_TRACE.md) | Full matrix, peer comparison, fixture map |
| [`docs/PRESEARCH.html`](docs/PRESEARCH.html) | Product flow and UI |
| [`docs/API.md`](docs/API.md) | API / CLI contract |
| [`docs/SPEED_EVIDENCE.md`](docs/SPEED_EVIDENCE.md) | Latency evidence |
| [`docs/decisions/`](docs/decisions/) | ADRs |
