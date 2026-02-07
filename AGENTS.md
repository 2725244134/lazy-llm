# LazyLLM Agent Guidelines

## Project Overview

LazyLLM is a multi-LLM interface built with Electron + Vue + TypeScript. It allows users to interact with multiple LLM providers (ChatGPT, Claude, Gemini, etc.) simultaneously.

## Tech Stack

- **Runtime**: Electron 33+
- **Frontend**: Vue 3 + TypeScript + Vite
- **Package Manager**: Bun (enforced, no npm/yarn/pnpm)
- **Testing**: Vitest (unit) + Playwright (Electron smoke)
- **Styling**: Tailwind CSS

## Command Entry Points

All commands go through `Makefile`. Never use raw `bun run` in workflows.

```bash
make prepare              # Install dependencies
make dev                  # Start Electron dev mode
make dev-web              # Start Vite only (no Electron)
make build                # Production build
make package              # Package desktop app
make check                # Type checking
make test                 # Run all tests
make test-electron-smoke  # Electron smoke tests
make clean                # Remove build artifacts
make help                 # Show all targets
```

## Architecture

```
lazy-llm/
├── electron/           # Electron main process
│   ├── main.ts         # Window lifecycle, IPC handlers
│   ├── preload.ts      # contextBridge (window.council)
│   ├── ipc/            # IPC contracts (single source of truth)
│   └── ipc-handlers/   # Handler implementations
├── src/                # Vue renderer
│   ├── runtime/        # Runtime adapters (decouple UI from IPC)
│   ├── components/     # Vue components
│   ├── providers/      # LLM provider metadata
│   └── types/          # TypeScript types
└── tests/              # Test files
```

## Key Patterns

### IPC Contract

All IPC channels are defined in `electron/ipc/contracts.ts`. Never use magic strings.

### Runtime Adapter

Sidebar uses `SidebarRuntime` interface (`src/runtime/sidebar/types.ts`) to decouple from Electron. This enables:
- Web-only fallback mode
- Easier testing
- Clear boundaries

### Security

- `contextIsolation: true` (enforced)
- `nodeIntegration: false` (enforced)
- No direct `ipcRenderer` exposure to renderer

## CLIP Workflow

Non-trivial changes require a CLIP (Core Logic Improvement Proposal):

1. Create `clips/clip-<id>-<slug>.md`
2. Define problem, non-goals, design, test plan
3. Implement and validate
4. Update CLIP status to `Implemented`

## Commit Convention

Follow Conventional Commits:

- `feat(scope):` New feature
- `fix(scope):` Bug fix
- `refactor(scope):` Code refactor
- `test(scope):` Test changes
- `docs(scope):` Documentation
- `build(scope):` Build/config changes
- `chore(scope):` Maintenance

## Testing Requirements

Before merging:

1. `make check` passes
2. `make test` passes
3. `make test-electron-smoke` passes (for UI changes)
