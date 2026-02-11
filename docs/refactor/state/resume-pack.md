# Resume Pack

## Program state

- CLIP: `CLIP-1`
- Active phase: `Phase 3 — Runtime migration`
- Completion: `~50%` (Phase 2 completed, Phase 3 not started)

## Invariants

1. No forbidden cross-layer imports.
2. Behavior-preserving refactor unless scope adjustment is documented.

## Open decisions

- Decide whether `PaneLifecycleService` should remain callback-based or move to service-owned state during Phase 3 runtime migration.

## Next actions

1. Start `3.C.01` prompt sync controller extraction.
2. Add manager integration tests for quick prompt + pane view service wiring.
3. Draft Phase 3 runtime migration sequence for `3.C.02`~`3.C.04`.

## Verification plan

1. `just check`
2. `just test`

## Risk watchlist

- Smoke tests can be noisy if another LazyLLM instance holds the single-instance lock.
- Runtime migration may blur ownership boundaries unless phase-level contracts stay explicit.

## Task continuity

- Unfinished task IDs: `0.A.01`, `3.C.01`, `3.C.02`, `3.C.03`, `3.C.04`, `4.D.01`, `4.D.02`, `4.E.01`, `4.E.02`, `5.F.01`, `5.F.02`, `5.G.01`, `5.H.01`, `5.I.01`
- Last mutation point: `b8e73a55d098c752d3fddea7188d6891826e851f`
