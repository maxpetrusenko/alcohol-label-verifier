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

## CLI

The CLI is a thin HTTP client over `/api/v1/*`.

```bash
LABELCHECK_BASE_URL=http://localhost:3000 labelcheck health
labelcheck verify input.json
labelcheck extract label.png
labelcheck export verify-response.json --format json
labelcheck export verify-response.json --format csv
```

For local development without installing the package:

```bash
node bin/labelcheck.mjs health
```

## Endpoints

### `GET /api/v1/health`

Returns:

```json
{
  "ok": true,
  "service": "alcohol-label-verifier",
  "vision": {
    "configured": false,
    "mode": "text-only-demo",
    "model": "gpt-4.1-mini"
  }
}
```

Use `vision.configured` to verify local or production secret wiring without exposing `OPENAI_API_KEY`.

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
