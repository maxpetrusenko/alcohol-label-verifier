# Speed Evidence

Read when validating the 5-second review requirement.

Date: 2026-05-14

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

- Fixture: `public/evals/fixtures/generated/01-pass-01.png`, compressed to 512 x 768 JPEG
- Result: approved, score 100
- Three wall-clock runs: 3019 ms, 1673 ms, 1550 ms
- Three API elapsed runs: 2978 ms, 1664 ms, 1543 ms

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
- Production provider at check time: OpenAI, `gpt-4.1-mini`
- Health request wall time: 443 ms

Live image API probe against the currently deployed app:

- Fixture: uncompressed `01-pass-01.png`
- Three wall-clock runs: 11666 ms, 7545 ms, 8370 ms
- Decisions: rejected, approved, rejected
- Conclusion: the current deployed app is healthy but not current with the local Gemini/default-provider implementation and should be redeployed before final handoff.

## Interpretation

The local implementation meets the "about 5 seconds" target for normal reviewer usage when the browser compression path is used. The deployed URL needs a fresh deploy and another speed probe before submission.
