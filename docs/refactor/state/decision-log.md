# Decision Log

## D-001

- Date: 2026-02-11
- Context: We need to migrate IPC contracts and config ownership without breaking existing import paths during ongoing refactor.
- Decision: Use compatibility re-export entrypoints while moving canonical definitions to shared packages.
- Alternatives considered:
  - Big-bang path rewrite in one phase.
  - Duplicate definitions during transition.
- Impact:
  - Reduces migration risk and allows incremental rollout.
  - Requires tracking task `1.A.04` to finish import migration later.

## D-002

- Date: 2026-02-11
- Context: `ViewManager` exceeded sustainable complexity and mixed orchestration with domain logic.
- Decision: Extract orchestration modules (`LayoutService`, `PromptDispatchService`, `ShortcutDispatcher`, `SidebarEventBridge`, `PaneLifecycleService`) and wire manager as coordinator.
- Alternatives considered:
  - Continue patching inside one manager file.
  - Full rewrite into a new manager class in one step.
- Impact:
  - Improves testability and decomposition while preserving runtime behavior.
  - Leaves `2.B.06` open until remaining coordination logic is fully split.

## D-003

- Date: 2026-02-11
- Context: `QuickPromptLifecycleService` existed with tests but `ViewManager` still owned quick prompt lifecycle state and transitions.
- Decision: Wire `ViewManager` to delegate quick prompt show/hide/resize/relayout/destroy flows to `QuickPromptLifecycleService`.
- Alternatives considered:
  - Keep quick prompt lifecycle in `manager.ts` until later phase.
  - Move only resize logic and leave show/hide in `manager.ts`.
- Impact:
  - Reduces `manager.ts` state surface and advances task `2.B.06`.
  - Keeps behavior parity while making lifecycle transitions unit-testable via the dedicated service.

## D-004

- Date: 2026-02-11
- Context: `ViewManager` still owned pane view creation/loading/close mechanics after quick prompt extraction.
- Decision: Introduce `PaneViewService` and delegate pane WebContents lifecycle operations to it, while keeping `PaneLifecycleService` as orchestration policy layer.
- Alternatives considered:
  - Keep pane view lifecycle methods inside `manager.ts` until `2.B.06` final pass.
  - Fold pane view responsibilities into `PaneLifecycleService` directly.
- Impact:
  - Shrinks `manager.ts` low-level pane responsibilities and improves testability with `paneViewService.test.ts`.
  - Keeps migration incremental and behavior-preserving by preserving existing callback contracts.

## D-005

- Date: 2026-02-11
- Context: `ViewManager` still owned pane-specific shortcut routing and pane context-menu construction after introducing `PaneViewService`.
- Decision: Move pane shortcut/context-menu wiring into `PaneViewService` and expose a narrow `onPaneShortcutAction` callback so manager only handles cross-view coordination actions.
- Alternatives considered:
  - Keep pane shortcut/context-menu details in `manager.ts` until Phase 3.
  - Split shortcut and context-menu into two additional micro-services immediately.
- Impact:
  - Closes `2.B.06` by reducing `manager.ts` further to coordinator responsibilities.
  - Preserves runtime behavior with service-level tests for pane shortcut dispatch and context-menu popup wiring.
