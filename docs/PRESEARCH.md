# Presearch: AI-Powered Alcohol Label Verification App

## Extracted requirements

- Standalone proof-of-concept, not direct COLA integration.
- Upload label artwork and compare visible label fields against application data.
- Core checks: brand name, class/type, alcohol content, net contents, bottler/producer, country of origin where applicable, and mandatory Government Health Warning.
- UX must be obvious for mixed technical comfort levels; no hunting for buttons.
- Target response time: about 5 seconds for a normal label.
- Batch upload matters for importer spikes of 200–300 labels.
- Do not overbuild: working core with clean code beats ambitious incomplete features.

## Source scan notes

- TTB public guidance confirms common mandatory label elements vary by commodity but include brand/class/type, alcohol content in many cases, net contents, origin/import details, and Government Health Warning.
- The standard health warning is exact-wording sensitive. The prototype treats missing/non-exact warning text as a hard compliance risk.
- Vision model APIs can accept image inputs as URLs or base64 data URLs. For a prototype, using a multimodal extractor plus deterministic rule checks is faster and clearer than building OCR/layout models locally.
- Tesseract.js is useful as a browser/local fallback but is not ideal as the only extractor for curved/glare/angled bottles; multimodal extraction is the better wedge.

## Architecture decision

Use a Next.js app with:

1. Client UI for application data + single/batch label upload.
2. `/api/verify` route handler for server-side extraction and rules.
3. Optional OpenAI vision extraction when `OPENAI_API_KEY` is present.
4. Text-only fallback so reviewers can test the workflow without credentials or outbound model access.
5. Deterministic compliance rules in `src/lib/rules.ts` with Vitest coverage.

## Agent behavior

The app is intentionally framed as a review assistant, not an auto-approver. It returns:

- decision: `approved`, `needs_review`, or `rejected`
- score
- per-field evidence cards
- expected vs observed text
- rationale for every check

That gives Sarah/Jenny speed and gives Dave a visible judgment surface instead of a black box. Tiny bit radical: earn trust by showing your work. Bureaucracies like receipts.

## Production caveats

- Real deployment would need retention controls, audit logs, role-based access, FedRAMP-approved model path, and threat modeling.
- For blocked government networks, model calls need an approved Azure/OpenAI endpoint or local OCR+vision fallback.
- Exact formatting checks for bold/all-caps warning need layout-aware extraction or image region inspection; this prototype checks text exactness and all-caps prefix.
