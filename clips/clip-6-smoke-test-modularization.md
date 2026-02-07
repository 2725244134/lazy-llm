---
Author: cctop
Created: 2026-02-08
Updated: 2026-02-08
Status: Implemented
Commits: TBD
---

# CLIP-6: Modularize Electron Smoke Tests by Domain Ownership

## Problem statement

`tests/electron/smoke.test.ts` mixed all smoke scenarios into one large file and repeated launch/teardown plus inline `window.council` access in each test.
This made ownership unclear, increased duplication, and raised edit risk when changing one smoke scenario.

## Non-goals

1. No behavior changes to smoke assertions.
2. No app runtime logic changes in `electron/` or `src/`.
3. No test framework migration.

## Design

1. Introduce shared test fixture in `tests/electron/fixtures/electronApp.ts`.
   - Own Electron app lifecycle (`launch`, `firstWindow`, `waitForLoadState`, `close`).
2. Introduce council helper module in `tests/electron/helpers/council.ts`.
   - Own typed wrappers around `window.council` APIs.
3. Introduce selector helper module in `tests/electron/helpers/selectors.ts`.
   - Own reusable `data-testid` selectors.
4. Split smoke suites by feature/domain ownership in `tests/electron/smoke/`.
   - `app-shell.test.ts`
   - `layout-ipc.test.ts`
   - `sidebar.test.ts`
   - `quick-prompt.test.ts`
   - `panes.test.ts`
   - `prompt-composer.test.ts`

## Test plan

1. Run `make check`.
2. Run `make test-electron-smoke`.
3. Confirm smoke scenarios remain equivalent to pre-refactor behavior.

## Outcome

Smoke tests now have explicit module boundaries:
- fixture lifecycle ownership
- IPC evaluation ownership
- feature-level test ownership

This reduces duplication and improves maintainability while preserving behavior.
