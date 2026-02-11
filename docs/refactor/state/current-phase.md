# Current Phase

- Phase: `Phase 2 — View manager decomposition`
- Status: `In Progress`
- Scope:
  - Complete service extraction for quick prompt and pane view lifecycle orchestration.
  - Continue reducing `ViewManager` into coordinator-only responsibilities.
  - Preserve current runtime behavior while migrating responsibilities to services.
- Invariants:
  - No cross-layer forbidden imports.
  - No behavior changes outside CLIP scope adjustments.
- Next actions:
  1. Finalize `2.B.06` by moving remaining pane context-menu/global shortcut wiring details out of `manager.ts`.
  2. Add manager-level integration coverage for newly wired quick prompt + pane view services.
  3. Refresh `resume-pack.*` and verification artifacts after each refactor slice.
