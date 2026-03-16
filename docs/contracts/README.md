# Contracts

This folder holds formal contracts, rules, and quality standards for cross-cutting concerns. Use them when implementing or changing behavior so that consistency and quality are maintained.

**Audit log:** [AUDIT_LOG_CONTRACT.md](./AUDIT_LOG_CONTRACT.md) is the enforced standard for all new or changed audit logging. [AUDIT_LOG_CALL_SITES_NOT_COMPLIANT.md](./AUDIT_LOG_CALL_SITES_NOT_COMPLIANT.md) tracks call sites not yet compliant (backlog). For how AI and contributors must work with contracts and tests, see [AGENTS.md](../../AGENTS.md) in the repo root.

| Document                                                                                   | Purpose                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [AUDIT_LOG_CONTRACT.md](./AUDIT_LOG_CONTRACT.md)                                           | Audit log entry shape, required data, quality rules, and examples. Use when adding or changing audit logging.                                                                        |
| [AUDIT_LOG_CALL_SITES_NOT_COMPLIANT.md](./AUDIT_LOG_CALL_SITES_NOT_COMPLIANT.md)           | Status of audit log call sites; all previously listed sites have been fixed to satisfy the contract.                                                                                 |
| [SCHEDULE_SEMANTICS_CONTRACT.md](./SCHEDULE_SEMANTICS_CONTRACT.md)                         | Invariants for Weekly/Baseline Schedule: baseline + overlays, status consistency, commit/cancel, no partial writes, conflict handling.                                               |
| [ASSIGN_SUB_CONFLICT_RESOLUTION_CONTRACT.md](./ASSIGN_SUB_CONFLICT_RESOLUTION_CONTRACT.md) | Assign Sub conflict types (conflict_sub, conflict_teaching, replace, remove), resolution options, database update logic, and invariant rules (one sub per shift, floater exception). |
