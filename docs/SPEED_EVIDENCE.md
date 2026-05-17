# Speed Evidence

Read when validating the 5-second review requirement.

Date: 2026-05-14, updated 2026-05-16

## Current Local Evidence

Local server: `http://localhost:3001`

Provider: Gemini, `gemini-2.5-flash-lite`

Text fallback API run:

- Endpoint: `POST /api/verify`
- Fixture: default demo text label
- Result: approved, score 100
- Wall time: 38 ms
- API elapsed: 4 ms

Compressed image API run, matching the browser upload path:

- Fixture: `public/evals/fixtures/spirits-generated-canonical/01-pass-01.png`, compressed to 512 x 768 JPEG
- Result: approved, score 100
- Three wall-clock runs: 3019 ms, 1673 ms, 1550 ms
- Three API elapsed runs: 2978 ms, 1664 ms, 1543 ms

Demo-fail image API run after disabling Gemini 2.5 thinking and adding bounded provider timeouts:

- Fixture: `public/evals/fixtures/spirits-generated-canonical/06-warning-sneaky-01.png`
- Result: rejected, score 83, government-warning issue detected
- Browser-compressed wall-clock probe: 2874 ms
- Browser-compressed API elapsed: 2493 ms
- Guardrail: `VISION_TIMEOUT_MS=2500` plus `VISION_FALLBACK_TIMEOUT_MS=1500` prevents stalled provider calls from producing 20-30 second reviewer waits. When the opposite provider key is present, the app retries once with that provider inside the fallback budget.

Direct live provider eval:

- Command: `VISION_PROVIDER=gemini npm run eval:vision -- --limit 10 --out /tmp/labelcheck/vision-model-eval-local-limit10.json`
- Result: 4/10 full fixture matches, 90% field accuracy
- p95 latency: 5139 ms
- Note: this direct eval uses copied PNG fixtures and bypasses the browser compression path, so it is a conservative speed check.

## Deployed URL Check

Live URL: `https://cola.maxpetrusenko.com`

Health check:

- `GET /api/health`
- Result: healthy
- Production provider at check time: Gemini, `gemini-2.5-flash-lite`
- `vision.configured`: `true`
- `vision.mode`: `vision+rules`
- `langsmith.configured`: `true`
- `langsmith.tracingEnabled`: `true`
- `braintrust.configured`: `true`
- `braintrust.tracingEnabled`: `true`

Live CLI smoke against the currently deployed app:

```bash
npm run demo:cli -- --base-url https://cola.maxpetrusenko.com --no-start
```

Result:

- Health: `ok=true`, `vision=vision+rules`
- Decisions: `{"approved":1,"rejected":1,"needs_review":1}`
- Export: generated `verify-input.json`, `verify-output.json`, and `review-packet.csv` in a temp directory

Live image API probe against the currently deployed app:

- Fixture: uncompressed `01-pass-01.png`
- Three wall-clock runs: 11666 ms, 7545 ms, 8370 ms
- Decisions: rejected, approved, rejected
- Note: this old direct probe used uncompressed fixture PNGs and predates the current Coolify image tag fix. Use the browser-compressed path or `npm run demo:cli` for current reviewer/agent smoke checks.

## Interpretation

The local implementation meets the "about 5 seconds" target for normal reviewer usage when the browser compression path is used. Gemini 2.5 thinking is disabled for extraction, and stalled provider calls either retry once with the fallback provider or time out before the UI can wait 20-30 seconds. Agents can verify the deployed API without UI scraping through `npm run demo:cli -- --base-url https://cola.maxpetrusenko.com --no-start`.
