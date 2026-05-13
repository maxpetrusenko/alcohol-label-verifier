# LabelCheck V1 task plan

Reference first: [`docs/presearch-labelcheck-v1-flow.html`](./presearch-labelcheck-v1-flow.html)

## V1 product target

A stateless spirits-label discrepancy review cockpit. One review session, 1–25 labels, evidence-backed rule findings, human disposition, JSON/export summary. No persistence or live integrations.

## Phase 0 — reset docs/source of truth

- [x] Create buildable presearch flow artifact: `docs/presearch-labelcheck-v1-flow.html`.
- [x] Add markdown pointer: `docs/presearch-labelcheck-v1-flow.md`.
- [ ] Update README to make this the first doc.
- [ ] Keep older docs as background only; do not implement them wholesale.

## Phase 1 — TDD rule contract

- [ ] Add failing test: every check includes `requirementRef`.
- [ ] Add failing test: every check includes `severity`.
- [ ] Add failing test: low extraction confidence prevents `approved`.
- [ ] Add failing test: spirits ABV mismatch is blocking.
- [ ] Add failing test: government warning text pass does not imply layout pass.
- [ ] Implement minimal rule/type changes.
- [ ] Run `npm run test` and `npm run lint`.

## Phase 2 — API contract and extraction safety

- [ ] Add `src/lib/schemas.ts` and move Zod schemas out of route.
- [ ] Add `src/lib/extract.ts` for text fallback and guarded OpenAI extraction.
- [ ] Add route tests for malformed payloads and malformed model JSON.
- [ ] Add per-label failure isolation: one bad label should not fail the batch.
- [ ] Add stable `batchId` and `labelId` in response.
- [ ] Sanitize model errors before returning notes.

## Phase 3 — export/disposition model

- [ ] Add `src/lib/exportPacket.ts`.
- [ ] Add reviewer disposition type: `accept`, `request_correction`, `override`, `sme_review`.
- [ ] Add JSON export packet generation.
- [ ] Add Teams-style copy summary generator; copy only, no live post.

## Phase 4 — cockpit UI

- [ ] Split `src/app/page.tsx` into components:
  - `ApplicationPanel`
  - `LabelBatchQueue`
  - `EvidenceViewer`
  - `FindingsPanel`
  - `DispositionBar`
  - `ExportDrawer`
- [ ] Replace marketing hero with internal review shell.
- [ ] Add queue statuses: queued, extracting, checking, completed, failed, needs_review.
- [ ] Add selected-label detail view.
- [ ] Add source chips and confidence labels.
- [ ] Add disposition buttons and reason/note field.
- [ ] Add export JSON and copy summary actions.

## Phase 5 — verification

- [ ] `npm run test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Browser-submit demo data.
- [ ] Check console errors.
- [ ] Verify mobile/tablet/desktop widths.
- [ ] Commit.
