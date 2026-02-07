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
