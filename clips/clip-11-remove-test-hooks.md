---
Author: codex
Created: 2026-02-09
Updated: 2026-02-09
Status: Implemented
Commits: refactor(core): remove test-only hooks from production runtime
---

# CLIP-11: Remove Test-Only Hooks From Production Runtime

## Problem statement

The production runtime exposed test-oriented behavior that should not be part of the app contract:

1. A dedicated layout snapshot IPC channel existed only for smoke assertions.
2. Renderer and quick prompt templates contained `data-testid` attributes used only by tests.
3. One runtime focus path depended on a test selector (`[data-testid="prompt-textarea"]`).

These patterns increased public API surface and coupled production behavior to test scaffolding.

## Non-goals

1. Do not change provider injection selectors for third-party sites.
2. Do not introduce new compatibility layers for removed test-only APIs.
3. Do not redesign sidebar or quick prompt UX.

## Design

### Runtime contract changes

1. Remove `layout:getSnapshot` from `electron/ipc/contracts.ts`.
2. Remove the corresponding handler from `electron/main.ts`.
3. Remove `getLayoutSnapshot` from `electron/preload.ts` and `src/types/electron.d.ts`.
4. Remove `ViewManager.getSnapshot()` from `electron/views/manager.ts`.

### UI cleanup

1. Remove `data-testid` attributes from app/sidebar/composer/select components.
2. Replace quick prompt panel lookup with semantic selector `.panel`.
3. Replace sidebar focus query with `textarea.composer-textarea`.

### Test migration

1. Replace testid-based selectors with stable semantic selectors (class/tag structure).
2. Rewrite smoke assertions that depended on layout snapshots to use:
   - visible UI state
   - public IPC responses (`healthCheck`, `updateLayout`, `toggleQuickPrompt`, `hideQuickPrompt`, `resizeQuickPrompt`, `updateProvider`)
3. Keep coverage intent while removing the need for production-only test APIs.

## Trade-offs

1. Snapshot-level geometry assertions were removed from smoke tests.
2. Tests now validate externally observable behavior and public IPC outcomes, not internal layout details.
3. This intentionally narrows production surface area at the cost of less direct introspection in e2e tests.

## Test plan

1. `make check`
2. `make test` (includes unit + smoke pipeline in this repository workflow)

## Validation results

1. `make check` passed.
2. `make test` passed.
