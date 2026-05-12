# Design Directions

Design source: gstack/popular web designs catalog. The goal is an internal compliance product that feels trustworthy, accessible, evidence-heavy, and calm. Avoid startup glitter.

## Recommended visual stack

### 1. IBM / Carbon-inspired agency operations console

Use this as the default direction for the main reviewer product.

Why it fits:

- Structured, restrained, enterprise-grade.
- Strong accessibility expectations.
- Works well for queues, evidence panels, status tags, audit timelines, and final determination controls.
- Feels official without needing fake government chrome.

Borrow:

- Neutral gray surfaces.
- Blue primary action color.
- 8px spacing grid.
- Dense but legible tables.
- Flat cards and clear semantic states.

Build next:

- Review queue.
- Split-screen label evidence review.
- Determination panel: accept, reject, needs information, SME review.
- Audit timeline.
- Status tags for missing statement, mismatch, low confidence, passed.

Risks:

- Can feel too corporate/IBM if copied literally.
- Dense tables need careful spacing for non-technical reviewers.

## 2. HashiCorp-inspired compliance control plane

Use for admin, rule management, and operational views.

Why it fits:

- Good for controlled systems, permissioned workflows, and versioned rules.
- Clean internal-tool feel.
- Maps naturally to compliance-domain taxonomy.

Borrow:

- Light control-plane shell.
- Compact rule cards.
- Versioned resources.
- Role/permission patterns.
- Subtle category accents.

Build next:

- Rule library.
- Rule-version detail view.
- Batch operations panel.
- Role and permission UI.
- Policy mapping panel.

Risks:

- Too much category color will make compliance status harder to read.
- Technical control-plane language needs plain-English helper copy.

## 3. Mintlify-inspired evidence and guidance layer

Use for explainability and reviewer education.

Why it fits:

- Reading-optimized.
- Good for rule citations, examples, guidance drawers, and evidence cards.
- Makes complex regulatory logic understandable.

Borrow:

- Clean documentation-like layout.
- Inline guidance cards.
- Citation chips.
- Searchable policy/help center patterns.
- Calm progressive disclosure.

Build next:

- Evidence explanation cards.
- Rule guidance side drawer.
- Applicant response preview.
- Help/policy center.
- CFR/TTB citation components.

Risks:

- Too much whitespace hurts high-throughput review queues.
- Startup-doc gradients should be muted or removed.

## Practical recommendation

- Core reviewer app: **IBM/Carbon-inspired**.
- Rule/admin/control-plane: **HashiCorp-inspired**.
- Evidence/guidance/citations: **Mintlify-inspired**.

This hybrid keeps the app credible for government users while preserving the product clarity of modern internal tools.
