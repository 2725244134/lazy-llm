# LazyLLM

Multi-LLM interface built with Electron + React + TypeScript.

## Quick Start

```bash
# Install dependencies
just prepare

# Start development
just dev

# Type check
just check

# Run tests
just test

# Build for production
just build

# Package desktop app
just package
```

## Project Structure

```text
lazy-llm/
├── electron/               # Electron main process and view orchestration
│   ├── main.ts             # Main process entry
│   ├── ipc/                # IPC contracts and modular handler registration
│   ├── ipc-handlers/       # Main-side runtime state/config handlers
│   ├── preload.ts          # Renderer preload bridge (window.council)
│   ├── pane-preload.ts     # Pane preload bridge
│   └── quick-prompt-preload.ts
├── src/
│   ├── renderer/           # React renderer features (sidebar/providers/prompt)
│   ├── runtime/            # Renderer runtime adapters
│   ├── providers/          # Provider metadata and injection configs
│   ├── inject/             # Prompt injection runtime
│   ├── styles/
│   └── main.tsx            # React renderer entrypoint
├── packages/
│   ├── shared-config
│   └── shared-contracts
├── tests/
│   └── electron/           # Electron smoke tests
└── dist-electron/          # Built electron files
```

## IPC Channels

| Channel | Request | Response |
|---------|---------|----------|
| `app:health` | void | `{ ok, runtime, version }` |
| `config:get` | void | AppConfig |
| `pane:setCount` | `{ count }` | `{ success }` |
| `pane:updateProvider` | `{ paneIndex, providerKey }` | `{ success, paneIndex }` |
| `prompt:send` | `{ text }` | `{ success, failures? }` |
| `prompt:syncDraft` | `{ text }` | `{ success, failures? }` |
| `layout:update` | `{ paneCount, sidebarWidth }` | `{ success }` |
| `quickPrompt:toggle` | void | `{ success, visible }` |

## Runtime Settings

Renderer settings are persisted in localStorage under `lazyllm.settings.v1`.

Stored fields include:

- `layout.paneCount`
- `layout.sidebarWidth`
- `providers.paneKeys`

Main process config now serves runtime defaults and no longer relies on external user config files.
