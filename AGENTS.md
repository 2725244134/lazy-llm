## Project Overview

LazyLLM is a multi-LLM interface built with Electron + Vue + TypeScript. It allows users to interact with multiple LLM providers (ChatGPT, Claude, Gemini, etc.) simultaneously.

## Tech Stack

- **Runtime**: Electron 38
- **Frontend**: Vue 3 + TypeScript + Vite
- **Package Manager**: Bun (enforced, no npm/yarn/pnpm)
- **Testing**: Vitest (unit) + Playwright (Electron smoke)
- **Styling**: Tailwind CSS

## Command Entry Points

All commands go through `justfile`. Never use raw `bun run` in workflows.

```bash
just prepare                                      # Install dependencies
just dev                                          # Start Electron dev mode
just build                                        # Production build
just package                                      # Package desktop app
just check                                        # Type checking
just test                                         # Run all tests (unit + smoke)
EXPECTED_VERSION=vX.Y.Z just release-verify-tag  # Verify tag/version contract
just clean                                        # Remove build artifacts
just help                                         # Show all recipes
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
when user is asked to proposal a new clip for Non-trivial changes,  now require a CLIP (Core Logic Improvement Proposal):

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

1. `just check` passes
2. `just test` passes

### Smoke Test Prerequisite

- Ensure no existing LazyLLM/Electron instance is running before `just test`.
- In this environment, Playwright Electron smoke tests can exit immediately with
  `electron.launch: Target page, context or browser has been closed` if another
  LazyLLM instance is already active.
- Recommended pre-check/cleanup:
  - `pgrep -af "LazyLLM|lazy-llm|electron.*lazy-llm"`
  - `pkill -f "LazyLLM|lazy-llm|electron.*lazy-llm"` (only when stale instances exist)

## Version Contract

- Keep release tag and app version aligned (validated on tag push):
  - `package.json#version`
- Validate locally before tagging:
  - `EXPECTED_VERSION=vX.Y.Z just release-verify-tag`

## But Workflow

### Commit Messages
 每次完成代码修改之后，先遵循conventional commits进行代码提交，然后向我解释为什么要进行每一部分的代码修改，为什么这么修改能够解决问题

Recommended Conventional Commits format:

```text
<type>(<scope>): <subject>
```

Suggested types:
`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `build`, `ci`, `perf`, `style`, `revert`.

### History Hygiene

- Keep `main` linear and readable; avoid "WIP" commits on `main`.
- Prefer short-lived branches (feature/proto/release) and squash-merge into `main`.
- Daily branch workflow should use `but`:
  - Sync with target branch: `but pull --check` then `but pull`
  - Create a branch from `main`: `but branch new <branch-name> --anchor main`
  - Check workspace state: `but status` and `but branch list`
  - Commit changes: `but commit <branch-name> -m "<type>(<scope>): <subject>"`
  - Push changes: `but push <branch-name>`
  - Open PR: `but pr new`
  - Merge (if not using GitHub UI): `but merge <branch-name>`

### Release Tags

- Tag format: `vX.Y.Z` (or `X.Y.Z`).
- Pushing a tag triggers `Validate Release Tag` (`.github/workflows/validate-tag.yml`) which
  enforces tag/version alignment.
- Use `git` only for tag operations (GitButler CLI currently does not provide tag commands).

## Release Workflow

1. Ensure `main` is up to date:
   - `but pull --check`
   - `but pull`
2. Create a release branch, e.g. `bump-0.2.0`.
   - `but branch new bump-0.2.0 --anchor main`
3. Bump `package.json#version`.
4. Run local validation:
   - `just check`
   - `just test`
   - (Optional) `just package`
   - `EXPECTED_VERSION=vX.Y.Z just release-verify-tag`
5. Commit, push, and merge:
   - `but commit bump-0.2.0 -m "chore(release): bump version to X.Y.Z"`
   - `but push bump-0.2.0`
   - `but pr new` (or `but merge bump-0.2.0`)
6. Sync workspace after merge:
   - `but pull`
7. Tag and push (tag-only git exception):
   - `git tag vX.Y.Z`
   - `git push origin vX.Y.Z`
8. GitHub Actions validates the tag/version contract (`.github/workflows/validate-tag.yml`).

## CI

- `.github/workflows/ci.yml`: runs `just check` + `just test` on PR/push.
- `.github/workflows/validate-tag.yml`: validates tag/version alignment on tag pushes.
