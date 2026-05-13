# Product Blueprint + Research Audit: LabelCheck Agent

Date: 2026-05-12
Status: corrective v2 after review

## Blunt assessment

The previous research/spec was a useful start, but it was not yet the thing Max asked for.

Score: **6/10 as presearch**, **4/10 as product definition**.

Why:

- It captured the main wedge: compare submitted label artwork against application data and mandatory label requirements.
- It cited the right broad regulatory surface: TTB/CFR mandatory fields, health warning, commodity differences, human final judgment.
- It did **not** make the product feel like an **agent**. It read like a simple upload-and-check app.
- It did **not** make the end-to-end flow obvious enough: case intake, batch queue, evidence extraction, rule graph, human disposition, audit/export.
- It mentioned batch processing, but the existing implementation only accepts an array in one request. That is not credible for 200–300-label importer spikes.
- It did not enumerate enough edge cases or acceptance tests tied to each user story.
- It did not produce real design mockups until this corrective pass.
- Wiki was not used in the first pass. It should have been used for compounding research and design patterns.

## Was this based on a research skill?

First pass: **no, not properly**.

It was based on ad-hoc source scanning plus repo inspection. That is not enough for this task. This corrective pass used:

- `data-research` discipline: source-first, structured extraction, raw/provenance notes.
- `llm-wiki` discipline: orient wiki, search before write, capture durable source/analysis.
- `claude-design` + `popular-web-designs`: make design artifacts, not just prose.
- `architecture-diagram`: explicit system diagrams.

## Official source anchor used in this pass

Regulatory references pulled from eCFR API snapshots dated 2026-05-01:

- 27 CFR Part 16 — health warning statement and legibility requirements.
- 27 CFR § 16.21 — exact required Government Warning text.
- 27 CFR § 16.22 — legibility, contrast, `GOVERNMENT WARNING` capitalization/bold, type-size rules.
- 27 CFR § 4.32 — wine mandatory label information.
- 27 CFR §§ 4.35–4.37 — wine name/address, alcohol content, net contents.
- 27 CFR § 5.63 — distilled spirits mandatory label information.
- 27 CFR §§ 5.65–5.70 — spirits alcohol content, name/address, importer/origin, net contents.
- 27 CFR § 7.63 — malt beverage mandatory label information.
- 27 CFR §§ 7.65–7.70 — malt alcohol content, name/address, importer/origin, net contents.

## What we are actually building

**LabelCheck Agent** is a human-in-the-loop discrepancy detection agent for alcohol label review.

It is not a final approval system. It is not direct COLA replacement. It is a reviewer cockpit that runs an agentic pipeline:

1. **Case intake**
   - Reviewer enters/imports an application record.
   - Reviewer uploads one label, many labels, or multiple panels for the same SKU.
   - Reviewer selects/derives commodity profile: spirits, wine, malt beverage, other.

2. **Batch orchestration**
   - System creates a batch ID.
   - Each label becomes an independent job with status, retry count, elapsed time, extractor mode, and error isolation.
   - 200–300 labels are processed through a queue/concurrency pool, not one giant all-or-nothing request.

3. **Extractor agent**
   - Model/OCR extracts visible fields only.
   - Output includes confidence, notes, and evidence spans where possible.
   - The model is not allowed to decide compliance. It reads.

4. **Rule graph**
   - Commodity-aware deterministic rules compare extracted evidence against application data and CFR/TTB references.
   - Each rule returns status, severity, expected, observed, rationale, and requirement reference.
   - Low confidence cannot become clean approval.

5. **Discrepancy agent**
   - Groups failures into reviewer-useful buckets: missing mandatory field, mismatch, low confidence, formatting/layout risk, import/origin issue, needs SME.
   - Drafts a plain-English reviewer note/applicant response, explicitly marked as draft.

6. **Human disposition**
   - Reviewer accepts recommendation, overrides with reason, or escalates to SME.
   - Override is structured: reason code + note.

7. **Audit/export**
   - Export contains application data, label metadata, extracted fields, rule checks, citations, model mode, timestamps, reviewer disposition.
   - Raw image bytes are excluded by default unless retention is explicitly approved.

## Agent architecture logic

The architecture should be framed as an **agent in a controlled web UI**, not a generic web app:

```text
Application record + label images
        ↓
Batch Orchestrator
        ↓
Extractor Agent: vision/OCR → normalized evidence spans
        ↓
RuleGraph: CFR/TTB requirement checks by commodity/profile
        ↓
Discrepancy Agent: group issues + propose reviewer note
        ↓
Reviewer Cockpit: final human disposition + SME escalation
        ↓
Audit Packet / Teams summary / benchmark metrics
```

Core separation of concerns:

- **Extractor**: probabilistic, best-effort, low-trust.
- **Normalizer**: deterministic string/unit/case normalization.
- **RuleGraph**: deterministic compliance logic with citations.
- **Discrepancy summarizer**: language layer, never authoritative.
- **Reviewer**: final decision authority.
- **Audit packet**: durable, inspectable evidence of what happened.

## User stories coverage audit

### US-01: Reviewer checks one label against an application

Status: **partially satisfied**.

Current support:
- UI accepts application fields and label/text input.
- API returns per-field checks.

Missing:
- requirement references on every check.
- final reviewer disposition controls.
- low-confidence gating.
- exportable packet.

Acceptance criteria:
- Given one valid label, reviewer sees extracted fields, expected/observed values, rule refs, status, and final disposition controls.
- Approved recommendation requires no blocking failures and no low-confidence extractor warning.

### US-02: Reviewer processes 200–300 labels during importer spikes

Status: **not satisfied**.

Current support:
- API accepts array of up to 25 labels in one request.

Missing:
- persistent or session-local batch ID.
- queue/concurrency model.
- per-label progress.
- retry/resume.
- partial failure isolation.
- CSV/JSON summary export.

Acceptance criteria:
- Batch creation returns `batchId` immediately.
- Labels process independently with statuses: `queued`, `extracting`, `checking`, `needs_review`, `failed`, `completed`.
- One extractor failure does not fail the batch.
- UI can filter by blocking failures, warnings, low confidence, completed.

### US-03: Reviewer understands why a label failed

Status: **partially satisfied**.

Current support:
- evidence cards show expected/observed/rationale.

Missing:
- regulatory citation chips.
- issue grouping.
- source panel/field localization.
- applicant-response draft.

Acceptance criteria:
- Every failed/warning rule cites CFR section or configured policy rule.
- Failure summary is actionable without reading all raw OCR text.

### US-04: Supervisor/SME reviews escalation

Status: **not satisfied**.

Missing:
- SME queue.
- reason codes.
- reviewer notes.
- timeline.
- copy-to-Teams/export path.

Acceptance criteria:
- Reviewer can mark a label `SME review` with note.
- SME sees only escalated labels and all supporting evidence.

### US-05: Product owner/security reviewer audits the tool

Status: **not satisfied**.

Missing:
- request/batch identifiers.
- structured logs.
- model mode/model version.
- sanitized errors.
- retention boundaries documented in UI/export.

Acceptance criteria:
- Export packet proves what was checked, when, how, by what model/rule version, and by whom.

### US-06: Non-technical reviewer can use it without hunting

Status: **partially satisfied**.

Current support:
- simple page and visible run button.

Missing:
- workflow navigation.
- batch progress mental model.
- guided errors.
- review queue UX.

Acceptance criteria:
- Primary path is visible above the fold: import application → upload labels → run batch → review flagged labels → export.

## Required edge cases and tests

### Regulatory/product edge cases

- Wine ≤14% ABV where alcohol content may be optional if `table/light wine` designation applies.
- Wine >14% ABV where alcohol content must be stated.
- Distilled spirits ABV required; proof may appear but ABV is mandatory.
- Malt beverage alcohol statement may be optional/federal-profile-dependent except where required by state/rule profile or nonbeverage alcohol ingredients.
- Imported spirits/malt: `imported by` name/address and country-of-origin marking expectations.
- Domestic vs imported vs bottled-after-importation wording differences.
- Net contents allowed units differ across wine/spirits/malt.
- Blends/import-origin percentage claims.
- FD&C Yellow No. 5, cochineal/carmine, sulfites, aspartame declarations where relevant.
- Government warning exact text present but wrong capitalization/formatting.
- Government warning text present but not separate/apart from other info.
- Government warning too small/low contrast/compressed — production needs layout-aware check; prototype must flag as unverified if no bounding boxes.
- Brand name differs by apostrophe, punctuation, DBA, vintage/cuvée line, or trademark mark.
- Class/type synonyms and regulated terms: bourbon vs whiskey, lager vs malt beverage, table wine vs red wine.
- Net contents OCR ambiguity: `750 mL` vs `750 ML`, `1 L` vs `1.0L`, `25.4 fl oz` secondary statement.
- ABV/proof arithmetic mismatch: `45% Alc./Vol.` vs `90 proof` should reconcile; `45%` vs `80 proof` should fail.

### Document/image edge cases

- Multiple panels for same SKU: front/back/neck uploaded separately.
- One image contains multiple labels or cartons.
- Curved bottle glare and skew.
- Low-resolution label.
- Hand-drawn/compressed mockup.
- Non-English/international label with English mandatory warning sticker.
- Missing label image but pasted OCR text.
- Duplicate files in one batch.
- Unsupported MIME or huge data URL.
- Model returns malformed JSON.
- Model extracts a field not visible on the label.
- Model confidence low or no evidence span.
- Network/API failure mid-batch.

### Workflow/security edge cases

- 300-label batch where 20 fail extraction.
- Reviewer overrides a blocking failure.
- Export requested before batch complete.
- Teams summary attempted while integration disabled.
- Raw model error contains sensitive provider info — must sanitize.
- User refreshes page mid-batch.
- No API key configured.
- FedRAMP/government network blocks outbound model calls.

## Bells and whistles that actually matter

Priority order:

1. **Batch queue with filters**: flagged only, low confidence, failed extraction, completed.
2. **Requirement citation chips**: CFR/TTB section on every rule.
3. **Evidence spans**: show exact extracted text; bounding boxes later if extractor supports it.
4. **Reviewer disposition panel**: accept, reject, SME review, override reason.
5. **Audit/export packet**: JSON first, CSV summary second, PDF later.
6. **Teams-ready copy block**: no raw image bytes, just batch/label/status/issues/link/export.
7. **Rule profile selector**: `ttb-demo`, `ttb-spirits`, `ttb-wine`, `ttb-malt`, future state overlays.
8. **Benchmark harness**: fixtures and false-pass tracking.
9. **Applicant response draft**: generated from deterministic failures, never from hidden model judgment.
10. **Rule library/admin view**: versioned rules and examples.

Avoid fake bells:

- Generic dashboards with made-up metrics.
- Animated AI sparkle loader.
- Final “approved” language without human disposition.
- Chatbot UI as primary surface. This needs queue/evidence/review, not chat theatre.

## Proposed web UI surfaces

### Surface 1: Batch Intake

Purpose: create a review batch.

Fields:
- Application record: brand, class/type, beverage kind, ABV/proof, net contents, bottler/importer, origin, permit/applicant optional.
- Rule profile selector.
- Label upload area supporting multiple files and panel tags.
- Batch constraints: max labels, max payload, supported MIME.

### Surface 2: Batch Queue

Purpose: survive high-volume review.

Elements:
- Batch summary bar: total, passed, failed, warning, low confidence, extraction errors.
- Table/list of labels with status chips.
- Filters by status/severity/commodity/rule.
- Retry failed extraction.
- Export visible/selected labels.

### Surface 3: Evidence Review

Purpose: decide one label.

Layout:
- Left: label image/panel preview and OCR/extraction text.
- Middle: rule checks grouped by requirement.
- Right: final disposition + reviewer notes + applicant response draft.

### Surface 4: Rule Library

Purpose: explain and version logic.

Elements:
- Rule profiles by commodity.
- CFR/TTB citation per rule.
- Test fixtures/examples.
- Rule version and last reviewed date.

### Surface 5: Export / Collaboration

Purpose: hand off without full integration.

Elements:
- JSON export.
- CSV summary.
- Teams copy block.
- Optional future integration toggle disabled by default.

## Implementation plan, TDD-first

### Phase 0: Freeze product definition

- Add this blueprint and the design artifact.
- Decide: agency shadow pilot vs industry pre-submission checker.
- Pick a first benchmark fixture set.

### Phase 1: Rule model and tests

Create/extend:

- `src/lib/ruleProfiles.ts`
- `src/lib/ruleProfiles.test.ts`
- `src/lib/batchTypes.ts`
- `src/lib/exportPacket.ts`
- fixtures under `src/test/fixtures/labels/`

Tests first:

- commodity required fields.
- ABV/proof reconciliation.
- health warning exactness and unverified layout warning.
- low-confidence gating.
- per-rule `requirementRef` and `severity`.

### Phase 2: Batch API contract

Add session-local or stateless prototype endpoints:

- `POST /api/batches` → creates batch response with `batchId` and queued labels.
- `POST /api/batches/verify` → prototype batch execution if avoiding persistence.
- `GET /api/batches/:id` → only if persistence/session store is introduced.
- `POST /api/export` → review packet export.

If no persistence is desired, keep batch state client-side but still model every label as a job object.

### Phase 3: Reviewer cockpit UI

Replace single form feel with four panels:

- intake drawer/top section.
- batch queue left rail/table.
- evidence review center.
- disposition/export right rail.

### Phase 4: Designs and benchmark artifacts

- Keep `docs/product-blueprint-designs.html` as the living design/review surface.
- Add fixture result screenshots once UI exists.
- Export benchmark summary after every fixture run.

## Decision needed before coding v2

Pick the initial wedge:

1. **Agency shadow pilot** — stronger if we have reviewer access and historical labels.
2. **Industry pre-submission checker** — faster external learning and easier data access.

Default recommendation: build the same core engine, but design copy around **shadow-mode discrepancy assistant**. That keeps it acceptable for government and still usable by industry.
