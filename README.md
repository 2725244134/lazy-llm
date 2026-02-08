# LazyLLM

Multi-LLM interface built with Electron + Vue + TypeScript.

## Quick Start

```bash
# Install dependencies
make prepare

# Start development
make dev

# Type check
make check

# Run tests
make test

# Build for production
make build

# Package desktop app
make package
```

## Project Structure

```
lazy-llm/
├── electron/           # Electron main process
│   ├── main.ts         # Main process entry
│   ├── preload.ts      # Preload script (contextBridge)
│   ├── ipc/            # IPC contracts
│   └── ipc-handlers/   # IPC handler implementations
├── src/                # Vue renderer app
│   ├── App.vue
│   ├── main.ts
│   ├── components/
│   ├── types/
│   └── styles/
├── tests/              # Test files
│   └── electron/       # Electron smoke tests
└── dist-electron/      # Built electron files
```

## IPC Channels

| Channel | Request | Response |
|---------|---------|----------|
| `app:health` | void | `{ ok, runtime, version }` |
| `config:get` | void | AppConfig |
| `pane:setCount` | `{ count }` | `{ success }` |
| `pane:updateProvider` | `{ paneIndex, providerKey }` | `{ success, paneIndex }` |
| `prompt:send` | `{ text }` | `{ success, failures? }` |

## User Config File

LazyLLM auto-creates a plaintext config file at:

- Linux: `~/.config/lazy-llm/config.json`
- Or `$XDG_CONFIG_HOME/lazy-llm/config.json` when `XDG_CONFIG_HOME` is set

Supported fields:

```json
{
  "sidebar": {
    "expanded_width": 220
  },
  "defaults": {
    "pane_count": 3,
    "providers": ["chatgpt", "claude", "gemini"]
  },
  "runtime": {
    "zoom": {
      "pane_factor": 1.0,
      "sidebar_factor": 1.0
    }
  }
}
```

Notes:

- Sidebar exposes one effective width value: `sidebar.expanded_width`.
- `defaults.pane_count` and `defaults.providers` define startup pane count/providers.
- `runtime.zoom.pane_factor` and `runtime.zoom.sidebar_factor` control default zoom.
