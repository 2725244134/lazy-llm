## Project Overview

LazyLLM is a multi-LLM desktop app built with Electron + React + TypeScript.
The codebase follows a template-aligned split between main-process services and renderer features.

## Tech Stack

- **Runtime**: Electron 38
- **Renderer**: React 19 + TypeScript + Vite
- **Main Build/Packaging**: Electron Forge + `@electron-forge/plugin-vite`
- **Package Manager**: Bun (enforced)
- **Testing**: Vitest (unit) + Playwright (Electron smoke)
- **Styling**: Tailwind CSS

## Command Entry Points

All standard workflows go through `justfile`.

```bash
just prepare                                      # Install dependencies
just dev                                          # Start Electron dev mode
just build                                        # Build app package (typecheck + forge package)
just package                                      # Create distributables (forge make)
just check                                        # Type check
just arch-check                                   # Import boundary check
just test                                         # Unit tests + Electron smoke tests
EXPECTED_VERSION=vX.Y.Z just release-verify-tag  # Validate tag/version contract
just clean                                        # Remove build artifacts
just help                                         # Show all recipes
```

## Architecture

```text
lazy-llm/
├── src/
│   ├── main.ts                      # Electron app bootstrap
│   ├── main-services/
│   │   ├── ipc/                     # IPC registration + channel modules
│   │   ├── ipc-handlers/            # Runtime preference/provider state
│   │   └── views/                   # Sidebar/pane/quick-prompt lifecycle
│   ├── preload.ts                   # contextBridge -> window.lazyllm
│   ├── pane-preload.ts
│   ├── quick-prompt-preload.ts
│   ├── renderer.tsx                 # Renderer entry
│   ├── renderer/                    # React UI
│   ├── runtime/                     # Renderer runtime adapters
│   ├── providers/
│   └── inject/
├── packages/
│   ├── shared-config/
│   └── shared-contracts/ipc/contracts.ts
├── scripts/check_import_boundaries.ts
├── forge.config.ts
└── tests/{cli,electron}
```

## Key Patterns

### IPC Contract

All IPC channels and request/response types are defined in `packages/shared-contracts/ipc/contracts.ts`.
Never use hardcoded channel strings in implementation code.

### Runtime Adapter Boundary

Renderer code interacts with Electron through `window.lazyllm` and runtime adapters in `src/runtime/`.
Keep renderer components decoupled from raw IPC details.

### Layer Boundary Guard

Use `scripts/check_import_boundaries.ts` to enforce directional imports between `src/main-services` and renderer/runtime code.
Run `just arch-check` after structural changes.

### Security Defaults

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Preload exposes only the minimal `window.lazyllm` API surface

## Commit Convention

Follow Conventional Commits:

- `feat(scope):` New feature
- `fix(scope):` Bug fix
- `refactor(scope):` Refactor
- `test(scope):` Test change
- `docs(scope):` Documentation
- `build(scope):` Build/config updates
- `chore(scope):` Maintenance

## Testing Requirements

Before merge:

1. `just check`
2. `just test`

### Smoke Test Notes

- Electron smoke tests can fail if another LazyLLM instance is running.
- In this repository, smoke fixtures isolate user data and bypass single-instance lock during tests.
- If you still see launch conflicts, clear stale local processes before rerunning smoke tests.

## Version Contract

- Keep tag and `package.json#version` aligned.
- Validate locally with:
  - `EXPECTED_VERSION=vX.Y.Z just release-verify-tag`

## But Workflow

Use GitButler (`but`) for branch/commit/push operations.

- Sync: `but pull --check --json` then `but pull --json --status-after`
- Create branch: `but branch new <branch-name>`
- Inspect changes: `but status --json`
- Commit changes: `but commit <branch-name> -m "<type>(<scope>): <subject>" --changes <change-id>`
- Push: `but push`

## CI

- `.github/workflows/ci.yml`: `just check` + `just test`
- `.github/workflows/validate-tag.yml`: tag/version alignment on release tags
