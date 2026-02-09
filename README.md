# LazyLLM

Multi-LLM interface built with Electron + Vue + TypeScript.

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

## User Config Files

LazyLLM auto-creates plaintext config files at:

- Linux: `~/.config/lazy-llm/config.default.json` and `~/.config/lazy-llm/config.json`
- Or `$XDG_CONFIG_HOME/lazy-llm/config.default.json` and `$XDG_CONFIG_HOME/lazy-llm/config.json` when `XDG_CONFIG_HOME` is set

`config.default.json` contains concrete baseline values generated from code defaults.

`config.json` is your override file. Use `"default"` to inherit lower-priority values:

```json
{
  "provider": {
    "pane_count": "default",
    "panes": "default"
  },
  "sidebar": {
    "expanded_width": "default"
  },
  "quick_prompt": {
    "default_height": "default"
  },
  "webview": {
    "zoom": {
      "pane_factor": "default",
      "sidebar_factor": "default"
    }
  }
}
```

Notes:

- Resolution priority is strict: external file (`3`) > encrypted store (`2`) > code defaults (`1`).
- In `config.json`, both omitted fields and `"default"` are treated as "no override".
- `provider.pane_count` and `provider.panes` define startup pane count/providers.
- Sidebar exposes one effective width value: `sidebar.expanded_width`.
- `quick_prompt.default_height` controls initial quick prompt height.
- `webview.zoom.pane_factor` and `webview.zoom.sidebar_factor` control default zoom.
