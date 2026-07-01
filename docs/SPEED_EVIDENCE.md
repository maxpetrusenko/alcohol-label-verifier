# Speed Evidence

Read when validating the 5-second review requirement.

Date: 2026-05-14, updated 2026-06-30

## Current Local Evidence

Local server: `http://localhost:3001`

Provider: Gemini, `gemini-3.1-flash-lite`

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
- Guardrail: `VISION_TIMEOUT_MS=12000` plus `VISION_FALLBACK_TIMEOUT_MS=6000` gives current provider latency enough room to complete while still bounding stalled reviewer waits. When the opposite provider key is present, the app retries once with that provider inside the fallback budget.

Direct live provider eval:

- Command: `VISION_PROVIDER=gemini npm run eval:vision -- --limit 10 --out /tmp/labelcheck/vision-model-eval-local-limit10.json`
- Result: 4/10 full fixture matches, 90% field accuracy
- p95 latency: 5139 ms
- Note: this direct eval uses copied PNG fixtures and bypasses the browser compression path, so it is a conservative speed check.

Three-fixture candidate sweep after the timeout regression:

- Gemini `gemini-3.1-flash-lite`: 3/3 full matches, 100% field accuracy, p95 4143 ms
- Gemini `gemini-3-flash-preview`: 2/3 full matches, 67% field accuracy, p95 4430 ms
- Gemini `gemini-2.5-flash-lite`: 2/3 full matches, 72% field accuracy, p95 16160 ms
- Gemini `gemini-2.0-flash-lite`: 0/3 full matches, 11% field accuracy, p95 597 ms
- OpenAI `gpt-4.1-nano`: 3/3 full matches, 100% field accuracy, p95 3646 ms
- OpenAI `gpt-5.4-mini` through Responses: 3/3 full matches, 100% field accuracy, p95 4691 ms
- OpenAI `gpt-5.4-nano` through Responses: 3/3 full matches, 100% field accuracy, p95 5804 ms

Five-fixture mixed model sweep on 2026-06-30:

- Gemini `gemini-flash-lite-latest`: 3/5 full matches, 93% field accuracy, p50 3049 ms, p95 3352 ms, 5/5 under 5 seconds
- Gemini `gemini-3.1-flash-lite`: 3/5 full matches, 93% field accuracy, p50 3506 ms, p95 3939 ms, 5/5 under 5 seconds
- OpenAI `gpt-5.4-mini` through Responses: 3/5 full matches, 93% field accuracy, p50 3980 ms, p95 4508 ms, 5/5 under 5 seconds
- OpenAI `gpt-5.4-nano` through Responses: 3/5 full matches, 93% field accuracy, p50 5500 ms, p95 7272 ms, 0/5 under 5 seconds
- Gemini `gemini-3.5-flash`: 0/5 full matches, 13% field accuracy, p50 4650 ms, p95 7459 ms, 3/5 under 5 seconds
- OpenAI `gpt-4.1-nano`: 1/5 full matches, 83% field accuracy, p50 6766 ms, p95 9875 ms, 1/5 under 5 seconds

Interpretation: keep Gemini `gemini-3.1-flash-lite` as the pinned default to avoid alias drift. The measured fastest alias was `gemini-flash-lite-latest`; teams can opt into it with `GEMINI_VISION_MODEL=gemini-flash-lite-latest`. The measured OpenAI fallback is now `gpt-5.4-mini` through Responses, replacing the older `gpt-4.1-nano` default.

Fallback reliability regression coverage:

- Gemini timeout retries once with OpenAI when `OPENAI_API_KEY` is present.
- Gemini provider errors such as 429/5xx retry once with OpenAI.
- Gemini unreadable JSON retries once with OpenAI.
- If both providers fail and OCR/text evidence is available, the app returns the text-derived extraction with the failure note instead of dropping the reviewer workflow.

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
