# 0003. Keep Humans In The Loop And Avoid Auto-Denial

## Status

Accepted for the prototype.

## Context

The transcript makes the product target clear: help compliance agents move faster through routine matching, without replacing their judgment. Dave's example of obvious capitalization differences is the key caution: not every technical mismatch should become an automatic adverse action.

## Decision

LabelCheck returns system findings and recommendations, but the final disposition belongs to a human reviewer.

The UI and export model should preserve a separate reviewer disposition such as accept, request correction, override, or SME review. A deterministic rule failure can recommend rejection or correction, but it is not itself an official denial.

## Consequences

- The prototype should avoid copy that implies guaranteed compliance or final legal authority.
- Mismatches should include enough evidence for a reviewer to agree, override, or escalate.
- Override reasons and notes are part of the product model, even without long-term persistence.
- Low confidence extraction should route to review rather than pretending the system knows.
