---
name: electron-webcontents-debug
description: Diagnose and fix Electron apps where renderer controls do not affect WebContentsView/WebView targets due to preload injection failures, IPC contract drift, broken build artifacts, or stale persisted config. Use when symptoms include button clicks that only change UI state, window bridge APIs being undefined, preload load errors, provider/pane updates returning success:false, or smoke tests passing UI checks but failing side-effect checks.
---

# Electron WebContents Debug

## Overview

Restore reliable control flow from sidebar controls to target WebContentsViews.

Prioritize bridge injection, preload artifact compatibility, IPC contract continuity, and persisted config normalization.

## Workflow

1. Map the end-to-end control path.
- Trace `UI event -> runtime adapter -> preload bridge -> ipcMain handler -> ViewManager/WebContentsView`.
- Confirm each hop has one source of truth and explicit success/failure semantics.

2. Verify renderer bridge availability before debugging business logic.
- Check `typeof window.<bridge>` in the sidebar renderer context.
- If bridge is `undefined`, debug preload loading first.

3. Validate preload loading and runtime format compatibility.
- Verify actual preload file path resolved by view manager at runtime.
- Verify preload output module format matches Electron expectation for that context.
- Treat preload console errors as primary blockers.

4. Validate IPC contract and handler behavior.
- Confirm channel constants are shared and no magic strings are used.
- Confirm handler input validation does not reject valid UI requests.
- Confirm handler response payloads are checked by renderer runtime and surfaced as errors.

5. Reconcile provider/config source of truth.
- Compare renderer provider list with main-process provider list.
- Normalize persisted config when schema or enum values changed.
- Ensure stale persisted data cannot silently force invalid runtime behavior.

6. Validate with side-effect assertions, not only UI assertions.
- Keep UI state assertions (active class, toggle state).
- Add assertions against layout/provider snapshots returned through bridge APIs.
- Prefer assertions that prove target WebContentsView state actually changed.

7. Finalize with build and smoke gates.
- Build production artifacts, then run Electron smoke tests against production mode.
- Re-run smoke tests after any preload/build-pipeline change.

## Reference

Read `references/webcontents-debug-checklist.md` for:
- Symptom-to-root-cause mapping
- Command checklist for fast triage
- Minimal remediation patterns for preload, IPC, and config migration
