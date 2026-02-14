# Postmortem: Second Launch Failure Caused by Single-Instance Lock

## Summary

- Date: 2026-02-14
- Scope: local development (`bunx electron-forge start` / `bun run dev`)
- Symptom: running a second launch command after one instance is already running appears as startup failure, with misleading `ERR_FAILED` logs.
- Final root cause: Electron single-instance lock is working as designed; second process fails lock acquisition and exits.

## Impact

- Developers interpreted the failure as renderer/sidebar/pane runtime regression.
- Multiple unrelated fix paths were explored before confirming process-level lock behavior.
- Debug time increased because terminal logs suggested `loadURL`/network failure.

## What Happened

1. One LazyLLM instance was already running.
2. A second launch command (`bunx electron-forge start`) was executed.
3. Electron evaluated `app.requestSingleInstanceLock()`.
4. Lock acquisition failed in the second process, which then exited (`app.quit()` path).
5. During shutdown/retry windows, logs included `ERR_FAILED`/`Failed to load URL`, which looked like runtime/network issues.

## Detection

- Reproduction was stable: first instance running + second launch always reproduced the same failure pattern.
- Process-level inspection and code inspection in main process confirmed lock branch behavior.

## Root Cause Analysis

- Direct cause: second process could not acquire single-instance lock.
- Code path:
  - `electron/main.ts`: `app.requestSingleInstanceLock()`
  - on failure: immediate `app.quit()`
- This is expected behavior, not a functional regression in sidebar loading logic.

## Why It Was Confusing

- Console output surfaced `ERR_FAILED` near launch, which usually indicates URL/network issues.
- The lock failure and early process exit can overlap with transient load attempts/logging.
- The signal-to-noise ratio in startup logs made the incident look like a rendering/runtime problem.

## Resolution

- Confirmed startup issue root cause as single-instance lock conflict.
- Stopped treating this symptom as renderer/sidebar regression.
- Marked UA masking and network fallback as non-required for this startup incident.

## Preventive Actions

1. Add explicit developer note to startup docs:
   - If one instance is already running, a second launch is expected to exit.
2. Recommend an isolated debug command for parallel runs:
   - `LAZYLLM_SKIP_SINGLE_INSTANCE_LOCK=1`
   - `LAZYLLM_USER_DATA_DIR=/tmp/lazy-llm-dev-<pid>`
3. Improve startup log clarity:
   - emit explicit lock-failure message before quit path in development mode.
4. Keep startup-failure and pane-network incidents tracked separately to avoid mixed diagnosis.

## Follow-ups

- Owner: project maintainers
- Status: startup root cause confirmed and documented
- Next: optional doc/script ergonomics improvement for isolated development runs
