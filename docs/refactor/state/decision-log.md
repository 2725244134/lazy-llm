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
