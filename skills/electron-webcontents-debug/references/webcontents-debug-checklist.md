# WebContents Debug Checklist

## Symptom Map

- Symptom: Sidebar buttons change local UI but target panes do not react.
- High-probability causes:
  - Preload failed to load, bridge API is unavailable.
  - IPC handler returns `{ success: false }` due to invalid/stale payload.
  - Main-process provider registry does not match renderer options.

- Symptom: `window.council` or equivalent bridge object is `undefined`.
- High-probability causes:
  - Preload path points to wrong file after build.
  - Preload artifact format is incompatible for current Electron preload execution.
  - Old artifact is being resolved before fresh artifact.

- Symptom: Console shows preload errors like `Unable to load preload script` or `Cannot use import statement outside a module`.
- High-probability causes:
  - Bundler emitted ESM-like output for a preload context requiring CJS-compatible output.
  - View manager is loading stale `.mjs`/`.js` artifact instead of intended `.cjs` artifact.

- Symptom: Provider switch request returns `success: false`.
- High-probability causes:
  - Persisted config contains obsolete provider keys.
  - Main process validates against a narrower provider set than renderer.

## Fast Triage Commands

Run these in the target repo root.

```bash
# 1) Inspect where preload is referenced
rg -n "preload|pane-preload|loadFile\(|loadURL\(" electron src

# 2) Inspect built electron artifacts and competing preload files
ls -la dist-electron

# 3) Confirm preload output syntax quickly
sed -n '1,120p' dist-electron/preload.cjs

# 4) Validate renderer bridge at runtime (adapt bridge name as needed)
# Use Playwright/Electron evaluate in existing smoke harness
```

## Minimal Remediation Patterns

### 1) Make preload resolution deterministic

- Resolve runtime directory once.
- Probe candidate preload paths in strict priority order.
- Prefer the known-good artifact format first (for example `.cjs` before stale `.mjs`).

### 2) Decouple preload build from fragile plugin defaults

- Build preload scripts explicitly with a deterministic command.
- Keep main-process bundling and preload bundling as separate steps.
- Ensure `dev` and `build` both produce preload outputs before Electron launch.

### 3) Normalize persisted config at read time

- Define canonical provider metadata in one place.
- Clamp pane count and widths to valid ranges.
- Rewrite stale persisted config to normalized schema when detected.

### 4) Harden smoke tests around side effects

- Keep interaction checks (`click`, `active` class).
- Add bridge-driven state checks (`getLayoutSnapshot`, provider key, pane count).
- Avoid visibility assertions on regions clipped by WebContentsView bounds unless that is the intended contract.

## Done Criteria

- Bridge object is available in renderer.
- Preload console errors are absent.
- Sidebar actions update target pane state, not only local UI state.
- Production build + smoke tests are green.
