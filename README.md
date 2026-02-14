# LazyLLM

Multi-LLM desktop interface built with Electron + React + TypeScript.

## Quick Start

```bash
# Install dependencies
just prepare

# Start development (Electron Forge + Vite)
just dev

# Type check
just check

# Architecture boundary check
just arch-check

# Run tests (unit + electron smoke)
just test

# Build package artifacts
just build

# Create distributables
just package

# Validate release tag/version contract
EXPECTED_VERSION=vX.Y.Z just release-verify-tag
```

## Project Structure

```text
lazy-llm/
├── src/
│   ├── main.ts                      # Electron main entry
│   ├── main-services/               # Main process services
│   │   ├── ipc/                     # IPC registration and modules
│   │   ├── ipc-handlers/            # Runtime preferences + provider config state
│   │   └── views/                   # Sidebar/pane/quick-prompt lifecycle and layout
│   ├── preload.ts                   # contextBridge bridge: window.lazyllm
│   ├── pane-preload.ts              # Pane preload bridge
│   ├── quick-prompt-preload.ts      # Quick prompt preload bridge
│   ├── renderer.tsx                 # Renderer entry
│   ├── renderer/                    # React renderer features
│   ├── runtime/                     # Renderer runtime adapters
│   ├── inject/                      # Prompt injection runtime script source
│   └── providers/
├── packages/
│   ├── shared-config/
│   └── shared-contracts/            # IPC contracts (single source of truth)
├── scripts/
│   └── check_import_boundaries.ts   # main-services <-> renderer boundary guard
├── tests/
│   ├── cli/
│   └── electron/
├── forge.config.ts                  # Electron Forge + Vite multi-entry build config
└── vite.*.config.mts
```

## Runtime Bridge

Renderer talks to the main process through `window.lazyllm` from `src/preload.ts`.

Representative APIs:

- `healthCheck()`
- `getConfig()`
- `setPaneCount({ count })`
- `updateProvider({ paneIndex, providerKey })`
- `sendPrompt({ text })`
- `syncPromptDraft({ text })`
- `updateLayout({ paneCount, sidebarWidth })`
- `toggleQuickPrompt()`, `hideQuickPrompt()`, `resizeQuickPrompt({ height })`

## Runtime Settings

Renderer settings are persisted in localStorage under `lazyllm.settings.v1`.

Stored fields include:

- `layout.paneCount`
- `layout.sidebarWidth`
- `providers.paneKeys`

Main process serves runtime defaults from shared config and no longer depends on external user config files.
