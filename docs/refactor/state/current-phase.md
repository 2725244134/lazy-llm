# Current Phase

- Phase: `Phase 2 — View manager decomposition`
- Status: `In Progress`
- Scope:
  - Complete service extraction for pane lifecycle orchestration.
  - Continue reducing `ViewManager` into coordinator-only responsibilities.
  - Preserve current runtime behavior while migrating responsibilities to services.
- Invariants:
  - No cross-layer forbidden imports.
  - No behavior changes outside CLIP scope adjustments.
- Next actions:
  1. Finalize `2.B.06` by removing remaining direct orchestration details from `manager.ts`.
  2. Add manager-level integration coverage for newly wired services.
  3. Refresh state artifacts after each refactor slice (`resume-pack.*`, `progress-ledger`, `verification-ledger`).
