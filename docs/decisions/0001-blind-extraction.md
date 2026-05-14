# 0001. Keep Extraction Blind

## Status

Accepted for the prototype.

## Context

The take-home transcript describes routine label review as comparing application facts against visible artwork. It also calls out agent trust, image quality issues, and the need for results fast enough to be useful.

If the model receives expected application facts while reading the label, it can anchor on the answer we hope to find. That makes a demo look better while weakening the evidence trail.

## Decision

The extraction step receives only label evidence: image data, OCR text, file metadata, and extraction options. It does not receive the expected brand, class/type, ABV, net contents, origin, bottler address, or warning text from the application record.

Application facts enter only after extraction, when deterministic rules compare expected facts to observed label evidence.

## Consequences

- The extractor can be treated as a low-trust reader, not a compliance judge.
- Field mismatches remain meaningful because the observed value was not seeded by the expected value.
- Poor image quality should produce low confidence, missing fields, or needs-review evidence instead of hallucinated matches.
- The API contract must keep `/extract` separate from `/verify` semantics even when `/verify` orchestrates both steps internally.
