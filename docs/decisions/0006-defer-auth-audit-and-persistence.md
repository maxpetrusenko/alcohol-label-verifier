# 0006. Defer Auth, Audit Logs, And Persistence For The Prototype

## Status

Accepted for the prototype.

## Context

The IT transcript explicitly frames this as a standalone proof of concept, not a COLA integration. It also notes that production deployment would require government security, retention, authorization, and network review.

Building full identity, audit logging, storage, and retention now would consume prototype time without proving the core product loop.

## Decision

The prototype is stateless by default:

- no user accounts
- no RBAC
- no server-side upload storage
- no long-term result storage
- no live COLA integration
- no production audit-log system

It still produces exportable review packets so a reviewer can preserve evidence outside the app during demo and evaluation.

## Consequences

- Local and demo runs avoid unnecessary sensitive-data handling.
- Production readiness requires a later security decision covering identity, audit logs, retention, deletion, encryption, hosting, and approved model access.
- Export packets are the prototype audit substitute, not a compliance-grade audit trail.
- Any future persistence feature must define retention and access controls before storing label images or reviewer decisions.
