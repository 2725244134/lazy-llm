---
Author: Codex
Created: 2026-02-11
Updated: 2026-02-11
Status: Draft
Commits: TBD
---

# CLIP-2: Full Project Refactor Master Plan (Context-Resumable)

## Problem statement

LazyLLM has grown fast and now carries structural coupling that raises change cost and regression risk:

- `electron/` and `src/` depend on each other bidirectionally.
- `ViewManager` has become a high-complexity orchestration class with mixed responsibilities.
- Prompt interaction logic is duplicated across Sidebar and Quick Prompt paths.
- Build graph is split across Vite plugin flow and custom esbuild scripts.
- Runtime communication includes non-contractual event bridges that are harder to evolve safely.

Recent bug-fix work (white-screen recovery and quick prompt anchoring) proved correctness improvements, but also surfaced that systemic refactor is now required to keep the codebase maintainable.

This CLIP defines a detailed, end-to-end, multi-phase refactor program for the entire project.

## Non-goals

- No visual redesign or UX overhaul beyond behavior-preserving adjustments needed for architecture migration.
- No provider feature expansion (new providers, auth models, backend integrations) during this refactor.
- No release versioning policy changes.
- No rewrite of the app into a different framework/runtime.

## Design

### Refactor principles

1. **Behavior-preserving first**
   - Prefer structural extraction and boundary enforcement over feature changes.
2. **Vertical safety slices**
   - Each phase must ship with tests and rollback capability.
3. **Single source of truth contracts**
   - IPC contracts and shared domain types must not be duplicated.
4. **Dependency direction clarity**
   - Cross-runtime imports must follow explicit layering rules.
5. **Context-resumable execution**
   - Every phase must be resumable after context compression with a deterministic handoff artifact.

### Current state audit (baseline)

#### Coupling and boundaries

- Main process imports renderer config directly.
- Renderer runtime types import IPC types from Electron path.
- Quick Prompt runtime style/script templates import from renderer theme/config paths.

#### Complexity hotspots

- `electron/views/manager.ts` is the main complexity center.
- `src/components/sidebar/Sidebar.vue` mixes orchestration and presentation logic.
- Prompt draft synchronization behavior is duplicated in separate UI flows.

#### Build and test shape

- Main Electron build uses `vite-plugin-electron`, while preloads/inject runtime use separate esbuild scripts.
- Unit tests are strong for utility modules; integration safety depends heavily on smoke tests.

### Target architecture

#### Top-level layering

```text
apps/
  electron-main/
  renderer/
packages/
  shared-contracts/
  shared-config/
  view-domain/
  provider-domain/
  prompt-domain/
```

The physical folder migration can be phased while preserving current paths initially (via adapters and re-exports).

#### Dependency rules

1. `electron-main` can depend on `packages/*`, cannot import from renderer app code.
2. `renderer` can depend on `packages/*`, cannot import from Electron implementation code.
3. `shared-contracts` has no runtime dependency on Electron or Vue.
4. Domain packages (`view-domain`, `prompt-domain`, `provider-domain`) should be framework-agnostic where possible.

### Detailed component inventory and migration map

#### Electron-side modules

| Current path | Current role | Target module/boundary | Migration action | Done when |
| --- | --- | --- | --- | --- |
| `electron/main.ts` | app lifecycle + IPC registration | `apps/electron-main/bootstrap` + `ipc/router` | extract handler registration to router factory | main entry only wires lifecycle + composition |
| `electron/preload.ts` | renderer bridge exposure | `apps/electron-main/preload/sidebarBridge` | move API type source to shared contracts | no local payload type duplication |
| `electron/pane-preload.ts` | pane bridge API | `apps/electron-main/preload/paneBridge` | keep minimal and typed event adapters | no contract string literals outside shared constants |
| `electron/quick-prompt-preload.ts` | quick prompt bridge API | `apps/electron-main/preload/quickPromptBridge` | align with shared runtime command interfaces | quick prompt API signatures derive from shared contracts |
| `electron/views/manager.ts` | view orchestration monolith | `view-domain` coordinator composition root | split services and keep coordinator thin | file no longer owns unrelated state machines |
| `electron/views/geometry.ts` | layout math | `view-domain/layout` | keep pure and dependency-free | service consumed by layout orchestrator only |
| `electron/views/quickPromptGeometry.ts` | quick prompt bounds | `view-domain/quickPromptGeometry` | maintain pure geometry + tests | no direct process/global access |
| `electron/views/paneRecovery.ts` | load retry decision logic | `view-domain/paneRecoveryPolicy` | keep pure policy engine | monitor layer only orchestrates effects |
| `electron/views/paneErrorPage.ts` | error fallback HTML | `view-domain/fallbackPageRenderer` | preserve behavior, isolate presentation template | no monitor business logic in renderer builder |
| `electron/views/paneLoadMonitor.ts` | recovery monitor | `view-domain/paneLoadMonitor` | retain as service, harden API + tests | manager depends on interface only |
| `electron/ipc/contracts.ts` | IPC names + types | `packages/shared-contracts/ipc` | migrate source of truth, keep temp re-export | old path contains no canonical types |
| `electron/ipc-handlers/*.ts` | handler implementation + config/store | `apps/electron-main/ipc/handlers` + domain services | separate persistence/domain from transport handlers | handler files become thin transport adapters |

#### Renderer-side modules

| Current path | Current role | Target module/boundary | Migration action | Done when |
| --- | --- | --- | --- | --- |
| `src/runtime/sidebar/types.ts` | runtime boundary types | `packages/shared-contracts/runtime` | remove Electron-path imports | renderer compiles without importing `electron/*` |
| `src/runtime/sidebar/electronRuntime.ts` | Electron runtime adapter | `apps/renderer/runtime/electronSidebarRuntime` | map shared requests/responses only | runtime adapter behavior parity tests pass |
| `src/runtime/sidebar/fallbackRuntime.ts` | web-only fallback | `apps/renderer/runtime/fallbackSidebarRuntime` | unify error + no-op semantics with Electron adapter | contract tests pass for both adapters |
| `src/components/sidebar/Sidebar.vue` | UI + orchestration + side effects | `apps/renderer/features/sidebar/controller` + presentational components | move orchestration into composables/services | component focuses on rendering and bindings |
| `src/components/sidebar/PromptComposer.vue` | prompt input + draft sync | `prompt-domain/ui-binding` | delegate sync logic to shared controller | no duplicated sync state machine code |
| `src/components/ui/Select.vue` | provider selection UI | renderer UI component | keep UI-only; consume canonical provider registry | no business fallback logic in component |
| `src/types/electron.d.ts` | global bridge type declaration | `packages/shared-contracts/bridges` | import shared API types | no duplicate type declarations |

#### Provider/inject modules

| Current path | Current role | Target module/boundary | Migration action | Done when |
| --- | --- | --- | --- | --- |
| `src/providers/index.ts` | provider aggregation | `provider-domain/registry` | centralize metadata + inject config | single provider truth source |
| `src/providers/*/index.ts` | provider metadata export | `provider-domain/providers/<key>` | keep but enforce typed schema | all providers validated by schema tests |
| `src/providers/*/inject.ts` | provider selectors | `provider-domain/selectors` | standardize selector fields and validation | no ad-hoc optional behavior without schema |
| `src/inject/inject.ts` | bridge and runtime injection | `prompt-domain/inject-runtime` | split detect/inject/extract orchestration | each stage unit-testable independently |
| `src/inject/core.ts` | core inject utilities | `prompt-domain/inject-core` | keep pure helpers | helper contracts stable and documented |

#### Config and persistence modules

| Current path | Current role | Target module/boundary | Migration action | Done when |
| --- | --- | --- | --- | --- |
| `src/config/*.ts` | app defaults + constants | `packages/shared-config` | extract schemas/defaults and runtime-safe parser | Electron + renderer import shared config |
| `electron/ipc-handlers/store.ts` | persistence + merge layers | `apps/electron-main/persistence/configStore` | split store IO from merge policy | independent unit tests for IO and merge |
| `electron/ipc-handlers/externalConfig.ts` | external file parsing/merge | `shared-config/overrides` + host adapter | separate pure merge from FS operations | parser is pure-testable without filesystem |

#### Tooling and scripts

| Current path | Current role | Target module/boundary | Migration action | Done when |
| --- | --- | --- | --- | --- |
| `scripts/lib/jsonCli.ts` | CLI JSON helpers | `tools/refactor-cli/core` | keep reusable CLI primitives | all CLI entrypoints reuse same helpers |
| `scripts/lib/*Cli.ts` | domain CLI adapters | `tools/refactor-cli/adapters` | align names with extracted domain modules | adapters remain thin and deterministic |
| `vite.config.ts` + `package.json scripts` | build orchestration | `tools/build/ownership matrix` | document and enforce artifact ownership | no ambiguous duplicated build responsibility |

### Dependency policy matrix (enforced)

| From | Allowed | Forbidden |
| --- | --- | --- |
| `electron/**` | `packages/**`, node/electron libs | `src/**` implementation paths |
| `src/**` | `packages/**`, vue libs | `electron/**` implementation paths |
| `packages/shared-contracts/**` | Type-only utilities | Electron/Vue/browser runtime code |
| `packages/shared-config/**` | Pure schema/default logic | UI code, Electron APIs |
| `scripts/**` | `packages/**`, pure utilities | importing app-private internals unless explicitly adapter-only |

### Repeatable execution framework

This plan is designed to be repeatable by different agents/engineers with consistent output quality.

#### Task unit model

Each task is tracked as:

- `Task ID`: `PHASE.WORKSTREAM.SEQ` (e.g. `2.B.03`)
- `Intent`: what boundary/behavior is being changed
- `Inputs`: files/modules/interfaces expected before task
- `Mutation`: exact structural change
- `Verification`: required commands/tests
- `Outputs`: commit(s), docs updates, state updates

#### Definition of Ready (DoR)

A task can start only if:

1. Prior dependent task IDs are complete.
2. Affected interfaces are identified.
3. Verification scope is defined.
4. Rollback approach is clear.

#### Definition of Done (DoD)

A task is done only if:

1. Code changes compile.
2. Task-level tests pass.
3. `just check` and relevant suite(s) pass.
4. State artifacts updated (progress + verification + decisions).
5. Commit message references task ID(s) in body or notes.

### Detailed workstreams

## Workstream A — Shared contracts and config boundaries

### Goal

Eliminate bidirectional `electron <-> src` imports and establish shared package contracts.

### Scope

- Move IPC contracts and request/response payloads into `packages/shared-contracts`.
- Move static configuration schema + defaults into `packages/shared-config`.
- Keep compatibility re-export files in existing locations during migration.

### Deliverables

1. Shared contract module with strict type exports.
2. Shared config module with runtime-safe readers.
3. Temporary compatibility layer:
   - `electron/ipc/contracts.ts` re-exporting shared contracts.
   - `src/config/*` progressively migrated to shared config primitives.

### Acceptance criteria

- No direct import from `src/` inside `electron/` except compatibility re-export paths.
- No import from `electron/` inside renderer runtime types.
- Typecheck passes with strict mode unchanged.

## Workstream B — View orchestration decomposition

### Goal

Split `ViewManager` into focused services with clear contracts.

### Submodules

1. `PaneLifecycleService`
   - Create/destroy/cached view switching.
2. `PaneLoadMonitor` (already introduced)
   - Retry/error fallback policies.
3. `LayoutService`
   - Bounds calculations, sidebar/pane/quick-prompt layout assignment.
4. `ShortcutDispatcher`
   - Ctrl/Cmd+J/B/R routing.
5. `SidebarEventBridge`
   - Event dispatching and channel mediation.
6. `PromptDispatchService`
   - Inject runtime load + prompt eval dispatch.

### Required constraints

- Services communicate via typed method interfaces, not direct global state mutation.
- All stateful maps owned by dedicated service where state belongs.

### Acceptance criteria

- `manager.ts` reduced to orchestration/composition role.
- Each extracted service has unit tests.
- Existing smoke tests remain green.

## Workstream C — Prompt pipeline unification

### Goal

Unify prompt draft sync/send state machine used by Sidebar PromptComposer and Quick Prompt overlay.

### Scope

- Introduce `prompt-domain` state machine with shared logic for:
  - debounce scheduling
  - in-flight guard
  - suppression window after send/clear
  - dedupe against last synced draft
- Use adapters from both UI surfaces to consume the same state machine.

### Deliverables

1. `PromptDraftSyncController` package module.
2. Thin UI bindings in `PromptComposer.vue` and quick prompt script generator.
3. Deterministic unit tests covering edge timing behaviors.

### Acceptance criteria

- No duplicate debounce/sync logic blocks in two UI paths.
- Input behavior remains unchanged from user perspective.

## Workstream D — Provider domain consolidation

### Goal

Consolidate provider metadata, inject selectors, and detection rules under a single provider domain model.

### Scope

- Centralize provider registry and validation.
- Define explicit schema:
  - provider metadata
  - injection selectors
  - detection rules
- Remove duplicate fallback assumptions across config and provider modules.

### Acceptance criteria

- One canonical provider key list.
- All provider-derived defaults built from canonical registry.

## Workstream E — Runtime adapter hardening

### Goal

Strengthen runtime boundary between renderer and Electron bridge.

### Scope

- Define stable runtime interfaces in shared contracts.
- Ensure fallback runtime and Electron runtime implement same semantics.
- Move error normalization to shared utility.

### Acceptance criteria

- Runtime adapters have complete parity tests.
- No renderer code depends on Electron-specific type imports.

## Workstream F — Build graph normalization

### Goal

Make build pipeline deterministic and easier to reason about.

### Scope

- Keep `just` as command entrypoint.
- Rationalize Vite + esbuild responsibilities:
  - declare what is built by Vite plugin
  - declare what is built by dedicated scripts
- Add build manifest assertions (artifacts exist + hash/version consistency where useful).

### Acceptance criteria

- `just build` produces deterministic artifact set.
- No hidden build dependency between steps.

## Workstream G — Test architecture strengthening

### Goal

Improve confidence and speed for refactor iterations.

### Scope

- Add service-level unit tests for extracted modules.
- Add targeted integration tests for IPC boundaries and view lifecycle transitions.
- Keep smoke tests minimal but representative.

### Acceptance criteria

- Refactor-specific modules each have behavior lock tests.
- `just test` remains green across phases.

## Workstream H — Observability and failure transparency

### Goal

Standardize diagnostics for view load failures, prompt dispatch failures, and IPC operation failures.

### Scope

- Introduce scoped logger helpers with stable prefixes.
- Replace ad-hoc console output where necessary.
- Ensure error payloads are actionable.

### Acceptance criteria

- Logs are searchable by subsystem.
- Error handling paths are test-covered for key branches.

## Workstream I — Documentation and architecture records

### Goal

Keep architecture intent explicit and evolvable.

### Scope

- Add ADR entries for high-impact decisions:
  - shared contracts split
  - view service decomposition
  - prompt state machine unification
- Keep this CLIP as program-level master document.

### Acceptance criteria

- Each completed phase maps to ADR/commit references.

### Phase plan (execution roadmap)

## Phase 0 — Baseline and guardrails

### Tasks

1. Freeze current behavior with baseline tests.
2. Add architecture lints/check scripts for forbidden import directions.
3. Establish refactor state files (see context compression section).

### Exit criteria

- Baseline CI green.
- Forbidden dependency checks available.

## Phase 1 — Shared contracts/config extraction

### Tasks

1. Create shared contract package and migrate IPC types.
2. Introduce shared config schema + defaults.
3. Add compatibility re-exports for old paths.

### Exit criteria

- Type imports no longer cross app/runtime boundaries directly.

## Phase 2 — View manager decomposition (core)

### Tasks

1. Complete extraction of load monitor, layout service, shortcut dispatcher.
2. Keep `ViewManager` as coordinator.
3. Add service tests and integration coverage.

### Exit criteria

- `ViewManager` size and responsibility reduced.
- No behavior regressions in smoke tests.

## Phase 3 — Prompt pipeline unification

### Tasks

1. Build shared draft/sync controller.
2. Migrate Sidebar and Quick Prompt to shared controller.
3. Verify key timing semantics.

### Exit criteria

- Duplicate logic removed.
- Behavior parity preserved.

## Phase 4 — Provider/runtime hardening

### Tasks

1. Consolidate provider registry and validation.
2. Align runtime adapter contracts and errors.
3. Remove legacy fallback duplications.

### Exit criteria

- Single provider truth source.
- Runtime adapters parity confirmed.

## Phase 5 — Build/test/observability finalization

### Tasks

1. Normalize build graph documentation + checks.
2. Strengthen test matrix for future maintenance.
3. Standardize structured logs and diagnostics.

### Exit criteria

- Predictable build outputs.
- Fast and reliable regression detection.

### Migration and compatibility strategy

1. **Strangler pattern** for module extraction
   - Keep old entry points as adapters while moving implementation.
2. **No big-bang renames**
   - Stage moves with re-exports to reduce merge pain.
3. **Rollback safety**
   - Each phase must be independently revertible.

### Risks and mitigations

1. **Risk: Hidden coupling breaks runtime behavior**
   - Mitigation: import-boundary checks + smoke test gate each phase.
2. **Risk: Timing regressions in prompt sync flow**
   - Mitigation: deterministic fake timer tests for state machine.
3. **Risk: Build script drift after migration**
   - Mitigation: artifact assertions and explicit build ownership matrix.
4. **Risk: Long-running refactor loses continuity**
   - Mitigation: context compression protocol below.

### Context compression and resumable execution protocol

This is mandatory for this refactor program.

## Canonical state artifacts

Create and maintain:

1. `docs/refactor/state/master-index.md`
   - Program overview and links to phase snapshots.
2. `docs/refactor/state/current-phase.md`
   - Active phase scope, decisions, blockers, next actions.
3. `docs/refactor/state/decision-log.md`
   - Chronological decisions (short ADR-like entries).
4. `docs/refactor/state/progress-ledger.md`
   - Checklist of completed/in-progress/pending tasks.
5. `docs/refactor/state/verification-ledger.md`
   - Commands run, pass/fail, timestamp, commit hash.

## Canonical compression payload (machine + human)

At every compression point, produce two aligned payloads:

1. `docs/refactor/state/resume-pack.md` (human readable)
2. `docs/refactor/state/resume-pack.json` (machine readable)

`resume-pack.json` schema:

```json
{
  "clip": "CLIP-2",
  "phase": "Phase 2",
  "active_task_ids": ["2.B.03", "2.B.04"],
  "completed_task_ids": ["0.A.01", "1.A.01"],
  "blocked_task_ids": [],
  "open_decisions": [
    {
      "id": "D-2026-02-11-01",
      "question": "Contract location for runtime bridge types",
      "default": "packages/shared-contracts/runtime"
    }
  ],
  "invariants": [
    "No electron/** import from src/**",
    "No behavior change without explicit CLIP scope adjustment"
  ],
  "next_actions": [
    "Extract ShortcutDispatcher from manager",
    "Add service-level tests for shortcut routing"
  ],
  "verification": {
    "required_commands": ["just check", "just test"],
    "last_green_commit": "COMMIT_SHA"
  },
  "risk_watchlist": [
    "Shortcut source WebContents mapping",
    "Prompt dispatch ordering"
  ]
}
```

## Compression cadence

- Update state artifacts at least once per meaningful refactor commit.
- Before context reset/compression, produce a “Resume Pack” summary.

## Resume Pack format (strict)

Each resume pack must include:

1. **Program state**
   - Current phase and completion percentage.
2. **Invariant checklist**
   - Rules that must not be violated in next step.
3. **Open decisions**
   - Any unresolved choices with default recommendation.
4. **Exact next actions**
   - Ordered implementation list (atomic tasks).
5. **Verification plan**
   - Exact commands to run and expected outcomes.
6. **Risk watchlist**
   - Known fragile points for the next edit.

7. **Task continuity**
   - Exact unfinished task IDs and their latest mutation point.

## Context budget strategy

When context must be compressed:

1. Preserve only:
   - active phase contract
   - latest decisions
   - current TODOs
   - validation status
2. Drop:
   - already-implemented low-level execution traces
   - stale alternatives rejected by decision log
3. Keep references by path and section headings, not full duplication.

## Continuation guarantee

Any engineer/agent should be able to continue from Resume Pack + state artifacts without requiring full historical conversation.

### Detailed phase checklists (task IDs)

#### Phase 0 checklist

- `0.A.01` baseline test inventory and baseline report committed.
- `0.A.02` import-boundary check script created.
- `0.A.03` state artifact scaffold created.
- `0.A.04` first resume-pack generated.

#### Phase 1 checklist

- `1.A.01` shared IPC contracts package created.
- `1.A.02` compatibility re-export for old IPC path added.
- `1.A.03` shared config schema and defaults extracted.
- `1.A.04` renderer/electron imports migrated to shared contracts.
- `1.A.05` boundary checks enforce no new cross-layer imports.

#### Phase 2 checklist

- `2.B.01` `PaneLoadMonitor` fully isolated and interface-hardened.
- `2.B.02` `LayoutService` extraction completed.
- `2.B.03` `ShortcutDispatcher` extraction completed.
- `2.B.04` `SidebarEventBridge` extraction completed.
- `2.B.05` `PromptDispatchService` extraction completed.
- `2.B.06` `ViewManager` reduced to composition root/coordinator.

#### Phase 3 checklist

- `3.C.01` shared prompt sync controller implemented.
- `3.C.02` Sidebar prompt flow migrated.
- `3.C.03` Quick Prompt flow migrated.
- `3.C.04` timing parity tests added with fake timers.

#### Phase 4 checklist

- `4.D.01` provider registry canonicalized.
- `4.D.02` selector schema validation added.
- `4.E.01` runtime adapter shared contracts finalized.
- `4.E.02` fallback/electron runtime parity suite green.

#### Phase 5 checklist

- `5.F.01` build ownership matrix documented.
- `5.F.02` artifact assertions integrated.
- `5.G.01` refactor-critical test matrix finalized.
- `5.H.01` logging conventions standardized.
- `5.I.01` ADR index + entries completed.

### Public interfaces and type changes (planned)

1. Move IPC contract types to shared package namespace.
2. Introduce explicit service interfaces for view orchestration components.
3. Introduce prompt sync controller interface used by both Sidebar and Quick Prompt.
4. Replace ad-hoc internal state access with injected domain interfaces.

### Test plan

## Test levels and required gates per phase

1. **Unit tests**
   - New domain/service modules must have targeted unit tests.
2. **Integration tests**
   - IPC boundary and orchestration transitions for modified paths.
3. **Smoke tests**
   - Keep app-shell, panes, prompt, quick-prompt, sidebar paths green.

## Required command gates

Per implementation checkpoint:

1. `just check`
2. `just test`

Additionally for migration-heavy phases:

1. targeted Vitest suites for touched modules
2. smoke subset runs during intermediate edits when needed

### Acceptance criteria (program-level)

The full refactor is complete when all are true:

1. No forbidden cross-layer imports remain.
2. `ViewManager` is a coordinator, not a monolith.
3. Prompt sync/send semantics are implemented once and reused.
4. Provider metadata and selector registry are canonicalized.
5. Build graph ownership is explicit and deterministic.
6. Tests are green at unit + smoke levels via `just test`.
7. Context-resumable state artifacts are up to date and sufficient for continuation after compression.

### Implementation notes

- This CLIP is the master plan; future phase-specific notes should reference this document instead of replacing it.
- Commit discipline:
  - one logical phase slice per commit where possible
  - each commit message maps to one or more workstream tasks above
- If runtime behavior must change for architectural necessity, that change must be explicitly added under “Scope adjustments” in this CLIP before implementation.

## Scope adjustments

- None yet.
