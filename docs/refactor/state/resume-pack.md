# Resume Pack

## Program state

- CLIP: `CLIP-2`
- Active phase: `Phase 2 — View manager decomposition`
- Completion: `~50%` (Phases 0/1 largely done, Phase 2 in progress)

## Invariants

1. No forbidden cross-layer imports.
2. Behavior-preserving refactor unless scope adjustment is documented.

## Open decisions

- Whether `PaneLifecycleService` should remain callback-based or own pane state directly in final `2.B.06`.

## Next actions

1. Complete `2.B.06` by finishing the manager-to-services split.
2. Add manager integration tests for lifecycle + shortcut + prompt wiring.
3. Continue Phase 1 import migration task `1.A.04`.

## Verification plan

1. `just check`
2. `just test`

## Risk watchlist

- `ViewManager` still includes some lifecycle responsibilities while `2.B.06` is open.
- Boundary debt risk remains until `1.A.04` import migration is complete.

## Task continuity

- Unfinished task IDs: `0.A.01`, `1.A.04`, `2.B.06`, `3.C.01`, `3.C.02`, `3.C.03`, `3.C.04`, `4.D.01`, `4.D.02`, `4.E.01`, `4.E.02`, `5.F.01`, `5.F.02`, `5.G.01`, `5.H.01`, `5.I.01`
- Last mutation point: `3de5c9966d624d1bfbaf94ca1508f9837edcc072`
