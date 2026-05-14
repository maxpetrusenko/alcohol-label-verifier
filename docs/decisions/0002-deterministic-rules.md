# 0002. Use Deterministic Rules For Compliance Findings

## Status

Accepted for the prototype.

## Context

Stakeholders described much of label review as matching visible label facts to application facts, while still preserving human judgment for nuance. The assignment also asks for attention to correctness and requirements, not a black-box model answer.

## Decision

Compliance findings are produced by deterministic TypeScript rules. The model may extract visible evidence, but it does not decide whether a field passes, fails, or needs review.

Rules compare normalized expected and observed values for the prototype scope:

- brand name
- class/type
- alcohol content and proof
- net contents
- Government Health Warning text
- optional bottler/producer address
- optional country of origin

## Consequences

- The same input should produce the same result in tests, demos, and local runs.
- Rules can carry requirement references, severity, and rationale without relying on prompt wording.
- Reviewer-facing output can show expected value, observed value, status, and evidence.
- Model upgrades should improve extraction quality, not silently change compliance policy.
