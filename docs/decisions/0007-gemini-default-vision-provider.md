# 0007. Use Gemini As The Default Vision Provider

## Status

Accepted for the prototype.

## Context

LabelCheck needs fast image-to-JSON extraction for reviewer uploads and future agent batch jobs. The first OpenAI path was reliable enough to prove the architecture, but local measurements showed a poor latency profile for interactive review:

- Original OpenAI Responses path with larger image payloads was about 6.6 seconds per image.
- Optimized OpenAI `gpt-4.1-nano` with compressed JPEG input usually returned in about 2.0 to 2.6 seconds, but had tail spikes and occasional warning-text instability.
- Optimized OpenAI `gpt-4o-mini` was more stable, but measured about 3.5 to 5.4 seconds per image.
- Gemini `gemini-2.5-flash-lite` with the same compressed fixture measured about 1.7 to 2.1 seconds per image after warmup and returned stable field extraction on the smoke case.
- After the 2026-05-18 timeout regression, a three-fixture candidate sweep found `gemini-3.1-flash-lite` at 3/3 full fixture matches with p95 4143 ms. The previous `gemini-2.5-flash-lite` measured 2/3 full matches with p95 16160 ms in the same sweep.

The app still needs deterministic rules and human review gates because model OCR can vary, especially around statutory warning punctuation, line wraps, glare, blur, and crop quality.

## Decision

Gemini is the default vision provider.

Configuration:

- Default provider: `VISION_PROVIDER=gemini`
- Default Gemini model: `GEMINI_VISION_MODEL=gemini-3.1-flash-lite`
- Accepted Gemini key variables: `GEMINI_API_KEY`, `GEMINI_API_KEY_MAX`, `GEMINI_API_KEY_TURKEY`, or `GOOGLE_API_KEY`
- OpenAI remains available with `VISION_PROVIDER=openai`

The browser continues to compress uploaded and camera images to a bounded JPEG before sending them to the server. The model extracts visible label evidence only. The deterministic rules continue to decide compliance against application facts.

## Consequences

- The default local and production path should hit the sub-3-second-per-image target for normal compressed images after warmup.
- OpenAI stays as a fallback without changing the API contract.
- Health responses expose provider, model, endpoint, and configured status, but never expose secrets.
- Agent and CLI integrations do not need provider-specific behavior; they call the same `/api/v1/*` endpoints.
- Live model claims must still be backed by opt-in eval runs because CI does not call paid model APIs.
