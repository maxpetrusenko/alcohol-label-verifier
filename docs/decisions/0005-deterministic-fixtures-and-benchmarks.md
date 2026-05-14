# 0005. Use Deterministic Fixtures And Benchmarks

## Status

Accepted for the prototype.

## Context

The assignment encourages additional test labels and values clean engineering over incomplete ambition. The transcript also gives concrete adoption constraints: simple reviews should feel fast, and batch spikes matter.

The presearch found useful generated fixture pairs: label artwork, source application facts, and expected outcomes.

## Decision

Fixture generation and benchmark runs should be deterministic wherever possible. Generated label fixtures are treated as a repeatable eval corpus, not just demo decoration.

The benchmark path should measure:

- rule correctness on known pass, mismatch, warning, and needs-review cases
- per-label isolation in batch requests
- elapsed time for common local demo paths
- gaps between expected fixture outcome and current rule result

## Consequences

- `npm run eval:fixtures` can be used as a lightweight regression signal.
- New edge cases should become fixtures or tests when practical.
- Vision-model behavior may vary, so deterministic text fallbacks remain important for CI and local review.
- Benchmark output should identify false passes and false blocks before adding broader rule scope.
