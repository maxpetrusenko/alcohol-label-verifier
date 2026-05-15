# 0004. Expose API, CLI, And OpenAPI As The Tool Surface

## Status

Accepted for the prototype.

## Context

The take-home asks for a working prototype, but the product is naturally useful to scripts, agents, benchmark jobs, and future workflow tools. Scraping the browser UI would make those integrations brittle.

## Decision

The browser remains the primary reviewer experience. Machines use the versioned JSON API, a thin CLI wrapper, and the OpenAPI starter spec.

The intended surface is:

- `/api/v1/health` for service checks
- `/api/v1/extract` for blind extraction
- `/api/v1/verify` for extraction plus deterministic verification
- `/api/v1/export` for review packet generation
- `docs/openapi.json` as the compact machine-readable contract
- `labelcheck` CLI as a local and future automation wrapper over the same API

The CLI intentionally accepts the same batch JSON as `/api/v1/verify`, including multiple labels per request, so agents can use it for local batch verification without scraping the browser.

## Consequences

- Agent and workflow integrations depend on structured responses, not DOM shape.
- The API can be wrapped later as MCP tools or workflow-agent actions without changing core behavior.
- New response fields should be additive inside `v1`.
- Errors need stable codes and request IDs before this becomes a public or cross-team API.
- Agents should chunk large jobs at the documented request limit and preserve caller-provided `labelId` values.
