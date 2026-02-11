# Resume Pack

## Program state

- CLIP: `CLIP-1`
- Active phase: `Phase 2 — View manager decomposition`
- Completion: `~46%` (Phase 1 completed, Phase 2 in progress with pane view service extraction)

## Invariants

1. No forbidden cross-layer imports.
2. Behavior-preserving refactor unless scope adjustment is documented.

## Open decisions

- Whether `PaneLifecycleService` should remain callback-based or own pane state directly in final `2.B.06`.

## Next actions

1. Complete `2.B.06` by removing remaining pane-specific orchestration details from `manager.ts`.
2. Add manager integration tests for quick prompt + pane view service wiring.
3. Prepare Phase 3 handoff once `2.B.06` is closed.

## Verification plan

1. `just check`
2. `just test`

## Risk watchlist

- `ViewManager` still includes some lifecycle responsibilities while `2.B.06` is open.
- Smoke tests can be noisy if another LazyLLM instance holds the single-instance lock.

## Task continuity

- Unfinished task IDs: `0.A.01`, `2.B.06`, `3.C.01`, `3.C.02`, `3.C.03`, `3.C.04`, `4.D.01`, `4.D.02`, `4.E.01`, `4.E.02`, `5.F.01`, `5.F.02`, `5.G.01`, `5.H.01`, `5.I.01`
- Last mutation point: `TBD (current working tree)`
