# LabelCheck V1 presearch flow

Status: restarted presearch/design direction before implementation.  
Primary artifact: [`docs/presearch-labelcheck-v1-flow.html`](./presearch-labelcheck-v1-flow.html)

## Short answer

Build **LabelCheck V1** as a stateless spirits-label discrepancy review cockpit:

1. Reviewer enters application facts.
2. Reviewer uploads or pastes OCR/text for 1–25 labels.
3. Extractor reads visible label evidence.
4. Deterministic rules compare extracted evidence to application facts and source-backed requirements.
5. Reviewer dispositions the result: accept, request correction, override with reason, or SME review.
6. App exports JSON and a Teams-style summary block.

Do **not** build a broad platform yet: no persistence, auth/RBAC, live Teams posting, COLA API integration, PDF export, or 300-label job infrastructure in V1.

## Why this supersedes the earlier docs

Earlier docs described a large future product but still left the actual build unclear. This artifact narrows the app into a concrete screen, loop, API shape, source spine, and TDD sequence.

Read order now:

1. `docs/presearch-labelcheck-v1-flow.html`
2. `docs/TASKS.md`
3. `src/lib/rules.ts` and `src/app/api/verify/route.ts`
4. Older background: `docs/PRODUCT_BLUEPRINT.md`, `docs/SPEC.md`, `docs/PRESEARCH.md`
