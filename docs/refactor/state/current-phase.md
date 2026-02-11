# Current Phase

- Phase: `Phase 2 — View manager decomposition`
- Status: `Completed`
- Scope:
  - Complete service extraction for quick prompt and pane view lifecycle orchestration.
  - Continue reducing `ViewManager` into coordinator-only responsibilities.
  - Preserve current runtime behavior while migrating responsibilities to services.
- Invariants:
  - No cross-layer forbidden imports.
  - No behavior changes outside CLIP scope adjustments.
- Next actions:
  1. Start `Phase 3 — Runtime migration` with `3.C.01` prompt sync controller extraction.
  2. Add manager-level integration coverage for quick prompt + pane view service wiring.
  3. Continue refreshing `resume-pack.*` and verification artifacts after each refactor slice.
