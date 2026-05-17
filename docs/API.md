# LabelCheck API

Read when integrating another tool, script, agent, or workflow with LabelCheck.

The browser UI is for human reviewers. Tools should use the JSON API or CLI.

## Contract rules

- Use `/api/v1/*` for new integrations. Existing `/api/*` routes remain for local UI compatibility.
- Treat JSON responses as the contract. Do not scrape rendered HTML.
- New response fields may be added without a version bump. Existing fields should not change meaning inside `v1`.
- Model extraction stays blind: send only label image/text to extraction, not expected application facts.
- Compliance decisions stay deterministic: rules compare extracted evidence to application facts.
- Batch endpoints return one result per label; a broken label should not fail the whole batch unless the request itself is invalid.
- Errors use `{ error: { code, message, requestId, issues? } }`.
- Successful machine calls include `meta.requestId` or `requestId` for export packets.

## Prototype limitations

API consumers must treat LabelCheck V1 as a prototype review aid, not a production compliance authority.

The API does not verify font size, boldness, contrast, same-field-of-vision layout, exact placement, or warning separation. Those require layout-aware extraction, bounding boxes, and image-region evidence that V1 does not expose.

The API also does not provide authentication, RBAC, audit logs, retention/deletion policy, encrypted persistence, COLAs integration, final reviewer disposition, FedRAMP/ATO assurance, or approved government model-hosting guarantees.

Vision mode depends on the configured provider key and outbound network access. Gemini is the default provider; OpenAI is available with `VISION_PROVIDER=openai`. If provider secrets are missing or blocked, the API falls back to text-only extraction behavior. Uploaded image data is sent to the configured model provider when vision mode is active. Provider calls use `VISION_TIMEOUT_MS` with a default of `2500` ms. If the opposite provider key is configured, a timeout retries once with `VISION_FALLBACK_TIMEOUT_MS`, default `1500` ms; otherwise the API returns a fast extraction failure instead of blocking the reviewer.

## CLI

The CLI is a thin HTTP client over `/api/v1/*`.

```bash
npx labelcheck health
npx labelcheck verify input.json
npx labelcheck extract label.png
npx labelcheck export verify-response.json --format json
npx labelcheck export verify-response.json --format csv
```

The published CLI defaults to `https://cola.maxpetrusenko.com`. For local development or private deployments:

```bash
LABELCHECK_BASE_URL=http://localhost:3000 labelcheck health
labelcheck verify input.json --base-url http://localhost:3000
```

For local development without installing the package:

```bash
LABELCHECK_BASE_URL=http://localhost:3000 node bin/labelcheck.mjs health
```

For an agent-safe local smoke demo:

```bash
npm run demo:cli
npm run demo:cli -- --base-url https://cola.maxpetrusenko.com --no-start
```

The demo reuses a running LabelCheck server when available, or starts one for the default local URL. It creates fixture-backed input under `/tmp`, calls `health`, `verify`, and `export`, writes the JSON/CSV artifacts, and exits non-zero if expected fixture decisions drift. Use `--no-start` for production so agents fail clearly instead of starting a local server.

`verify` accepts the same batch JSON as `/api/v1/verify`, including up to 25 labels per request. Agents should chunk larger jobs into 25-label requests and preserve `labelId` values to join results back to source files.

## Endpoints

### `GET /api/v1/health`

Returns:

```json
{
  "ok": true,
  "service": "alcohol-label-verifier",
  "vision": {
    "configured": true,
    "mode": "vision+rules",
    "provider": "gemini",
    "model": "gemini-2.5-flash-lite",
    "endpoint": "generateContent",
    "imageDetail": "low"
  },
  "langsmith": {
    "configured": true,
    "tracingEnabled": true,
    "project": "alcohol-label-verifier"
  },
  "braintrust": {
    "configured": true,
    "tracingEnabled": true,
    "project": "alcohol-label-verifier"
  }
}
```

Use `vision.configured` and tracing booleans to verify local or production secret wiring without exposing provider secrets such as `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GEMINI_API_KEY_MAX`, `GEMINI_API_KEY_TURKEY`, `GOOGLE_API_KEY`, or observability API keys.

### `POST /api/v1/extract`

Extracts visible evidence from labels. Use this when a tool needs OCR/vision output before it has application facts.

Request:

```json
{
  "labels": [
    {
      "fileName": "front.png",
      "mimeType": "image/png",
      "dataUrl": "data:image/png;base64,...",
      "text": "optional OCR fallback"
    }
  ],
  "options": {
    "maxConcurrency": 3
  }
}
```

### `POST /api/v1/verify`

Main tool endpoint. Verifies 1 to 25 labels per request against application facts. For 200+ label batches, chunk calls at 25 labels; the browser UI does this automatically and preserves per-label result order.

V1 scope is strongest for distilled spirits. `application.beverageKind` may also be `wine` or `beer` for the common field-matching flow; when no source alcohol content is supplied, those profiles can pass the `alcohol-content-profile` check because wine and malt beverage rules include commodity-specific exceptions. `other` returns a blocking `supported-profile` check.

Use `bottlerAddress` for the label's required bottler, producer, distiller, or importer name-and-address statement, for example `Distilled and bottled by Old Cypress Distillery, Louisville, KY`. Do not put this in `countryOfOrigin`; country origin is only for import-origin statements such as `Product of Canada`.

Request:

```json
{
  "application": {
    "brandName": "Old Cypress Distillery",
    "classType": "Kentucky Straight Bourbon Whiskey",
    "alcoholContent": "45% Alc./Vol.",
    "netContents": "750 mL",
    "bottlerAddress": "Old Cypress Distillery, Louisville, KY",
    "countryOfOrigin": "",
    "beverageKind": "spirits",
    "imported": false,
    "ruleProfile": "ttb-demo"
  },
  "labels": [
    {
      "labelId": "front",
      "fileName": "front.txt",
      "text": "Old Cypress Distillery\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol.\n750 mL"
    }
  ],
  "options": {
    "maxConcurrency": 3
  }
}
```

Response shape:

```json
{
  "results": [
    {
      "labelId": "front",
      "fileName": "front.txt",
      "decision": "approved",
      "score": 100,
      "elapsedMs": 2,
      "summary": "All focused distilled-spirits label fields matched the application.",
      "extraction": {},
      "checks": [],
      "missingApplicationFacts": [],
      "nextSteps": [],
      "workflow": {}
    }
  ],
  "meta": {
    "requestId": "req_...",
    "count": 1,
    "elapsedMs": 2,
    "mode": "text-only-demo"
  }
}
```

### `POST /api/v1/export`

Creates a review packet from client-held verification results. No server persistence required.

Request:

```json
{
  "batch": {
    "batchId": "batch-local-001",
    "results": []
  },
  "format": "json"
}
```

Use `"format": "csv"` for a flat review summary.

## OpenAPI

The machine-readable OpenAPI starter spec lives at [`docs/openapi.json`](openapi.json). Keep it small and explicit so future MCP or workflow-agent wrappers can be generated from it, then refined into semantic tools instead of exposing raw endpoints directly.

Related decision record: [`0004. Expose API, CLI, And OpenAPI As The Tool Surface`](decisions/0004-api-cli-openapi-agent-surface.md).
