# Next Options: Government App + Teams Collaboration

## Office-hours diagnosis

### Demand reality

The core risk is not whether AI can compare labels. It can. The question is whether a specific agency workflow owner has enough pain, budget path, and security path to run a pilot.

The app should stay framed as a **review assistant / discrepancy detector**, not an autonomous approval engine. For government, defensibility beats magic.

### Status quo

Reviewers likely compare submitted artwork against application records manually inside existing systems of record. Those systems already own identity, record retention, audit, and workflow. Direct integration is expensive and should not be the first move.

### Narrowest wedge

**Shadow-mode label discrepancy assistant for one review team.**

Scope:

- Application record + label image/OCR input.
- Check only high-confidence mandatory fields.
- Show evidence cards with expected, observed, status, rationale, and rule references.
- Let the human reviewer make the final call.
- No long-term storage by default.
- No COLA/system integration until pilot evidence exists.

## Ranked paths forward

### Option 1 — Agency shadow pilot

Best if there is actual access to reviewers or a sponsor.

Build a tight pilot for one review team using anonymized/historical labels. Measure time saved and false-pass rate.

Decision gates:

- 5–10 reviewer/supervisor interviews confirm this is top-3 pain.
- 50–100 historical/anonymized labels available.
- Shadow test shows at least 30% time savings on target fields.
- Zero critical false-pass cases in the pilot set.
- IT/security confirms a plausible approved model-hosting path.

Verdict: **Best path if agency access exists.**

### Option 2 — Industry pre-submission checker

Best if government access/procurement is slow.

Position it for importers, wineries, breweries, counsel, or compliance consultants to catch issues before TTB submission.

Decision gates:

- 10 regulated producers/importers interviewed.
- 3–5 agree to test with real labels.
- Users would pay to reduce rejections/resubmissions.
- Tool catches issues users actually miss today.

Verdict: **Faster learning, less procurement drag, less direct government wedge.**

### Option 3 — Full federal production app / COLA integration

Do later.

Requires RBAC, audit logs, retention, ATO/security architecture, FedRAMP-compatible hosting, model governance, admin review, procurement vehicle, and integration funding.

Decision gates:

- Successful shadow pilot with quantified ROI.
- Named executive sponsor.
- Budget/procurement vehicle identified.
- Security architecture accepted.
- Integration requirements documented and funded.

Verdict: **Do not start here. It is the slowest way to die before proving demand.**

## Teams / internal collaboration options

Ambiguity: “teams inside” could mean Microsoft Teams or internal agency teams. The spec supports both as staged options.

### Lightweight now

- Export JSON/CSV/PDF review packet.
- Copy formatted summary block for Teams chat.
- Manual attach/share by reviewer.

### Pilot later

- Disabled-by-default `POST /api/integrations/teams/summary`.
- Requires environment flag and tenant-approved credentials.
- Posts only summary metadata, not raw label images.

### Full workflow later

- Case assignments.
- SME escalation queue.
- Supervisor review.
- Audit timeline.
- Integration with agency identity and system of record.

## Recommended immediate move

Run a 2-week discovery + benchmark sprint:

1. Interview reviewers, supervisors, IT/security, procurement separately.
2. Collect a small historical/anonymized label set.
3. Freeze a spec before coding.
4. Add failing tests for tricky labels first.
5. Implement only enough to measure time saved and false-pass rate.
6. Keep the product non-authoritative: it flags discrepancies; humans decide.
