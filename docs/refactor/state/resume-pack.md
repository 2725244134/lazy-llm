# Resume Pack

## Program state

- CLIP: `CLIP-1`
- Active phase: `Phase 2 — View manager decomposition`
- Completion: `~46%` (Phase 1 completed, Phase 2 in progress)

## Invariants

1. No forbidden cross-layer imports.
2. Behavior-preserving refactor unless scope adjustment is documented.

## Open decisions

- Whether `PaneLifecycleService` should remain callback-based or own pane state directly in final `2.B.06`.

## Next actions

1. Complete `2.B.06` by finishing the manager-to-services split.
2. Add manager integration tests for lifecycle + shortcut + prompt wiring.
3. Eliminate the final import-boundary violation in quick prompt styling.

## Verification plan

1. `just check`
2. `just test`

## Risk watchlist

- `ViewManager` still includes some lifecycle responsibilities while `2.B.06` is open.
- `electron/views/quick-prompt/styles.ts` still imports `src/theme/palette`.

## Task continuity

- Unfinished task IDs: `0.A.01`, `2.B.06`, `3.C.01`, `3.C.02`, `3.C.03`, `3.C.04`, `4.D.01`, `4.D.02`, `4.E.01`, `4.E.02`, `5.F.01`, `5.F.02`, `5.G.01`, `5.H.01`, `5.I.01`
- Last mutation point: `TBD (current working tree)`
